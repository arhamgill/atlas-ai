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
