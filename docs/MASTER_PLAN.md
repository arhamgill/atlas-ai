# AI Atlas — Master Build Plan

> **On approval, step 0 is to copy this file into the project as `docs/MASTER_PLAN.md`** so it lives with the code and can evolve alongside it. Plan mode only permits editing this one file.

---

## Context

**Why this project exists.** You need one portfolio piece you can send cold to a recruiter that proves frontend depth _and_ full-stack competence in a single link. Most portfolio projects fail at this because they're either a beautiful static page with no data engineering behind it, or a CRUD dashboard with no visual craft. AI Atlas is deliberately positioned to prove both: a WebGL globe and a real ETL pipeline in the same repo.

**What we're building.** _AI Atlas — the global AI race, visualized._ An interactive intelligence platform where a 3D globe is the primary navigation surface. Users switch data layers (adoption, investment, development, research), click a country to fly the camera in and open a detail panel, compare countries across dimensions, and watch rankings shift over time.

**The rough sketch in [research/AI_Atlas_Project_Reference.md](research/AI_Atlas_Project_Reference.md) was directionally right.** This plan keeps its concept and navigation, and changes four things based on research:

1. **Epoch AI replaces Papers with Code** as the models/development source — 1,052 notable models (3,500+ in the full `all_ai_models` set), daily CSV, CC BY, 47 columns including organization and country. Papers with Code is effectively defunct.
2. **Our World in Data becomes the primary numeric source** rather than scraping the Stanford AI Index PDF. OWID republishes AI Index data with a documented CSV API and stable slugs, so the pipeline is automatable instead of manual.
3. **"Fastest Rising" is confirmed feasible with real data** — Microsoft ships three time periods, so rank deltas are computed, not fabricated.
4. **Companies are honestly hand-curated.** There is no free company funding/valuation API worth using. ~25 curated profiles with cited sources, labelled as such in the UI. This is a strength, not a compromise — it shows data judgment.

**Confirmed constraints** (from your answers): Postgres + ingest scripts + API routes · 4–6 weeks · dark intelligence console aesthetic · free tiers only.

---

## Ground rules

These prevent the two ways this project dies.

1. **Every version is independently shippable.** At the end of each version the site deploys, works on mobile, and is sendable. A half-finished V3 reads worse to a recruiter than a finished V1.
2. **Curated and excellent beats comprehensive and generic.** ~150 countries, ~25 companies, 4 layers. No feature enters V1 that we can't polish.
3. **Never fabricate a number.** Every displayed figure traces to a source row. Missing data renders as an explicit "no data" state, never as zero, never interpolated.
4. **No composite "overall AI score."** Compare across dimensions instead. Inventing a single ranking is the fastest way to look unserious to anyone who knows the domain.

---

## Data sources — probed and confirmed

> **V0 data spike completed 2026-08-24.** Every slug below was downloaded and inspected by counting distinct ISO3 codes. Of the seven OWID slugs originally listed, **four were wrong** — two returned 404, two are not country-level. Replacements were found via the OWID search API. The findings below supersede the original list.

### Globe layers — all four confirmed viable

| Layer           | Source / slug                                                   | Countries | Periods                                      | Notes                                                                                                                                                                                                                                                       |
| --------------- | --------------------------------------------------------------- | --------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Adoption**    | OWID `estimated-share-people-generative-ai`                     | **147**   | 3 — `2025-06-30`, `2025-12-31`, `2026-03-31` | This **is** the Microsoft AI Diffusion series republished with ISO3 codes. Verified identical to the source CSV top-to-bottom: UAE 70.1, SGP 63.4, NOR 48.6, IRL 48.4, FRA 47.8, ESP 44.2. Also ships `GDP per capita` and `World region` columns for free. |
| **Investment**  | OWID `private-investment-in-artificial-intelligence-cset`       | **119**   | **10 — 2016 to 2025**                        | CSET-sourced private AI funding in USD. Ten years of history makes a time scrubber genuinely worthwhile.                                                                                                                                                    |
| **Research**    | OWID `annual-scholarly-publications-on-artificial-intelligence` | **189**   | 9 — 2016 to 2024                             | Best country coverage of any source in the project.                                                                                                                                                                                                         |
| **Development** | Epoch AI `notable_ai_models.csv`                                | **35**    | by publication date                          | 1,052 notable models; `Country (of organization)` populated for 99% of all rows and 100% of models since 2023. Deliberately sparse — the concentration in US/China **is** the story. Render as count-per-country with a prominent no-data state.            |

