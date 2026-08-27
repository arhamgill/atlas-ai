# Decisions

Architecture decision log. Written as work lands, not reconstructed afterwards.
These are the answers to "why did you build it that way?"

---

## 001 — Metrics are stored tall, not wide

**Date:** 2026-08-24 · **Status:** adopted

**Context.** The globe has four data layers and the roadmap adds more. The obvious
schema is one column per metric on a `countries` table.

**Decision.** Store `metrics(country_iso3, metric_key, period, value)` — one row per
country per metric per period — with metric metadata in a separate `metric_defs`
table that the app reads at runtime.

**Consequences.** Adding a fifth globe layer is a row in `metric_defs` plus an ingest
source: no migration, no component change, no redeploy of the layer switcher, which
reads `metric_defs`. The cost is that every read needs a filter on `metric_key`, and
type safety over metric keys has to be enforced in the registry rather than by the
column list. Indexed on `(metric_key, period)` because that is the globe's access
pattern.

The registry (`src/lib/metrics/registry.ts`) is the single definition of a metric —
label, unit, precision, direction, period type, source. Ingest fails if a metric row
arrives with a key that has no definition, so a typo cannot create a phantom metric.

---

## 002 — Rankings are precomputed at ingest

**Date:** 2026-08-24 · **Status:** adopted

**Context.** The Trends page animates rank changes between periods. Computing rank and
period-over-period delta per request means a window function on every page view.

**Decision.** Compute rank, `prev_rank`, `delta` and `percentile` during ingest and
store them in a `rankings` table keyed `(metric_key, period, country_iso3)`.

**Consequences.** Reads are a simple indexed lookup. Data is only as fresh as the last
ingest, which is fine at a 3–6 month upstream cadence. Ties use competition ranking
(1, 2, 2, 4) to match what a reader expects from a league table.

---

## 003 — Ingest fails loudly on unresolved country names

**Date:** 2026-08-24 · **Status:** adopted

**Context.** Four ID systems collide in this project: OWID publishes ISO3, Epoch
publishes official ISO 3166 long-form names, world-atlas TopoJSON keys on ISO
**numeric**, and curated data uses whatever we type. The natural failure mode of a
name-matching pipeline is to skip what it cannot match.

**Decision.** `resolveOrThrow` throws on an unmatched name, and the seed script exits
non-zero listing every failure with the exact file to edit. Aggregates ("World",
"Europe", "Multinational") are declared explicitly in `NON_COUNTRIES` and filtered
_before_ resolution, so a genuine miss is never mistaken for an expected skip.

**Consequences.** An upstream rename breaks the build instead of silently shrinking the
map. A silently shrinking map looks completely fine until someone checks — which is
exactly why it is the failure worth engineering against.

---

## 004 — No fabricated ISO numeric codes

**Date:** 2026-08-25 · **Status:** adopted

**Context.** The crosswalk builder originally padded a missing ISO numeric to `"000"`.
That value passes a `/^\d{3}$/` check, so the builder's own "is this valid?" guard
reported success. `getByNumeric(0)` would then return Kosovo.

**Decision.** `isoNumeric` is `string | null`. Countries without a numeric code are
excluded from the numeric index and reported by name at build time.

**Consequences.** Kosovo (`UNK`) appears in tables and rankings but cannot be picked on
the globe, because the globe's geometry keys on ISO numeric. That is a real limitation
of the underlying geodata, so it is stated rather than papered over. Related:
`OWID_KOS` is explicitly mapped to `UNK` in `CODE_OVERRIDES` rather than being
discarded with the genuine aggregates — dropping a country silently is the thing 003
exists to prevent.

---

## 005 — Adoption values are modelled and regionally imputed

**Date:** 2026-08-25 · **Status:** documented constraint, design implication open

**Context.** While verifying the ranking logic, four countries showed an identical
`#111 → #97` jump. Investigating: **12 West African countries share exactly 10.1%**,
and French Guiana, Guyana, Suriname and Venezuela share exactly 10.3% across all three
periods.

**Finding.** Microsoft's country-level adoption estimates are _modelled_, and low-data
countries are imputed in regional blocks rather than measured independently.

**Consequences.** Rank movement inside an imputed block is an artefact of the model,
not a national trend. This directly affects the planned "Fastest Rising" hero on the
Trends page, whose top results would otherwise be dominated by these clusters.

**Open design question for V1.** Options: surface tied countries as an explicit group
rather than a list; restrict "Fastest Rising" to countries whose values are not
block-shared; or annotate the block visibly. Not decided yet — but "Venezuela is the
fastest-rising AI adopter" must not ship as a headline, because it is not a finding
about Venezuela.

---

## 006 — Snapshots are committed, and ingest can run offline

**Date:** 2026-08-25 · **Status:** adopted

**Context.** The V0 probe found four of seven planned OWID slugs were wrong — two 404,
two not country-level. Upstream URLs move.

**Decision.** Every fetched CSV is written to `data/snapshots/` with a retrieval date
recorded in `manifest.json`, and committed. `pnpm ingest -- --offline` rebuilds the
entire database from those snapshots with no network access.

**Consequences.** A build is reproducible even if an upstream slug disappears, and the
exact bytes behind any published figure are in version control. Verified: the offline
run reproduces all 3,419 metric rows.

`pnpm ingest:discover -- "<terms>"` queries OWID's search API and reports which charts
are country-level, so a replacement slug is looked up rather than guessed.

---

## 007 — The globe's colour scale spans every period, not the one on screen

**Date:** 2026-08-27 · **Status:** adopted

**Context.** The globe can now be scrubbed through a layer's history: investment carries
ten years (2016–2025), research nine (2016–2024). Adoption has three periods and
development is an all-time total, so it does not scrub.

**Decision.** `buildColorScale` receives the values from **all** of a layer's periods,
not just the period being painted. The domain is fixed for the layer.

**Consequences.** Scrubbing back to 2016 makes the map visibly dimmer, which is the
finding — private AI investment grew roughly an order of magnitude over the decade, and
the country count went from 69 to 92. Re-normalising per period would have painted 2016's
leader exactly as dark as 2025's and rendered a decade of growth as no change at all.
That would be fabricating a number in the only way a choropleth can.

The corollary: only the **active** layer follows the scrubber. A year selected on
investment may not exist on research, and showing an unrelated layer's 2016 figure beside
a 2016 investment figure would imply the two were chosen together.

---

## 008 — Choropleths are painted on demand, with a bounded cache

**Date:** 2026-08-27 · **Status:** adopted

**Context.** Each choropleth is a 2048×1024 canvas uploaded as a mipmapped texture —
roughly 11 MB of texture memory. Before scrubbing there were four, one per layer, painted
eagerly at mount. With periods there are 23 combinations: about 250 MB, most of which a
visitor never looks at.

**Decision.** Textures are painted the first time a layer/period is shown and kept in an
LRU cache capped at six (`TEXTURE_CACHE_LIMIT` in `Earth.tsx`). Eviction skips whatever
the shader is currently sampling — disposing a texture mid-crossfade tears the globe.

**Consequences.** Mount now paints one choropleth instead of four. A paint costs ~50 ms,
which the existing `uMix` crossfade covers, and a revisited period is instant. Scrubbing
across more than six positions repaints rather than growing without bound.

Period changes deliberately reuse the layer-switch crossfade path, so scrubbing a year
feels exactly like switching a layer rather than like a different mechanism.
