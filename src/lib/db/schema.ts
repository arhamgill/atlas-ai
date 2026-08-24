import {
  boolean,
  char,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  serial,
  smallint,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

/* ---------------------------------------------------------------------------
 * Provenance
 * ------------------------------------------------------------------------- */

/** Every number in the product traces back to a row here. */
export const sources = pgTable("sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  license: text("license").notNull(),
  /** Underlying originator when we ingest via a republisher (e.g. OWID -> Microsoft). */
  originator: text("originator"),
  cadence: text("cadence"),
  notes: text("notes"),
  retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ---------------------------------------------------------------------------
 * Reference data
 * ------------------------------------------------------------------------- */

export const countries = pgTable(
  "countries",
  {
    iso3: char("iso3", { length: 3 }).primaryKey(),
    iso2: char("iso2", { length: 2 }).notNull(),
    /**
     * ISO 3166-1 numeric — the globe's TopoJSON keys on this, not on iso3.
     * Null for countries that have no numeric code (Kosovo): they appear in
     * tables and rankings but cannot be picked on the globe.
     */
    isoNumeric: char("iso_numeric", { length: 3 }),
    name: text("name").notNull(),
    officialName: text("official_name").notNull(),
    region: text("region"),
    subregion: text("subregion"),
    lat: real("lat").notNull(),
    lng: real("lng").notNull(),
  },
  (t) => [index("countries_numeric_idx").on(t.isoNumeric)],
);

/* ---------------------------------------------------------------------------
 * Metrics — stored TALL, not wide.
 *
 * This is the load-bearing decision of the whole schema. Adding a fifth globe
 * layer is a row in metric_defs plus an ingest source: no migration, no
 * component change. The layer switcher reads metric_defs at runtime.
 * ------------------------------------------------------------------------- */

/** How a metric's `period` strings should be parsed and displayed. */
export type PeriodType = "annual" | "quarter";

/** Which globe layer a metric powers. Null = context metric, not a layer. */
export type LayerKey = "adoption" | "investment" | "development" | "research";

export const metricDefs = pgTable("metric_defs", {
  key: text("key").primaryKey(),
  label: text("label").notNull(),
  /** Short label for dense UI (legends, table headers). */
  shortLabel: text("short_label").notNull(),
  description: text("description").notNull(),
  /** "percent" | "usd" | "count" */
  unit: text("unit").notNull(),
  /** Decimal places when formatting. */
  precision: smallint("precision").notNull().default(0),
  higherIsBetter: boolean("higher_is_better").notNull().default(true),
  layer: text("layer").$type<LayerKey>(),
  periodType: text("period_type").$type<PeriodType>().notNull(),
  sourceId: text("source_id")
    .notNull()
    .references(() => sources.id),
  methodologyNote: text("methodology_note"),
});

export const metrics = pgTable(
  "metrics",
  {
    id: serial("id").primaryKey(),
    countryIso3: char("country_iso3", { length: 3 })
      .notNull()
      .references(() => countries.iso3, { onDelete: "cascade" }),
    metricKey: text("metric_key")
      .notNull()
      .references(() => metricDefs.key, { onDelete: "cascade" }),
    /** Lexicographically sortable within a metric: "2024" or "2026-03-31". */
    period: text("period").notNull(),
    value: doublePrecision("value").notNull(),
  },
  (t) => [
    unique("metrics_unique").on(t.countryIso3, t.metricKey, t.period),
    index("metrics_lookup_idx").on(t.metricKey, t.period),
    index("metrics_country_idx").on(t.countryIso3),
  ],
);

/**
 * Precomputed at ingest rather than derived per request, so rank-delta
 * animations don't cost a window function on every page view.
 */
export const rankings = pgTable(
  "rankings",
  {
    metricKey: text("metric_key")
      .notNull()
      .references(() => metricDefs.key, { onDelete: "cascade" }),
    period: text("period").notNull(),
    countryIso3: char("country_iso3", { length: 3 })
      .notNull()
      .references(() => countries.iso3, { onDelete: "cascade" }),
    rank: integer("rank").notNull(),
    /** Rank in the immediately preceding period; null in the first period. */
    prevRank: integer("prev_rank"),
    /** prevRank - rank. Positive = climbing. Null in the first period. */
    delta: integer("delta"),
    /** 0..1, where 1 is best. */
    percentile: real("percentile").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.metricKey, t.period, t.countryIso3] }),
    index("rankings_lookup_idx").on(t.metricKey, t.period, t.rank),
  ],
);

/* ---------------------------------------------------------------------------
 * Models (Epoch AI) — powers the development layer, expands into V3
 * ------------------------------------------------------------------------- */

export const models = pgTable(
  "models",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    organization: text("organization"),
    /** Null when the organization is multinational or unresolvable. */
    countryIso3: char("country_iso3", { length: 3 }).references(() => countries.iso3, {
      onDelete: "set null",
    }),
    /** All countries credited, for collaborations. */
    countries: jsonb("countries").$type<string[]>().notNull().default([]),
    publicationDate: date("publication_date"),
    domain: text("domain"),
    parameters: doublePrecision("parameters"),
    trainingComputeFlop: doublePrecision("training_compute_flop"),
    link: text("link"),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id),
  },
  (t) => [
    index("models_country_idx").on(t.countryIso3),
    index("models_date_idx").on(t.publicationDate),
  ],
);

/* ---------------------------------------------------------------------------
 * Companies — curated, populated in V1. Every field carries its own source.
 * ------------------------------------------------------------------------- */

export const companies = pgTable(
  "companies",
  {
    slug: text("slug").primaryKey(),
    name: text("name").notNull(),
    countryIso3: char("country_iso3", { length: 3 }).references(() => countries.iso3),
    hqCity: text("hq_city"),
    founded: smallint("founded"),
    category: text("category"),
    valuationUsd: doublePrecision("valuation_usd"),
    totalFundingUsd: doublePrecision("total_funding_usd"),
    employees: integer("employees"),
    summary: text("summary"),
    website: text("website"),
    logoPath: text("logo_path"),
    /** Per-field provenance: { valuationUsd: { url, retrievedAt }, ... } */
    sources: jsonb("sources").$type<Record<string, { url: string; asOf: string }>>(),
  },
  (t) => [index("companies_country_idx").on(t.countryIso3)],
);

export const companyEvents = pgTable(
  "company_events",
  {
    id: serial("id").primaryKey(),
    companySlug: text("company_slug")
      .notNull()
      .references(() => companies.slug, { onDelete: "cascade" }),
    date: date("date").notNull(),
    /** "funding" | "model" | "product" | "milestone" */
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    url: text("url"),
  },
  (t) => [index("company_events_slug_idx").on(t.companySlug, t.date)],
);
