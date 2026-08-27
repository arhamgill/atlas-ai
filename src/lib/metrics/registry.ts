import type { LayerKey, PeriodType } from "../db/schema";

export interface MetricDef {
  key: string;
  label: string;
  shortLabel: string;
  description: string;
  unit: "percent" | "usd" | "count";
  precision: number;
  higherIsBetter: boolean;
  /** Null = context metric, not a globe layer. */
  layer: LayerKey | null;
  periodType: PeriodType;
  sourceId: string;
  methodologyNote?: string;
  /**
   * How the time series collapses to the single figure shown on the globe, in
   * the country table and as a country's headline number.
   *
   * "latest" suits a stock measure. "total" exists for development, where
   * releases are lumpy and the newest period is a partial year — at the time
   * of writing only four countries had shipped a notable model in 2026, so
   * "latest" reported China as 24 with a rank of 2 of 4 rather than its actual
   * 184 all-time. The meaningful question there is "who has ever built
   * frontier AI?".
   */
  aggregation: "latest" | "total";
}

/**
 * The metric registry. Adding a globe layer means adding an entry here plus an
 * ingest source — no schema migration, no component change, because `metrics`
 * is stored tall and the layer switcher reads these definitions at runtime.
 */
export const METRIC_DEFS: MetricDef[] = [
  {
    key: "adoption.genai_share",
    label: "Generative AI adoption",
    shortLabel: "Adoption",
    description:
      "Estimated share of working-age adults who use generative AI, by country.",
    unit: "percent",
    precision: 1,
    higherIsBetter: true,
    layer: "adoption",
    periodType: "quarter",
    sourceId: "estimated-share-people-generative-ai",
    aggregation: "latest",
    methodologyNote:
      "Microsoft AI Economy Institute estimates, republished by Our World in Data " +
      "with ISO3 codes. Covers 147 countries across three periods. " +
      "IMPORTANT: values are modelled, and low-data countries are imputed in " +
      "regional blocks — 12 West African countries share exactly 10.1% and the " +
      "four Guianas share exactly 10.3%. Rank movements inside those blocks are " +
      "artefacts of the model, not independent national trends.",
  },
  {
    key: "investment.private_ai_usd",
    label: "Private AI investment",
    shortLabel: "Investment",
    description: "Estimated funding raised by privately held AI companies, in USD.",
    unit: "usd",
    precision: 0,
    higherIsBetter: true,
    layer: "investment",
    periodType: "annual",
    sourceId: "private-investment-in-artificial-intelligence-cset",
    aggregation: "latest",
    methodologyNote:
      "CSET estimates. Covers 119 countries, 2016–2025. Absolute totals, not " +
      "population-adjusted — small economies rank low by construction.",
  },
  {
    key: "research.ai_publications",
    label: "AI scholarly publications",
    shortLabel: "Research",
    description: "Annual count of scholarly publications on artificial intelligence.",
    unit: "count",
    precision: 0,
    higherIsBetter: true,
    layer: "research",
    periodType: "annual",
    sourceId: "annual-scholarly-publications-on-artificial-intelligence",
    aggregation: "latest",
    methodologyNote:
      "Covers 190 countries, 2016–2024. Best country coverage in the project. " +
      "Includes Kosovo, which OWID codes as OWID_KOS and which has no ISO numeric — " +
      "it appears in tables and rankings but cannot be picked on the globe.",
  },
  {
    key: "development.notable_models",
    label: "Notable AI models released",
    shortLabel: "Development",
    description:
      "Count of notable AI models published per year, attributed to the country of " +
      "the developing organization.",
    unit: "count",
    precision: 0,
    higherIsBetter: true,
    layer: "development",
    periodType: "annual",
    sourceId: "epoch-notable-ai-models",
    aggregation: "total",
    methodologyNote:
      "Epoch AI. Only ~35 countries have ever produced a notable model, and the " +
      "United States and China dominate. Most of the map is legitimately no-data. " +
      "Models credited to several countries count once for each.",
  },
  {
    key: "context.gdp_per_capita",
    label: "GDP per capita",
    shortLabel: "GDP per capita",
    description: "GDP per capita, used to contextualise adoption rates.",
    unit: "usd",
    precision: 0,
    higherIsBetter: true,
    layer: null,
    periodType: "quarter",
    sourceId: "estimated-share-people-generative-ai",
    aggregation: "latest",
  },
];

export const METRICS_BY_KEY = new Map(METRIC_DEFS.map((m) => [m.key, m]));

export const LAYER_METRICS = METRIC_DEFS.filter(
  (m): m is MetricDef & { layer: LayerKey } => m.layer !== null,
);

export function getMetric(key: string): MetricDef {
  const m = METRICS_BY_KEY.get(key);
  if (!m) throw new Error(`Unknown metric key "${key}". Add it to METRIC_DEFS.`);
  return m;
}
