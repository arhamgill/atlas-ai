import { and, desc, eq, sql } from "drizzle-orm";
import { countries, metricDefs, metrics, rankings } from "./schema";
import { db } from "./client";

export interface LayerSummary {
  key: string;
  label: string;
  shortLabel: string;
  layer: string;
  unit: string;
  precision: number;
  countryCount: number;
  periodCount: number;
  firstPeriod: string;
  latestPeriod: string;
  sourceId: string;
  methodologyNote: string | null;
  leaders: { iso3: string; name: string; value: number; rank: number }[];
}

/**
 * One row per globe layer, with live coverage counts and the current top three.
 *
 * Everything here is read from the database rather than hard-coded, so the
 * figures on screen cannot drift from what actually got ingested.
 */
export async function getLayerSummaries(): Promise<LayerSummary[]> {
  const defs = await db
    .select({
      key: metricDefs.key,
      label: metricDefs.label,
      shortLabel: metricDefs.shortLabel,
      layer: metricDefs.layer,
      unit: metricDefs.unit,
      precision: metricDefs.precision,
      sourceId: metricDefs.sourceId,
      methodologyNote: metricDefs.methodologyNote,
      countryCount: sql<number>`count(distinct ${metrics.countryIso3})`,
      periodCount: sql<number>`count(distinct ${metrics.period})`,
      firstPeriod: sql<string>`min(${metrics.period})`,
      latestPeriod: sql<string>`max(${metrics.period})`,
    })
    .from(metricDefs)
    .innerJoin(metrics, eq(metrics.metricKey, metricDefs.key))
    .where(sql`${metricDefs.layer} is not null`)
    .groupBy(
      metricDefs.key,
      metricDefs.label,
      metricDefs.shortLabel,
      metricDefs.layer,
      metricDefs.unit,
      metricDefs.precision,
      metricDefs.sourceId,
      metricDefs.methodologyNote,
    )
    .orderBy(metricDefs.layer);

  return Promise.all(
    defs.map(async (d) => {
      const leaders = await db
        .select({
          iso3: countries.iso3,
          name: countries.name,
          value: metrics.value,
          rank: rankings.rank,
        })
        .from(rankings)
        .innerJoin(countries, eq(countries.iso3, rankings.countryIso3))
        .innerJoin(
          metrics,
          and(
            eq(metrics.countryIso3, rankings.countryIso3),
            eq(metrics.metricKey, rankings.metricKey),
            eq(metrics.period, rankings.period),
          ),
        )
        .where(and(eq(rankings.metricKey, d.key), eq(rankings.period, d.latestPeriod)))
        .orderBy(rankings.rank, countries.name)
        .limit(3);

      return { ...d, layer: d.layer ?? "", leaders };
    }),
  );
}

export interface AtlasTotals {
  countries: number;
  metricRows: number;
  models: number;
  sources: number;
}

export async function getAtlasTotals(): Promise<AtlasTotals> {
  const [row] = await db
    .select({
      countries: sql<number>`(select count(distinct country_iso3) from metrics)`,
      metricRows: sql<number>`(select count(*) from metrics)`,
      models: sql<number>`(select count(*) from models)`,
      sources: sql<number>`(select count(*) from sources)`,
    })
    .from(sql`(select 1) as _`);

  return {
    countries: Number(row?.countries ?? 0),
    metricRows: Number(row?.metricRows ?? 0),
    models: Number(row?.models ?? 0),
    sources: Number(row?.sources ?? 0),
  };
}

/** Rank movement between the two most recent periods of a metric. */
export async function getBiggestMovers(metricKey: string, limit = 5) {
  const [latest] = await db
    .select({ period: sql<string>`max(${metrics.period})` })
    .from(metrics)
    .where(eq(metrics.metricKey, metricKey));

  if (!latest?.period) return [];

  return db
    .select({
      iso3: rankings.countryIso3,
      name: countries.name,
      rank: rankings.rank,
      prevRank: rankings.prevRank,
      delta: rankings.delta,
      value: metrics.value,
    })
    .from(rankings)
    .innerJoin(countries, eq(countries.iso3, rankings.countryIso3))
    .innerJoin(
      metrics,
      and(
        eq(metrics.countryIso3, rankings.countryIso3),
        eq(metrics.metricKey, rankings.metricKey),
        eq(metrics.period, rankings.period),
      ),
    )
    .where(and(eq(rankings.metricKey, metricKey), eq(rankings.period, latest.period)))
    .orderBy(desc(rankings.delta))
    .limit(limit);
}

/* ---------------------------------------------------------------------------
 * Globe payloads
 * ------------------------------------------------------------------------- */

/** Compact tuple: [iso3, value, rank, delta]. Array-of-arrays, not objects —
 *  roughly 8 KB per layer over the wire instead of ~40 KB. */
