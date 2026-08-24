import { getMetric } from "../../src/lib/metrics/registry";
import type { MetricRow } from "./types";

export interface RankingRow {
  metricKey: string;
  period: string;
  countryIso3: string;
  rank: number;
  prevRank: number | null;
  delta: number | null;
  percentile: number;
}

/**
 * Precompute ranks, period-over-period deltas and percentiles.
 *
 * Done at ingest rather than per request so the rank-flow animation on the
 * Trends page doesn't cost a window function on every page view.
 *
 * Ties use competition ranking (1, 2, 2, 4) — the same convention a reader
 * expects from a league table.
 */
export function computeRankings(metrics: MetricRow[]): RankingRow[] {
  const byMetric = new Map<string, Map<string, MetricRow[]>>();
  for (const row of metrics) {
    const periods = byMetric.get(row.metricKey) ?? new Map<string, MetricRow[]>();
    const bucket = periods.get(row.period) ?? [];
    bucket.push(row);
    periods.set(row.period, bucket);
    byMetric.set(row.metricKey, periods);
  }

  const out: RankingRow[] = [];

  for (const [metricKey, periods] of byMetric) {
    const def = getMetric(metricKey);
    // Period keys are built to sort lexicographically within a metric
    // ("2024" or "2026-03-31"), so a plain sort gives chronological order.
    const ordered = [...periods.keys()].sort();
    let previous = new Map<string, number>();

    for (const period of ordered) {
      const rows = [...(periods.get(period) ?? [])].sort((a, b) =>
        def.higherIsBetter ? b.value - a.value : a.value - b.value,
      );

      const n = rows.length;
      const current = new Map<string, number>();
      let lastValue: number | null = null;
      let lastRank = 0;

      rows.forEach((row, i) => {
        const rank = lastValue !== null && row.value === lastValue ? lastRank : i + 1;
        lastValue = row.value;
        lastRank = rank;
        current.set(row.countryIso3, rank);

        const prevRank = previous.get(row.countryIso3) ?? null;
        out.push({
          metricKey,
          period,
          countryIso3: row.countryIso3,
          rank,
          prevRank,
          // Positive = climbing the table.
          delta: prevRank === null ? null : prevRank - rank,
          percentile: n <= 1 ? 1 : (n - rank) / (n - 1),
        });
      });

      previous = current;
    }
  }

  return out;
}
