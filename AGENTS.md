<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AI Atlas

_The global AI race, visualized._ An interactive intelligence platform: a WebGL globe is the
primary navigation surface, backed by a real ETL pipeline into Postgres.

**Read [docs/MASTER_PLAN.md](docs/MASTER_PLAN.md) before planning any work.** It is the
source of truth for scope, versions, data sources, schema, and design system. Keep it
updated as work lands.

## Current state

**V0 complete.** Scaffold, full ingest pipeline, and the interactive globe are all
done. Neon Postgres holds 3,419 metric rows / 3,419 rankings / 1,052 models across 194
countries, all integrity checks passing. Next up: V1 country pages.

The globe (`src/components/globe/`) is a single textured sphere, not per-country meshes
— see the Globe section below before changing it.

Read [docs/DECISIONS.md](docs/DECISIONS.md) before changing the schema or the ingest —
it records why things are the way they are, including two data-quality traps.

## Commands

| Command                                         | What it does                                                                           |
| ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| `pnpm dev`                                      | Dev server (Turbopack)                                                                 |
| `pnpm build`                                    | Production build                                                                       |
| `pnpm typecheck`                                | `next typegen && tsc --noEmit` — typegen is required, `LayoutProps` etc. are generated |
| `pnpm lint` / `pnpm format`                     | ESLint / Prettier                                                                      |
| `pnpm test`                                     | Vitest                                                                                 |
| `pnpm ingest`                                   | Fetch → validate → resolve → upsert into Postgres                                      |
| `pnpm ingest -- --dry-run`                      | Fetch + resolve + report, write nothing                                                |
| `pnpm ingest -- --offline`                      | Rebuild from committed snapshots, no network                                           |
| `pnpm ingest:crosswalk`                         | Regenerate `data/seed/country-crosswalk.json`                                          |
| `pnpm ingest:report`                            | Post-ingest verification incl. hard integrity checks                                   |
| `pnpm ingest:discover -- "terms"`               | Find country-level OWID charts (never guess slugs)                                     |
| `pnpm db:generate` / `db:migrate` / `db:studio` | Drizzle                                                                                |
| `pnpm analyze`                                  | Bundle analyzer                                                                        |

## Non-negotiables

1. **Never fabricate a number.** Every displayed figure traces to a source row. Missing data
   renders as an explicit no-data state — never zero, never interpolated.
2. **No composite "overall AI score."** Compare across dimensions instead.
3. **`--no-data` is a first-class design token**, present in every legend.
4. **Ingest fails loudly.** Unmatched country names throw; they are never silently dropped.
5. **Every version ships independently.** Deploys, works on mobile, sendable.

## Data sources — verified 2026-08-24, do not re-guess

Four globe layers, all confirmed country-level:

| Layer       | Source                                                          | Countries | Periods                     |
| ----------- | --------------------------------------------------------------- | --------- | --------------------------- |
| Adoption    | OWID `estimated-share-people-generative-ai`                     | 147       | 3 (2025-06-30 → 2026-03-31) |
| Investment  | OWID `private-investment-in-artificial-intelligence-cset`       | 119       | 10 (2016–2025)              |
| Research    | OWID `annual-scholarly-publications-on-artificial-intelligence` | 190       | 9 (2016–2024)               |
| Development | Epoch AI `notable_ai_models.csv`                                | 35        | by publication date         |

- OWID CSV pattern: `https://ourworldindata.org/grapher/{slug}.csv?csvType=full`
- Adoption data **is** the Microsoft AI Diffusion series republished with ISO3 codes; it also
  ships `GDP per capita` and `World region` columns. Cite Microsoft as source of record.
- Adoption/investment/research arrive ISO3-native — **no name matching needed**. Only Epoch
  needs resolution (35 official ISO 3166 names).
- **There is no country-level AI-patent dataset.** `annual-patent-applications` is all
  patents, not AI. Do not present it as an AI metric.
- Discovery for new layers: `pnpm ingest:discover -- "<terms>"` (wraps OWID's search
  API and reports which charts are country-level). Never hand-guess a slug.