export type LayerTuple = [string, number, number, number | null];

export interface GlobeLayer {
  key: string;
  layer: string;
  label: string;
  shortLabel: string;
  unit: string;
  precision: number;
  period: string;
  periodCount: number;
  methodologyNote: string | null;
  sourceId: string;
  rows: LayerTuple[];
}

/**
 * How each layer collapses its time series into the single figure the globe
 * paints.
 *
 * Most layers want their latest period. `development` does not: notable-model
 * releases are lumpy, and the newest period is a partial year — at the time of
 * writing only four countries had shipped a notable model in 2026, which would
 * render as a near-empty globe. The meaningful question for that layer is
 * "who has ever built frontier AI?", so it sums across all periods.
 */
const AGGREGATION: Record<string, "latest" | "total"> = {
  adoption: "latest",
  investment: "latest",
  research: "latest",
  development: "total",
};

/** Every globe layer collapsed to one value per country, ready for the client. */
export async function getGlobeLayers(): Promise<GlobeLayer[]> {
  const defs = await db
    .select({
      key: metricDefs.key,
      layer: metricDefs.layer,
      label: metricDefs.label,
      shortLabel: metricDefs.shortLabel,
      unit: metricDefs.unit,
      precision: metricDefs.precision,
      sourceId: metricDefs.sourceId,
      methodologyNote: metricDefs.methodologyNote,
      latestPeriod: sql<string>`max(${metrics.period})`,
      firstPeriod: sql<string>`min(${metrics.period})`,
      periodCount: sql<number>`count(distinct ${metrics.period})`,
    })
    .from(metricDefs)
    .innerJoin(metrics, eq(metrics.metricKey, metricDefs.key))
    .where(sql`${metricDefs.layer} is not null`)
    .groupBy(
      metricDefs.key,
      metricDefs.layer,
      metricDefs.label,
      metricDefs.shortLabel,
      metricDefs.unit,
      metricDefs.precision,
      metricDefs.sourceId,
      metricDefs.methodologyNote,
    );

  const order = ["adoption", "investment", "development", "research"];

  const layers = await Promise.all(
    defs.map(async (d) => {
      const mode = AGGREGATION[d.layer ?? ""] ?? "latest";

      if (mode === "total") {
        // Ranks are precomputed per period, so an all-time total needs its own
        // ranking. This runs once at build time, not per request.
        const rows = await db
          .select({
            iso3: metrics.countryIso3,
            value: sql<number>`sum(${metrics.value})`,
            rank: sql<number>`rank() over (order by sum(${metrics.value}) desc)`,
          })
          .from(metrics)
          .where(eq(metrics.metricKey, d.key))
          .groupBy(metrics.countryIso3);

        return {
          key: d.key,
          layer: d.layer ?? "",
          label: d.label,
          shortLabel: d.shortLabel,
          unit: d.unit,
          precision: d.precision,
          sourceId: d.sourceId,
          methodologyNote: d.methodologyNote,
          period: `${d.firstPeriod}–${d.latestPeriod}`,
          periodCount: Number(d.periodCount),
          rows: rows.map(
            (r) => [r.iso3.trim(), Number(r.value), Number(r.rank), null] as LayerTuple,
          ),
        };
      }

      const rows = await db
        .select({
          iso3: metrics.countryIso3,
          value: metrics.value,
          rank: rankings.rank,
          delta: rankings.delta,
        })
        .from(metrics)
        .leftJoin(
          rankings,
          and(
            eq(rankings.countryIso3, metrics.countryIso3),
            eq(rankings.metricKey, metrics.metricKey),
            eq(rankings.period, metrics.period),
          ),
        )
        .where(and(eq(metrics.metricKey, d.key), eq(metrics.period, d.latestPeriod)));

      return {
        key: d.key,
        layer: d.layer ?? "",
        label: d.label,
        shortLabel: d.shortLabel,
        unit: d.unit,
        precision: d.precision,
        sourceId: d.sourceId,
        methodologyNote: d.methodologyNote,
        period: d.latestPeriod,
        periodCount: Number(d.periodCount),
        rows: rows.map(
          (r) => [r.iso3.trim(), r.value, r.rank ?? 0, r.delta] as LayerTuple,
        ),
      };
    }),
  );

  return layers.sort((a, b) => order.indexOf(a.layer) - order.indexOf(b.layer));
}

/** Country reference data the globe needs for labels and camera targets. */
export async function getGlobeCountries() {
  const rows = await db
    .select({
      iso3: countries.iso3,
      name: countries.name,
      region: countries.region,
      lat: countries.lat,
      lng: countries.lng,
    })
    .from(countries);
  return rows.map((r) => ({ ...r, iso3: r.iso3.trim() }));
}
