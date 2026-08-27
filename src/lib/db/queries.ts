import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { METRICS_BY_KEY } from "../metrics/registry";
import { countries, metricDefs, metrics, models, rankings } from "./schema";
import { db } from "./client";

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
      const mode = METRICS_BY_KEY.get(d.key)?.aggregation ?? "latest";

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

/* ---------------------------------------------------------------------------
 * Aggregation
 * ------------------------------------------------------------------------- */

export interface Aggregated {
  value: number;
  rank: number;
  delta: number | null;
  total: number;
  period: string;
}

/**
 * Collapse a metric's whole series to one figure per country, honouring the
 * aggregation policy declared in the metric registry.
 *
 * The "total" branch has to rank on the fly: the precomputed rankings table is
 * per-period, and an all-time total has no period to look up.
 */
export async function aggregateMetric(
  metricKey: string,
): Promise<{ byCountry: Map<string, Aggregated>; period: string }> {
  const def = METRICS_BY_KEY.get(metricKey);

  if (def?.aggregation === "total") {
    const [bounds] = await db
      .select({
        first: sql<string>`min(${metrics.period})`,
        last: sql<string>`max(${metrics.period})`,
      })
      .from(metrics)
      .where(eq(metrics.metricKey, metricKey));

    const rows = await db
      .select({
        iso3: metrics.countryIso3,
        value: sql<number>`sum(${metrics.value})`,
        rank: sql<number>`rank() over (order by sum(${metrics.value}) desc)`,
      })
      .from(metrics)
      .where(eq(metrics.metricKey, metricKey))
      .groupBy(metrics.countryIso3);

    const period = `${bounds?.first ?? ""}\u2013${bounds?.last ?? ""}`;
    return {
      period,
      byCountry: new Map(
        rows.map((r) => [
          r.iso3.trim(),
          {
            value: Number(r.value),
            rank: Number(r.rank),
            delta: null,
            total: rows.length,
            period,
          },
        ]),
      ),
    };
  }

  const [latest] = await db
    .select({ period: sql<string>`max(${metrics.period})` })
    .from(metrics)
    .where(eq(metrics.metricKey, metricKey));
  const period = latest?.period ?? "";

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
    .where(and(eq(metrics.metricKey, metricKey), eq(metrics.period, period)));

  return {
    period,
    byCountry: new Map(
      rows.map((r) => [
        r.iso3.trim(),
        {
          value: r.value,
          rank: r.rank ?? 0,
          delta: r.delta,
          total: rows.length,
          period,
        },
      ]),
    ),
  };
}

/* ---------------------------------------------------------------------------
 * Country detail
 * ------------------------------------------------------------------------- */

export interface SeriesPoint {
  period: string;
  value: number;
  rank: number | null;
  total: number | null;
}

export interface CountryMetric {
  key: string;
  label: string;
  shortLabel: string;
  layer: string | null;
  unit: string;
  precision: number;
  periodType: string;
  methodologyNote: string | null;
  sourceId: string;
  /** Most recent point that has a value. Null when the country has no data. */
  latest: {
    period: string;
    value: number;
    rank: number | null;
    prevRank: number | null;
    delta: number | null;
    percentile: number | null;
    total: number;
  } | null;
  series: SeriesPoint[];
}

export interface CountryModel {
  id: string;
  name: string;
  organization: string | null;
  publicationDate: string | null;
  domain: string | null;
  parameters: number | null;
  trainingComputeFlop: number | null;
  link: string | null;
}

export interface CountryDetail {
  iso3: string;
  iso2: string;
  name: string;
  officialName: string;
  region: string | null;
  subregion: string | null;
  lat: number;
  lng: number;
  metrics: CountryMetric[];
  models: CountryModel[];
  modelCount: number;
}

/** How many countries are ranked for each metric+period, for "rank X of Y". */
async function periodTotals(): Promise<Map<string, number>> {
  const rows = await db
    .select({
      metricKey: rankings.metricKey,
      period: rankings.period,
      total: sql<number>`count(*)`,
    })
    .from(rankings)
    .groupBy(rankings.metricKey, rankings.period);
  return new Map(rows.map((r) => [`${r.metricKey}|${r.period}`, Number(r.total)]));
}

