export interface MetricRow {
  countryIso3: string;
  metricKey: string;
  period: string;
  value: number;
}

export interface ModelRow {
  id: string;
  name: string;
  organization: string | null;
  countryIso3: string | null;
  countries: string[];
  publicationDate: string | null;
  domain: string | null;
  parameters: number | null;
  trainingComputeFlop: number | null;
  link: string | null;
  sourceId: string;
}

export interface SourceDef {
  id: string;
  name: string;
  url: string;
  license: string;
  originator?: string;
  cadence?: string;
  notes?: string;
}

export interface IngestResult {
  sourceId: string;
  metrics: MetricRow[];
  /** Distinct ISO3 codes produced. */
  countries: string[];
  /** Distinct period keys produced, sorted. */
  periods: string[];
  /** Entities intentionally excluded (aggregates like "World", "Europe"). */
  skippedAggregates: string[];
  /** Entities that looked like countries but did not resolve. Must stay empty. */
  unresolved: string[];
  /** Optional payload for sources that also emit models. */
  models?: ModelRow[];
}
