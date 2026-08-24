import { resolveCountry } from "../../../src/lib/geo/crosswalk";
import { fetchCsv, parseCsv, type FetchOptions } from "../lib/fetch-csv";
import type { IngestResult, MetricRow, SourceDef } from "../types";

const BASE = "https://ourworldindata.org/grapher";

export interface OwidDataset {
  /** OWID grapher slug. Verified 2026-08-24 — see docs/MASTER_PLAN.md. */
  slug: string;
  metricKey: string;
  /** Exact value-column header. Falls back to detection with a loud warning. */
  valueColumn: string;
  /** OWID uses "Year" for annual series and "Day" for dated ones. */
  periodColumn: "Year" | "Day";
  /** Extra columns worth capturing as their own context metrics. */
  extraMetrics?: { column: string; metricKey: string }[];
}

const ID_COLUMNS = new Set(["Entity", "Code", "Year", "Day"]);

/**
 * OWID assigns pseudo-codes to entities lacking a universally accepted ISO3.
 * Mapping them explicitly keeps real places in the dataset instead of quietly
 * discarding them along with the genuine aggregates.
 *
 * Kosovo has no ISO 3166-1 numeric code, so it will appear in tables and
 * rankings but not on the globe. That is a data limitation, stated plainly.
 */
const CODE_OVERRIDES: Record<string, string> = {
  OWID_KOS: "UNK",
};

export function owidUrl(slug: string): string {
  return `${BASE}/${slug}.csv?csvType=full`;
}

/**
 * Ingest one OWID grapher dataset.
 *
 * OWID publishes ISO3 in a `Code` column, so no name matching is needed here —
 * that is why the crosswalk risk shrank after the V0 probe. Rows whose `Code`
 * is an OWID aggregate (`OWID_WRL`, `OWID_EUR`, …) are skipped by design.
 */
export async function ingestOwid(
  ds: OwidDataset,
  opts: FetchOptions = {},
): Promise<IngestResult> {
  const text = await fetchCsv(ds.slug, owidUrl(ds.slug), opts);
  const rows = parseCsv(text);
  if (rows.length === 0) throw new Error(`[${ds.slug}] parsed zero rows`);

  const headers = Object.keys(rows[0]!);

  let valueColumn = ds.valueColumn;
  if (!headers.includes(valueColumn)) {
    const detected = headers.find((h) => !ID_COLUMNS.has(h));
    if (!detected) {
      throw new Error(
        `[${ds.slug}] no value column found. Headers: ${headers.join(", ")}`,
      );
    }
    console.warn(
      `  ! [${ds.slug}] expected value column "${ds.valueColumn}" is gone; ` +
        `falling back to "${detected}". Update the dataset config.`,
    );
    valueColumn = detected;
  }
  if (!headers.includes(ds.periodColumn)) {
    throw new Error(
      `[${ds.slug}] missing period column "${ds.periodColumn}". Headers: ${headers.join(", ")}`,
    );
  }

  const metrics: MetricRow[] = [];
  const skippedAggregates = new Set<string>();
  const unresolved = new Set<string>();
  const seen = new Set<string>();
  const countries = new Set<string>();
  const periods = new Set<string>();

  for (const row of rows) {
    const entity = (row["Entity"] ?? "").trim();
    const rawCode = (row["Code"] ?? "").trim();
    const code = CODE_OVERRIDES[rawCode] ?? rawCode;
    const period = (row[ds.periodColumn] ?? "").trim();
    if (!period) continue;

    // OWID aggregates carry an OWID_* pseudo-code; they are not countries.
    if (!code || code.startsWith("OWID_")) {
      skippedAggregates.add(entity || code || "(blank)");
      continue;
    }

    const resolved = resolveCountry(code);
    if (!resolved.ok) {
      unresolved.add(`${entity} [${code}]`);
      continue;
    }
    const iso3 = resolved.iso3;

    const push = (metricKey: string, rawValue: string | undefined) => {
      if (rawValue === undefined || rawValue.trim() === "") return;
      const value = Number(rawValue);
      if (!Number.isFinite(value)) return;
      const dedupe = `${iso3}|${metricKey}|${period}`;
      if (seen.has(dedupe)) return;
      seen.add(dedupe);
      metrics.push({ countryIso3: iso3, metricKey, period, value });
    };

    push(ds.metricKey, row[valueColumn]);
    for (const extra of ds.extraMetrics ?? []) {
      push(extra.metricKey, row[extra.column]);
    }

    countries.add(iso3);
    periods.add(period);
  }

  if (metrics.length === 0) {
    throw new Error(`[${ds.slug}] produced zero metric rows — upstream shape changed?`);
  }

  return {
    sourceId: ds.slug,
    metrics,
    countries: [...countries].sort(),
    periods: [...periods].sort(),
    skippedAggregates: [...skippedAggregates].sort(),
    unresolved: [...unresolved].sort(),
  };
}

/** The three confirmed country-level OWID layers. Do not re-guess these slugs. */
export const OWID_DATASETS: OwidDataset[] = [
  {
    slug: "estimated-share-people-generative-ai",
    metricKey: "adoption.genai_share",
    valueColumn: "Estimated share of working-age adults who use generative AI",
    periodColumn: "Day",
    extraMetrics: [{ column: "GDP per capita", metricKey: "context.gdp_per_capita" }],
  },
  {
    slug: "private-investment-in-artificial-intelligence-cset",
    metricKey: "investment.private_ai_usd",
    valueColumn: "Estimated funding raised by privately held AI companies - Field: All",
    periodColumn: "Year",
  },
  {
    slug: "annual-scholarly-publications-on-artificial-intelligence",
    metricKey: "research.ai_publications",
    valueColumn: "AI scholarly publications - Field: All",
    periodColumn: "Year",
  },
];

/** Provenance rows written to the `sources` table. */
export const OWID_SOURCES: SourceDef[] = [
  {
    id: "estimated-share-people-generative-ai",
    name: "Our World in Data — Estimated share of adults using generative AI",
    url: `${BASE}/estimated-share-people-generative-ai`,
    license: "CC BY 4.0",
    originator: "Microsoft AI Economy Institute (AI Diffusion Report)",
    cadence: "quarterly",
    notes:
      "Republication of the Microsoft AI Diffusion series with ISO3 codes. " +
      "Verified identical to microsoft/ai-diffusion-report on 2026-08-24.",
  },
  {
    id: "private-investment-in-artificial-intelligence-cset",
    name: "Our World in Data — Private investment in AI",
    url: `${BASE}/private-investment-in-artificial-intelligence-cset`,
    license: "CC BY 4.0",
    originator: "CSET / Georgetown University",
    cadence: "annual",
    notes: "Estimated funding raised by privately held AI companies, USD.",
  },
  {
    id: "annual-scholarly-publications-on-artificial-intelligence",
    name: "Our World in Data — Annual scholarly publications on AI",
    url: `${BASE}/annual-scholarly-publications-on-artificial-intelligence`,
    license: "CC BY 4.0",
    originator: "CSET / Stanford AI Index",
    cadence: "annual",
  },
];