### Supporting sources

| Source                            | Access                                                                                                                                                                  | License                         | Feeds                                                                        |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------- |
| **Microsoft AI Diffusion Report** | `raw.githubusercontent.com/microsoft/ai-diffusion-report/main/data/AI_Diffusion_Q12026_Update.csv`                                                                      | MIT                             | Source of record cited for the adoption layer; also the H1/H2/Q1 cross-check |
| **Our World in Data**             | `ourworldindata.org/grapher/{slug}.csv?csvType=full` + `.metadata.json`                                                                                                 | CC BY 4.0                       | Adoption, investment, research layers + Trends context charts                |
| **Epoch AI**                      | `epoch.ai/data/notable_ai_models.csv` (47 columns incl. params, training compute, cost, accessibility)                                                                  | CC BY                           | Development layer; full model explorer in V3                                 |
| **Stanford AI Index 2026**        | [Public data (Drive)](https://drive.google.com/drive/folders/1zJTOg0iR0j5SijCwFutwWvDt143lW277) + [PDF](https://hai.stanford.edu/assets/files/ai_index_report_2026.pdf) | CC BY-ND                        | Narrative framing, methodology notes                                         |
| **Hugging Face Hub API**          | `huggingface.co/api/models?sort=downloads&limit=N`                                                                                                                      | Public, no auth (~500 req/5min) | V3 live model layer                                                          |
| **world-atlas** (npm)             | `countries-110m.json` TopoJSON, Natural Earth                                                                                                                           | Public domain                   | Globe geometry                                                               |
| **Curated companies**             | `data/seed/companies.json`                                                                                                                                              | Own, sources cited per field    | Company profiles, timelines                                                  |

### Global-only — demote to Trends context charts, not globe layers

These are real and useful, but their `Entity` column is a category, not a country:

- `corporate-investment-in-artificial-intelligence-by-type` — Entity is the deal type (Merger/acquisition, Minority stake, Private investment, Public offering, Total), 2013–2025. Excellent stacked-area chart for the Trends page.
- `affiliation-researchers-building-artificial-intelligence-systems-all` — Entity is Academia / Industry / Collaboration / Other, 1950–present.
- `private-investment-in-artificial-intelligence` — only China, Europe, United States, World. Good for a US-vs-China framing chart.

### Per-model, not per-country — hold for V3

- `artificial-intelligence-training-computation` — Entity is a model name. This is Epoch data; prefer the Epoch CSV directly, which carries country.
- `artificial-intelligence-parameter-count` — same.

### Confirmed dead — do not attempt

`artificial-intelligence-patents-submitted` (404) · `newly-funded-artificial-intelligence-companies` (404). **There is no country-level AI-patent dataset on OWID.** `annual-patent-applications` exists with 170 countries but covers all patents, not AI-specific ones — do not present it as an AI metric.

### Discovery tool for future layers

`https://ourworldindata.org/api/search?q=<term>` returns JSON including an `availableEntities` array per chart. Testing whether that array contains real country names is a reliable one-request check for country-level data. This is how the CSET investment slug was found after the original guesses 404'd. Keep it as `scripts/ingest/discover.ts`.

### Crosswalk — risk substantially reduced

The original plan flagged country-name resolution as the day-eating gotcha. **The probe defused most of it:** adoption, investment, and research all arrive from OWID with ISO3 in a `Code` column, so they need no name matching at all.

Only **Epoch** requires resolution, and it uses official ISO 3166 long-form names — `"United States of America"`, `"Korea (Republic of)"`, `"United Kingdom of Great Britain and Northern Ireland"`, `"Hong Kong"`, `"Czechia"`, plus a `"Multinational"` sentinel. That is **35 distinct tokens**, hand-verifiable in under an hour.

`data/seed/country-crosswalk.json` remains the single source of truth (`{ iso3, iso2, isoNumeric, canonicalName, aliases[], lat, lng, region }`), because the globe's TopoJSON keys on **numeric** ISO codes and still needs joining to ISO3. Seed it from the `world-countries` npm package. The resolver must still throw on unmatched names — silent drops are the failure mode that produces a quietly wrong map.

---

## Stack

Chosen for signal-per-hour: each library either shows a skill worth showing or removes work that shows nothing.

**Core** — Next.js 16.3.2 (App Router, RSC, Turbopack) · React 19.2.8 · TypeScript strict · pnpm 11

> Scaffolded 2026-08-24. `create-next-app` now ships **Next 16**, not 15. Two consequences: `pnpm typecheck` must run `next typegen` first (`LayoutProps` and friends are generated types), and Next manages `AGENTS.md` itself — project context goes _below_ its managed block, with `CLAUDE.md` importing it via `@AGENTS.md`.

**Styling** — Tailwind CSS v4 (CSS-first config) · CSS custom properties for design tokens · `shadcn/ui` (copy-in Radix primitives, heavily restyled — not used as a look, used as accessible headless behaviour) · `tailwind-merge` + `cva`

**3D** — `three` · `@react-three/fiber` · `@react-three/drei` · `three-globe` (wrapped in a custom R3F component) · `@react-three/postprocessing` (selective bloom)

**Animation** — `motion` (the Framer Motion successor) for UI, layout, and shared-element transitions · `lenis` for smooth scroll · custom spring/damping for camera flight. **No GSAP** — Motion covers it and one animation system beats two.

**Data viz** — `d3-scale`, `d3-array`, `d3-geo`, `d3-shape`, `d3-interpolate`, `d3-scale-chromatic` (individual modules, not the `d3` meta-package). Charts are **hand-built React + SVG** on top of d3 scales. No Recharts/Chart.js — chart libraries make charts look like chart libraries, and hand-rolled SVG is a much stronger portfolio signal.

**State** — `zustand` for globe/UI state (active layer, selected country, camera target, comparison set) · `nuqs` for URL-synced state so every view is a shareable deep link · `@tanstack/react-query` for client fetching in search and compare

**Backend** — Neon serverless Postgres (free tier) · `drizzle-orm` + `drizzle-kit` · Next.js route handlers · `zod` for ingest validation _and_ API contracts

**Quality** — Vitest + Testing Library · Playwright (smoke + visual) · ESLint + Prettier · Husky + lint-staged · `@next/bundle-analyzer`

**Deploy** — Vercel Hobby · Vercel Analytics + Speed Insights · GitHub Actions for ingest cron (V6)

> When building any chart, **load the `dataviz` skill first** — it carries the palette formula, mark specs, and the light/dark validator, and will keep all charts reading as one system.

---

## Architecture

```
ai-atlas/
├─ docs/
│  ├─ MASTER_PLAN.md              # this file
│  ├─ DATA_SOURCES.md             # provenance, licenses, retrieval dates
│  └─ DECISIONS.md                # ADR log — interview ammunition
├─ data/
│  ├─ seed/
│  │  ├─ country-crosswalk.json
│  │  └─ companies.json
│  └─ snapshots/                  # raw downloads, committed & dated
├─ scripts/ingest/
│  ├─ sources/{microsoft,owid,epoch,huggingface}.ts
│  ├─ resolve-country.ts          # crosswalk resolver, throws on miss
│  ├─ compute-rankings.ts         # ranks + deltas per metric per period
│  ├─ normalize.ts
│  └─ seed.ts                     # orchestrator: fetch → validate → upsert
├─ drizzle/                       # migrations
└─ src/
   ├─ app/
   │  ├─ page.tsx                 # hero + globe
   │  ├─ countries/page.tsx       # ranked table
   │  ├─ countries/[iso3]/page.tsx
   │  ├─ compare/page.tsx
   │  ├─ companies/{page,[slug]/page}.tsx
   │  ├─ trends/page.tsx          # fastest rising, time series
   │  ├─ about/page.tsx           # case study + methodology
   │  └─ api/
   │     ├─ layers/[metric]/route.ts
   │     ├─ countries/[iso3]/route.ts
   │     ├─ compare/route.ts
   │     ├─ companies/route.ts
   │     └─ search/route.ts
   ├─ components/
   │  ├─ globe/                   # Scene, Globe, Atmosphere, Markers,
   │  │                           # CameraController, LayerLegend, Starfield
   │  ├─ charts/                  # Axis, Bar, Line, Slope, Sparkline, RankFlow
   │  ├─ panels/                  # CountryPanel, CompanyCard, MetricTile
   │  └─ ui/                      # restyled shadcn primitives
   ├─ lib/
   │  ├─ db/{schema,client,queries}.ts
   │  ├─ geo/{crosswalk,centroids,topology}.ts
   │  ├─ metrics/{registry,format,scales}.ts
   │  └─ state/{globe,compare}.ts
   └─ styles/tokens.css
```

### Database schema (Drizzle / Postgres)

The important decision: **metrics are stored tall, not wide.**

```ts
sources      (id PK, name, url, license, retrieved_at, cadence, notes)
metric_defs  (key PK, label, unit, higher_is_better, layer, source_id,
              methodology_note, precision)
countries    (iso3 PK, iso2, iso_numeric, name, region, subregion,
              lat, lng, population, gdp_per_capita)
metrics      (id PK, country_iso3 FK, metric_key FK, period, value,
              UNIQUE(country_iso3, metric_key, period))
rankings     (metric_key, period, country_iso3, rank, prev_rank, delta,
              percentile, PRIMARY KEY(metric_key, period, country_iso3))
companies    (slug PK, name, country_iso3 FK, hq_city, founded, category,
              valuation_usd, total_funding_usd, employees, summary,
              website, logo_path, sources jsonb)
company_events (id PK, company_slug FK, date, kind, title, body, url)
models       (id PK, name, organization, country_iso3 FK, release_date,
              parameters, training_compute_flop, domain, source_id)
```

**Why tall matters:** adding a fifth globe layer becomes a row in `metric_defs` plus an ingest source — zero schema migration, zero component changes. The globe reads `metric_defs` to build its layer switcher. This is the single best architectural talking point in the project; write it up in `DECISIONS.md`.

`rankings` is precomputed at ingest rather than derived at query time, so rank-delta animations don't cost a window function on every request.

### Rendering & caching strategy

- Country pages: **static** (`generateStaticParams` over all ISO3) with ISR `revalidate: 86400`
- Globe layer payloads: fetched in an RSC, passed to the client globe as props — no client waterfall on first paint
- API routes: `Cache-Control: s-maxage=3600, stale-while-revalidate`
- Layer payloads trimmed to `[iso3, value, rank, delta]` tuples — array-of-arrays, not objects. Roughly 8 KB per layer vs ~40 KB naive.
- TopoJSON `countries-110m` (~100 KB) loaded once, cached in a module-level singleton, converted to GeoJSON on the client

---

## The globe (the piece that gets you hired)

**Approach:** `three-globe` inside a custom R3F component. This gives ray-cast country picking out of the box while leaving camera, lighting, and postprocessing fully under our control.

**Composition:**

- Base sphere, near-black, subtle fresnel rim
- Country polygons from TopoJSON, filled by the active metric's sequential ramp, with small altitude extrusion scaled to value — the "data has physical height" read
- Custom GLSL atmosphere shell (backside sphere, fresnel falloff) — cheap, and the single biggest visual upgrade
- Instanced point markers for company HQs / research hubs
- Starfield backdrop, very low intensity
- Selective bloom on atmosphere + hovered country only

**Interaction:**

- Hover → country lifts, tooltip with value + rank, rest of globe desaturates ~30%
- Click → camera flies to lat/lng over ~1100 ms, easing `[0.22, 1, 0.36, 1]`, settling at a tilt that leaves the right third clear for the panel; panel slides in via Motion; URL updates via nuqs
- Layer switch → colors and extrusions **interpolate** between metrics rather than cutting. This is what makes it feel expensive.
- Escape / click-away → camera returns to last free-orbit position
- Idle → slow auto-rotate, halted on first interaction

**Performance:**

- `frameloop="demand"`, invalidating on interaction and during animations only
- DPR clamped `[1, 1.75]`; `1` on mobile
- `next/dynamic` with `ssr: false` and a pre-rendered static globe poster to eliminate CLS and give an instant first paint
- Dispose geometries/materials/textures on unmount; verified with a Chrome memory profile after 20 layer switches
- Mobile: bloom off, extrusion off, auto-rotate off, 110m topology only
- WebGL-unsupported fallback: 2D `d3-geo` equirectangular choropleth (also the print/OG image path)

**Accessibility (non-negotiable, and a genuine differentiator):**

- The globe is decorative-plus; **every country is reachable via the ranked table** at `/countries` with identical data
- Full keyboard path to every country detail page
- `prefers-reduced-motion` → camera cuts instead of flying, auto-rotate off, transitions ≤100 ms
- Live region announces selection changes

---

## Design system — dark intelligence console

**Tokens** (`src/styles/tokens.css`, CSS custom properties consumed by Tailwind v4):

```
--bg-base       #07080A     --text-primary    #E8EAED
--bg-surface    #0E1014     --text-secondary  #9BA1A8
--bg-raised     #14171C     --text-tertiary   #6B7178
--border-subtle rgba(255,255,255,0.06)
--border-strong rgba(255,255,255,0.12)
--accent        #4CC9F0     (interactive only — focus, links, active states)
--positive      #34D399     --negative        #F87171
--no-data       #22262C     (explicit, always in the legend)
```

**Per-layer data ramps** give each layer its own identity so the globe reads differently at a glance:
adoption → teal-cyan (147 countries) · investment → amber (119) · development → violet (35, mostly no-data) · research → green (189).
Sequential, perceptually uniform, ≥3:1 against `--bg-base` at the light end. Validate with the `dataviz` skill's checker.

**Type:** Geist Sans (UI) + Geist Mono (all numerics, tabular figures — `font-variant-numeric: tabular-nums` on every figure so digits don't jitter during count-up animations). Scale: 11/12/14/16/20/28/40/64.

**Texture:** 4 px SVG noise overlay at 3% opacity over the whole page. Costs nothing, kills the flat-CSS look.

**Motion:** UI 150–250 ms · panels 300–400 ms · camera 900–1400 ms · number count-ups 600 ms. One easing curve everywhere: `cubic-bezier(0.22, 1, 0.36, 1)`.

**Anti-goals:** no card grid of colored stat boxes, no gradient-on-everything, no glassmorphism, no emoji flags in data tables, no sidebar nav.

---

## Version roadmap

### V0 — Foundation & data spike · Week 1

**The de-risking week. Do not start UI.**

- [x] ~~Scaffold Next.js + TS strict + Tailwind v4 + ESLint/Prettier/Husky~~ **DONE 2026-08-24** — typecheck/lint/test/format/build all green
- [x] ~~Build `country-crosswalk.json`; resolver with loud failures~~ **DONE** — 250 countries, 1,088 aliases, 0 collisions
- [x] ~~Probe all 7 OWID slugs~~ **DONE 2026-08-24** — all four layers confirmed viable; see Data sources above
- [x] ~~Ingest the three OWID layer CSVs~~ **DONE** — adoption 147 / investment 119 / research 190
- [x] ~~Ingest Epoch notable models~~ **DONE** — 1,052 models, 34 countries, 0 unresolved
- [x] ~~Cross-check adoption against the Microsoft CSV~~ **DONE** — 5 hard checks in `pnpm ingest:report`, all passing
- [ ] Snapshot AI Index public data from Drive → `data/snapshots/` with retrieval date
- [x] ~~Drizzle schema + Neon connection + first migration + full seed~~ **DONE** — 8 tables, 3,419 metric rows
- [x] ~~`compute-rankings.ts` producing ranks and deltas~~ **DONE** — competition ranking, 34 unit tests
- [ ] **R3F globe spike:** sphere + TopoJSON polygons + hover pick + one metric colored. Ugly is fine. Prove picking and 60 fps.
- [x] ~~`docs/DECISIONS.md` started~~ **DONE** — 6 ADRs incl. two data-quality traps

**Exit gate:** a Postgres database with real, ranked, source-attributed data for ≥140 countries on the adoption layer, and a globe that responds to a click.

---

### V1 — The Atlas · Weeks 2–4

**This is the recruiter-facing product.**

**Design system & shell** — tokens, type scale, noise, primitives, nav, footer with sources, page transitions

**Globe (`/`)** — full visual treatment (atmosphere, bloom, starfield) · layer switcher with interpolated transitions · hover tooltip · click-to-fly · legend with no-data entry · mobile tuning · static poster fallback

**Country detail (`/countries/[iso3]`)** — hero with flag, region, headline metric · metric tiles with rank + delta + sparkline · adoption trajectory chart across the 3 periods · notable models table · companies HQ'd here · peer comparison (nearest 4 by rank) · every figure carrying a source tooltip

**Countries index (`/countries`)** — sortable, filterable ranked table; the full keyboard-accessible mirror of the globe

**Compare (`/compare`)** — 2–4 countries side by side · radar or parallel-coordinates across the 4 dimensions (**not** a composite score) · URL-encoded selection so comparisons are shareable

**Trends (`/trends`)** — **Fastest Rising** as the hero: animated rank-flow (bump chart) over the three real adoption periods · biggest movers · regional aggregates (the adoption CSV ships OWID region, so this is free) · an investment scrubber across 2016–2025 · global context charts built from the three global-only OWID slugs (corporate investment by deal type; academia vs industry affiliation; US vs China vs Europe investment)

**Companies (`/companies`, `/companies/[slug]`)** — ~25 curated profiles · country, founded, category, funding/valuation (cited), models shipped, timeline · every field showing its source · a visible, honest "curated dataset, last updated <date>" note

**Cross-cutting** — command-palette search (⌘K) across countries/companies/models · loading skeletons · error boundaries · empty states

---

### V1.5 — Polish & ship · Weeks 5–6

**Do not skip this. It's the difference between "nice project" and "hired."**

- [ ] Lighthouse ≥95 perf / 100 a11y / 100 best-practices / ≥95 SEO on `/countries/[iso3]`; ≥85 perf on the globe page (WebGL costs — document why)
- [ ] Full keyboard pass; visible focus rings everywhere; axe clean
- [ ] `prefers-reduced-motion` honored on every animation including the camera
- [ ] Responsive 360 px → 2560 px; globe genuinely usable on a phone
- [ ] Per-route dynamic OG images (`next/og`) — country pages get their own card with the 2D map + headline metric
- [ ] Metadata, sitemap, robots, JSON-LD `Dataset`
- [ ] Bundle analysis; three.js code-split off every non-globe route
- [ ] Playwright smoke: load globe → click country → panel opens → navigate → compare
- [ ] Vitest on the crosswalk resolver, ranking computation, and formatters
- [ ] `/about` case-study page: problem, architecture diagram, data pipeline, hard problems solved, what you'd do next
- [ ] README with a hero GIF, live link, local setup, and an architecture section
- [ ] Deploy, custom subdomain, verify cold-start feel on a real phone on cellular

**Ship it. Send it. Everything below is upside.**

---

### V2 — Company intelligence

Full funding-round history · animated company timelines · company ↔ model ↔ country relationship graph · geographic presence on the globe as a marker layer · ecosystem view clustering companies by country

### V3 — Model explorer

Full Epoch dataset · live Hugging Face trending layer · compare models on params/compute/date · training-compute-over-time chart (the famous log-scale one) · model release timeline as a scrubber that drives the globe

### V4 — Research graph

Papers → models → benchmarks → companies as a force-directed graph · publications and patents by country as globe layers · benchmark leaderboards over time

### V5 — AI Analyst

Natural-language querying ("which countries are adopting AI fastest?") → structured query over the metrics table → the app answers _and drives the UI_: highlights countries on the globe, opens the relevant chart. **Critical design rule:** the LLM emits a constrained query plan validated by Zod against `metric_defs`; it never sees or invents numbers. Cite every figure. This is the feature that makes the project memorable — and the constrained-generation architecture is the interview story.

### V6 — Live pipeline

GitHub Actions cron re-running ingest · diffing against the previous snapshot · opening a PR when upstream data changes · "data updated" changelog page · on-demand ISR revalidation

---

## Risks & mitigations

| Risk                                            | Mitigation                                                                                                                                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ~~OWID slugs turn out global-only~~             | **Retired 2026-08-24.** Probed; all four layers confirmed. Global-only slugs reassigned to Trends charts.                                                                                        |
| Development layer is sparse — only 35 countries | Expected and intentional. `--no-data` is a designed state, and the US/China concentration is the most interesting thing on that layer. Pair it with a "why is most of the map grey?" annotation. |
| Country name resolution silently drops rows     | Now only Epoch needs it (35 tokens). Resolver throws on unmatched names; ingest reports coverage and fails below 95%.                                                                            |
| Globe janky on mid-range Android                | Mobile budget set in V0 spike; `frameloop="demand"`, DPR 1, no bloom, no extrusion. 2D fallback path exists.                                                                                     |
| Uneven data coverage looks broken               | `--no-data` is a first-class design token, present in every legend, with a "why is this grey?" tooltip. Honesty reads as competence.                                                             |
| Company data goes stale                         | Visible "curated, last updated" stamp. Never claim live.                                                                                                                                         |
| Scope creep past week 4                         | V1 feature list above is frozen at V0 exit. New ideas go to `docs/BACKLOG.md`.                                                                                                                   |
| Neon free tier cold starts                      | Country pages are static + ISR, so the DB isn't on the critical render path. Only search and compare hit it live.                                                                                |

---

## Verification

**Data integrity** (run after every ingest)

```bash
pnpm ingest              # fetch → validate → resolve → upsert
pnpm ingest:report       # coverage % per source, unmatched names, null rates
pnpm test:unit           # crosswalk resolver, rankings, formatters
```

Manually confirm three known figures against source: UAE Q1 2026 adoption = 70.10%, Singapore = 63.40%, Norway = 48.60%. If these don't render exactly, the pipeline is wrong.

**Application**

```bash
pnpm dev
pnpm test:e2e            # Playwright: globe → click → panel → navigate → compare
pnpm build && pnpm start # verify static generation of all country pages
pnpm analyze             # confirm three.js absent from non-globe route bundles
```

**Manual QA checklist per version**

- Globe: hover, click, layer-switch interpolation, escape-to-reset, idle rotate
- Keyboard-only: reach any country detail page without a mouse
- `prefers-reduced-motion: reduce` enabled → no camera flight, no auto-rotate
- Real phone on cellular: time to interactive globe
- Every displayed number: source tooltip present and correct
- A country with sparse data (e.g. a small African economy) renders "no data" cleanly, not `0`

**Portfolio readiness**

- [ ] Live URL loads to interactive globe in under 3 s on a mid-tier phone
- [ ] README hero GIF shows the click-to-fly interaction in the first 2 seconds
- [ ] `/about` explains architecture and the hard problems
- [ ] Repo is clean: no commented code, no TODOs, meaningful commit history
- [ ] Every data source credited with its license

---

## Immediate next actions on approval

1. Copy this plan to `docs/MASTER_PLAN.md`
2. `pnpm create next-app` — TS, Tailwind v4, App Router, ESLint
3. Build `country-crosswalk.json` and the resolver
4. ~~Probe the 7 OWID slugs~~ — **done 2026-08-24**, results recorded above
5. Ingest the three OWID CSVs + the Epoch CSV end-to-end into Neon
6. R3F globe spike: TopoJSON polygons, hover pick, adoption layer colored, 60 fps