export async function getCountryDetail(iso3: string): Promise<CountryDetail | null> {
  const code = iso3.toUpperCase();

  const [country] = await db
    .select()
    .from(countries)
    .where(eq(countries.iso3, code))
    .limit(1);
  if (!country) return null;

  const [rows, defs, totals, modelRows] = await Promise.all([
    db
      .select({
        metricKey: metrics.metricKey,
        period: metrics.period,
        value: metrics.value,
        rank: rankings.rank,
        prevRank: rankings.prevRank,
        delta: rankings.delta,
        percentile: rankings.percentile,
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
      .where(eq(metrics.countryIso3, code))
      .orderBy(metrics.metricKey, metrics.period),
    db.select().from(metricDefs).orderBy(metricDefs.key),
    periodTotals(),
    db
      .select({
        id: models.id,
        name: models.name,
        organization: models.organization,
        publicationDate: models.publicationDate,
        domain: models.domain,
        parameters: models.parameters,
        trainingComputeFlop: models.trainingComputeFlop,
        link: models.link,
      })
      .from(models)
      .where(eq(models.countryIso3, code))
      .orderBy(desc(models.publicationDate))
      .limit(12),
  ]);

  const [modelCountRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(models)
    .where(eq(models.countryIso3, code));

  const LAYER_ORDER = ["adoption", "investment", "development", "research"];

  const layerDefs = defs.filter((d) => d.layer !== null);
  const aggregates = new Map(
    await Promise.all(
      layerDefs.map(async (d) => [d.key, await aggregateMetric(d.key)] as const),
    ),
  );

  const byKey = new Map<string, typeof rows>();
  for (const r of rows) {
    const bucket = byKey.get(r.metricKey) ?? [];
    bucket.push(r);
    byKey.set(r.metricKey, bucket);
  }

  const countryMetrics: CountryMetric[] = defs
    .filter((d) => d.layer !== null)
    .map((d) => {
      const points = (byKey.get(d.key) ?? [])
        .slice()
        .sort((a, b) => a.period.localeCompare(b.period));
      const last = points.at(-1);
      // Headline figure follows the registry's aggregation policy, so a
      // country's development number is its all-time total rather than
      // whatever it happened to ship in a partial current year.
      const agg = aggregates.get(d.key)?.byCountry.get(code);
      return {
        key: d.key,
        label: d.label,
        shortLabel: d.shortLabel,
        layer: d.layer,
        unit: d.unit,
        precision: d.precision,
        periodType: d.periodType,
        methodologyNote: d.methodologyNote,
        sourceId: d.sourceId,
        latest: agg
          ? {
              period: agg.period,
              value: agg.value,
              rank: agg.rank,
              prevRank: last?.prevRank ?? null,
              delta: agg.delta,
              percentile: last?.percentile ?? null,
              total: agg.total,
            }
          : last
            ? {
                period: last.period,
                value: last.value,
                rank: last.rank,
                prevRank: last.prevRank,
                delta: last.delta,
                percentile: last.percentile,
                total: totals.get(`${d.key}|${last.period}`) ?? 0,
              }
            : null,
        series: points.map((p) => ({
          period: p.period,
          value: p.value,
          rank: p.rank,
          total: totals.get(`${d.key}|${p.period}`) ?? null,
        })),
      };
    })
    .sort(
      (a, b) => LAYER_ORDER.indexOf(a.layer ?? "") - LAYER_ORDER.indexOf(b.layer ?? ""),
    );

  return {
    iso3: country.iso3.trim(),
    iso2: country.iso2.trim(),
    name: country.name,
    officialName: country.officialName,
    region: country.region,
    subregion: country.subregion,
    lat: country.lat,
    lng: country.lng,
    metrics: countryMetrics,
    models: modelRows.map((m) => ({ ...m, id: m.id })),
    modelCount: Number(modelCountRow?.n ?? 0),
  };
}

/** Every country that has at least one metric — the set worth a page. */
export async function getCountriesWithData(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ iso3: metrics.countryIso3 })
    .from(metrics)
    .orderBy(metrics.countryIso3);
  return rows.map((r) => r.iso3.trim());
}

/* ---------------------------------------------------------------------------
 * Country index / table
 * ------------------------------------------------------------------------- */

export interface CountryRow {
  iso3: string;
  name: string;
  region: string | null;
  /** metric key -> latest value, rank and delta. */
  values: Record<string, { value: number; rank: number | null; delta: number | null }>;
}

export interface CountryTable {
  rows: CountryRow[];
  layers: {
    key: string;
    layer: string;
    label: string;
    shortLabel: string;
    unit: string;
    precision: number;
    period: string;
    total: number;
    max: number;
    min: number;
    /** Counts per bin across all countries, for the column-header histogram. */
    distribution: number[];
  }[];
}

/**
 * The whole table in two queries: latest period per metric, then every value
 * at those periods. Rendering 190+ rows client-side needs the data flat.
 */
export async function getCountryTable(): Promise<CountryTable> {
  const defs = await db
    .select({
      key: metricDefs.key,
      layer: metricDefs.layer,
      label: metricDefs.label,
      shortLabel: metricDefs.shortLabel,
      unit: metricDefs.unit,
      precision: metricDefs.precision,
      latest: sql<string>`max(${metrics.period})`,
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
    );

  const LAYER_ORDER = ["adoption", "investment", "development", "research"];
  defs.sort(
    (a, b) => LAYER_ORDER.indexOf(a.layer ?? "") - LAYER_ORDER.indexOf(b.layer ?? ""),
  );

  const meta = await db
    .select({ iso3: countries.iso3, name: countries.name, region: countries.region })
    .from(countries);
  const metaByIso3 = new Map(meta.map((m) => [m.iso3.trim(), m]));

  const aggregated = await Promise.all(defs.map((d) => aggregateMetric(d.key)));

  const byCountry = new Map<string, CountryRow>();
  defs.forEach((d, i) => {
    const agg = aggregated[i];
    if (!agg) return;
    for (const [iso3, a] of agg.byCountry) {
      const m = metaByIso3.get(iso3);
      if (!m) continue;
      const entry = byCountry.get(iso3) ?? {
        iso3,
        name: m.name,
        region: m.region,
        values: {},
      };
      entry.values[d.key] = { value: a.value, rank: a.rank, delta: a.delta };
      byCountry.set(iso3, entry);
    }
  });

  const layers = defs.map((d, i) => {
    const agg = aggregated[i];
    const values = agg ? [...agg.byCountry.values()].map((a) => a.value) : [];
    const max = values.length ? Math.max(...values) : 1;
    const min = values.length ? Math.min(...values) : 0;

    /*
     * Binned on a square-root scale, matching the inline bars. On a linear
     * scale every metric except adoption piles into the first bin and the
     * histogram becomes a single spike that says nothing.
     */
    const BINS = 14;
    const distribution = new Array<number>(BINS).fill(0);
    for (const v of values) {
      const t = max > 0 ? Math.sqrt(Math.max(0, v) / max) : 0;
      const i = Math.min(BINS - 1, Math.floor(t * BINS));
      distribution[i] = (distribution[i] ?? 0) + 1;
    }

    return {
      key: d.key,
      layer: d.layer ?? "",
      label: d.label,
      shortLabel: d.shortLabel,
      unit: d.unit,
      precision: d.precision,
      period: agg?.period ?? d.latest,
      total: values.length,
      max,
      min,
      distribution,
    };
  });

  return {
    rows: [...byCountry.values()].sort((a, b) => a.name.localeCompare(b.name)),
    layers,
  };
}

/* ---------------------------------------------------------------------------
 * Search index
 * ------------------------------------------------------------------------- */

export interface SearchEntry {
  iso3: string;
  name: string;
  region: string | null;
}

/**
 * Every country that has a page, as a flat list for the command palette.
 *
 * Deliberately tiny — under 200 rows of three short fields — so it can be
 * embedded in the shared layout and searched entirely on the client. A search
 * that round-trips per keystroke never feels instant.
 */
export async function getSearchIndex(): Promise<SearchEntry[]> {
  const rows = await db
    .selectDistinct({
      iso3: metrics.countryIso3,
      name: countries.name,
      region: countries.region,
    })
    .from(metrics)
    .innerJoin(countries, eq(countries.iso3, metrics.countryIso3))
    .orderBy(countries.name);
  return rows.map((r) => ({ ...r, iso3: r.iso3.trim() }));
}

/* ---------------------------------------------------------------------------
 * Peers
 * ------------------------------------------------------------------------- */

export interface Peer {
  iso3: string;
  name: string;
  rank: number;
  value: number;
}

/**
 * The countries immediately above and below one country in a ranking.
 *
 * A country page with no outbound links is a dead end: you arrive from the
 * globe or the table and there is nowhere to go except back. Neighbours in the
 * ranking are the most useful next click, because they are the ones actually
 * worth comparing against.
 */
export async function getPeers(
  metricKey: string,
  iso3: string,
  spread = 2,
): Promise<Peer[]> {
  const { byCountry } = await aggregateMetric(metricKey);
  const self = byCountry.get(iso3.toUpperCase());
  if (!self) return [];

  const names = new Map(
    (
      await db.select({ iso3: countries.iso3, name: countries.name }).from(countries)
    ).map((c) => [c.iso3.trim(), c.name]),
  );

  return [...byCountry.entries()]
    .filter(
      ([code, a]) =>
        code !== iso3.toUpperCase() && Math.abs(a.rank - self.rank) <= spread,
    )
    .sort((a, b) => a[1].rank - b[1].rank)
    .slice(0, spread * 2)
    .map(([code, a]) => ({
      iso3: code,
      name: names.get(code) ?? code,
      rank: a.rank,
      value: a.value,
    }));
}

/* ---------------------------------------------------------------------------
 * Compare series
 * ------------------------------------------------------------------------- */

/**
 * One country's history of one metric, positioned on that metric's shared
 * period grid.
 *
 * `slots[i]` is the index of `values[i]` in the grid, which is what makes the
 * sparklines in a compare row comparable: coverage is ragged (64 of 119
 * countries are missing at least one investment year), so plotting each series
 * across its own full width would put different years above each other.
 */
export interface CompareSeries {
  values: number[];
  slots: number[];
  gridLength: number;
}

/**
 * Full history per metric for a handful of countries, aligned for comparison.
 *
 * Only for the countries actually selected — shipping every country's series to
 * the compare page would be tens of kilobytes to render at most four columns.
 * The page therefore re-renders on the server when the selection changes, which
 * is why its URL state is not shallow.
 */
export async function getCompareSeries(
  iso3List: string[],
): Promise<Record<string, Record<string, CompareSeries>>> {
  const codes = iso3List.map((c) => c.trim().toUpperCase()).filter(Boolean);
  if (codes.length === 0) return {};

  // The grid comes from every country, not just the selected ones — otherwise
  // the x-axis would silently change meaning as the selection changed.
  const [gridRows, rows] = await Promise.all([
    db
      .selectDistinct({ metricKey: metrics.metricKey, period: metrics.period })
      .from(metrics)
      .orderBy(metrics.metricKey, metrics.period),
    db
      .select({
        iso3: metrics.countryIso3,
        metricKey: metrics.metricKey,
        period: metrics.period,
        value: metrics.value,
      })
      .from(metrics)
      .where(inArray(metrics.countryIso3, codes))
      .orderBy(metrics.countryIso3, metrics.metricKey, metrics.period),
  ]);

  const grid = new Map<string, Map<string, number>>();
  for (const g of gridRows) {
    const m = (grid.get(g.metricKey) ??
      grid.set(g.metricKey, new Map()).get(g.metricKey))!;
    m.set(g.period, m.size);
  }

  const out: Record<string, Record<string, CompareSeries>> = {};
  for (const r of rows) {
    const iso3 = r.iso3.trim();
    const slot = grid.get(r.metricKey)?.get(r.period);
    if (slot === undefined) continue;
    const byMetric = (out[iso3] ??= {});
    const s = (byMetric[r.metricKey] ??= {
      values: [],
      slots: [],
      gridLength: grid.get(r.metricKey)!.size,
    });
    s.values.push(r.value);
    s.slots.push(slot);
  }

  /*
   * A "total" metric's headline figure is the all-time sum, so its sparkline has
   * to be the running total or the line would end somewhere other than the
   * number printed above it. Cumulating also fills the gaps honestly: a country
   * with no models before 2019 genuinely had none.
   */
  for (const byMetric of Object.values(out)) {
    for (const [key, s] of Object.entries(byMetric)) {
      if (METRICS_BY_KEY.get(key)?.aggregation !== "total") continue;
      let running = 0;
      const values: number[] = [];
      const slots: number[] = [];
      for (let i = 0; i < s.gridLength; i++) {
        const at = s.slots.indexOf(i);
        if (at !== -1) running += s.values[at] ?? 0;
        values.push(running);
        slots.push(i);
      }
      byMetric[key] = { values, slots, gridLength: s.gridLength };
    }
  }

  return out;
}