- **Adoption values are modelled and regionally imputed.** 12 West African countries
  share exactly 10.1%; the four Guianas share exactly 10.3%. Rank movement inside those
  blocks is a model artefact, not a national trend — see DECISIONS 005 before building
  "Fastest Rising".
- Kosovo (`UNK`) has no ISO numeric code: present in tables and rankings, not pickable
  on the globe. Never fabricate a numeric code to make it fit.

See MASTER_PLAN → Data sources for the full list including global-only slugs (Trends charts)
and per-model slugs (V3).

## Architecture

- **Metrics are stored tall**, not wide: `metrics(country_iso3, metric_key, period, value)`.
  Adding a globe layer is a row in `metric_defs` plus an ingest source — no migration, no
  component change. The layer switcher reads `metric_defs`.
- `rankings` is precomputed at ingest, not derived per request.
- Country pages are static (`generateStaticParams`) + ISR. The DB is not on the critical
  render path; only search and compare hit it live.
- Layer payloads are `[iso3, value, rank, delta]` tuples, not objects.

Layout: `src/components/{globe,charts,panels,ui}` · `src/lib/{db,geo,metrics,state,data}` ·
`scripts/ingest/sources` · `data/{seed,snapshots}`.

## Design system — dark intelligence console

- **All colour lives in `src/styles/tokens.css`.** Never hard-code a hex elsewhere. Tailwind
  mapping is in `globals.css` under `@theme`.
- One accent (`--accent`, cyan) for **interactive state only** — never encode data in it.
  Data uses the per-layer ramps (`--ramp-{layer}-{1..5}`).
- One easing curve everywhere: `--ease`. Durations are semantic tokens (`--dur-ui`,
  `--dur-panel`, `--dur-camera`), and collapse automatically under `prefers-reduced-motion`.
- Every numeric figure gets `.numeric` (Geist Mono, tabular figures) so digits don't jitter.
- Charts are **hand-built React + SVG on d3 scales**. No chart libraries.
- Anti-goals: no card grid of coloured stat boxes, no glassmorphism, no gradient-on-
  everything, no emoji flags in data tables, no sidebar nav.

## Globe

`src/components/globe/`. The load-bearing decisions, all of which look like details
until you undo one:

- **One sphere, not 177 meshes.** The choropleth is painted into a 2048x1024 canvas
  (`lib/geo/render-maps.ts`) and mapped on. Layer switches are a GPU crossfade between
  two textures. Picking is CPU-side `geoContains` with a bbox prefilter
  (`lib/geo/topology.ts`) — exact, and no ID-buffer readback.
- **The globe never rotates; the camera orbits.** World space and globe space stay
  identical, so a raycast hit converts straight to lat/lng with no rotation to unwind.
  `lib/geo/sphere.ts` holds the two conversions and they must stay exact inverses —
  there are round-trip tests.
- **Never call `controls.update()` while the rig owns the camera.** OrbitControls
  clamps radius to `maxDistance` and rewrites `camera.position` from its own spherical
  state, which silently kills any hand-driven camera move.
- **Timed animations use wall clock, not accumulated frame deltas.** The first frame
  after mount can carry seconds of startup stall and will consume an entire animation
  in one tick. Frame deltas are clamped to 1/30s everywhere else.
- **Atmosphere is a camera-facing quad (`Halo.tsx`), not a back-faced shell.** A
  shell's fresnel peaks at its own limb and draws a hard ring in mid-air.
- **Lighting is deliberately flat.** A realistic terminator hides half the choropleth.
  This is a data map, not a planet simulation.
- **Any full-screen overlay above the canvas needs `pointer-events-none`.** This has
  already broken the globe once, and it looks completely fine while being inert.
- Camera distance is derived from whichever FOV axis is tighter, so framing is correct
  from a 390px phone to an ultrawide.
- View state lives in the URL (`?layer=&country=`), replace-not-push.

## Accessibility

The globe is not the only path to data. Every country must be reachable via the ranked table
at `/countries` with identical information, fully keyboard-navigable.
