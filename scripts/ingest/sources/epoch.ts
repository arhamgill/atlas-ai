import { isNonCountry, resolveCountry } from "../../../src/lib/geo/crosswalk";
import { fetchCsv, parseCsv, type FetchOptions } from "../lib/fetch-csv";
import type { IngestResult, MetricRow, ModelRow, SourceDef } from "../types";

const SLUG = "epoch-notable-ai-models";
const URL = "https://epoch.ai/data/notable_ai_models.csv";

export const EPOCH_SOURCE: SourceDef = {
  id: SLUG,
  name: "Epoch AI — Notable AI Models",
  url: "https://epoch.ai/data/notable-ai-models",
  license: "CC BY",
  originator: "Epoch AI",
  cadence: "daily",
  notes:
    "Country is the organization's country. Models credited to multiple " +
    "countries count once for each — collaborations are not fractionally split.",
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function num(v: string | undefined): number | null {
  if (!v || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Ingest Epoch's notable-models dataset into:
 *   - `models` rows (full detail, expands into the V3 model explorer)
 *   - `development.notable_models` — models published per country per year
 *
 * Coverage is deliberately sparse (~35 countries). The concentration in the
 * US and China is the story of this layer, not a defect — the UI renders the
 * remainder as an explicit no-data state.
 */
export async function ingestEpoch(opts: FetchOptions = {}): Promise<IngestResult> {
  const text = await fetchCsv(SLUG, URL, opts);
  const rows = parseCsv(text);
  if (rows.length === 0) throw new Error(`[${SLUG}] parsed zero rows`);

  const headers = Object.keys(rows[0]!);
  const COUNTRY_COL = "Country (of organization)";
  for (const required of ["Model", "Publication date", COUNTRY_COL]) {
    if (!headers.includes(required)) {
      throw new Error(
        `[${SLUG}] missing expected column "${required}". Headers: ${headers.slice(0, 12).join(", ")}…`,
      );
    }
  }

  const models: ModelRow[] = [];
  const unresolved = new Set<string>();
  const skippedAggregates = new Set<string>();
  const countries = new Set<string>();
  // country -> year -> count
  const counts = new Map<string, Map<string, number>>();
  const ids = new Set<string>();

  for (const row of rows) {
    const name = (row["Model"] ?? "").trim();
    if (!name) continue;

    const rawDate = (row["Publication date"] ?? "").trim();
    const publicationDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : null;
    const year = publicationDate ? publicationDate.slice(0, 4) : null;

    const resolvedCountries: string[] = [];
    for (const token of (row[COUNTRY_COL] ?? "").split(",")) {
      const t = token.trim();
      if (!t) continue;
      if (isNonCountry(t)) {
        skippedAggregates.add(t);
        continue;
      }
      const r = resolveCountry(t);
      if (!r.ok) {
        unresolved.add(t);
        continue;
      }
      if (!resolvedCountries.includes(r.iso3)) resolvedCountries.push(r.iso3);
    }

    // Stable id; disambiguate the handful of models sharing a name.
    let id = slugify(publicationDate ? `${name}-${publicationDate}` : name);
    if (!id) continue;
    let n = 2;
    const base = id;
    while (ids.has(id)) id = `${base}-${n++}`;
    ids.add(id);

    models.push({
      id,
      name,
      organization: (row["Organization"] ?? "").trim() || null,
      countryIso3: resolvedCountries[0] ?? null,
      countries: resolvedCountries,
      publicationDate,
      domain: (row["Domain"] ?? "").trim() || null,
      parameters: num(row["Parameters"]),
      trainingComputeFlop: num(row["Training compute (FLOP)"]),
      link: (row["Link"] ?? "").trim() || null,
      sourceId: SLUG,
    });

    if (!year) continue;
    for (const iso3 of resolvedCountries) {
      countries.add(iso3);
      const byYear = counts.get(iso3) ?? new Map<string, number>();
      byYear.set(year, (byYear.get(year) ?? 0) + 1);
      counts.set(iso3, byYear);
    }
  }

  const metrics: MetricRow[] = [];
  const periods = new Set<string>();
  for (const [countryIso3, byYear] of counts) {
    for (const [period, value] of byYear) {
      metrics.push({
        countryIso3,
        metricKey: "development.notable_models",
        period,
        value,
      });
      periods.add(period);
    }
  }

  if (models.length === 0) throw new Error(`[${SLUG}] produced zero models`);

  return {
    sourceId: SLUG,
    metrics,
    models,
    countries: [...countries].sort(),
    periods: [...periods].sort(),
    skippedAggregates: [...skippedAggregates].sort(),
    unresolved: [...unresolved].sort(),
  };
}
