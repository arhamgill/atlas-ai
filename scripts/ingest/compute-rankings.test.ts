import { describe, expect, it } from "vitest";
import { computeRankings } from "./compute-rankings";
import type { MetricRow } from "./types";

const KEY = "adoption.genai_share";

function row(countryIso3: string, period: string, value: number): MetricRow {
  return { countryIso3, metricKey: KEY, period, value };
}

describe("computeRankings", () => {
  it("ranks descending for higher-is-better metrics", () => {
    const out = computeRankings([
      row("AAA", "2026-03-31", 10),
      row("BBB", "2026-03-31", 30),
      row("CCC", "2026-03-31", 20),
    ]);
    const byCountry = Object.fromEntries(out.map((r) => [r.countryIso3, r.rank]));
    expect(byCountry).toEqual({ BBB: 1, CCC: 2, AAA: 3 });
  });

  it("uses competition ranking for ties (1, 2, 2, 4)", () => {
    const out = computeRankings([
      row("AAA", "2026-03-31", 50),
      row("BBB", "2026-03-31", 40),
      row("CCC", "2026-03-31", 40),
      row("DDD", "2026-03-31", 10),
    ]);
    const byCountry = Object.fromEntries(out.map((r) => [r.countryIso3, r.rank]));
    expect(byCountry).toEqual({ AAA: 1, BBB: 2, CCC: 2, DDD: 4 });
  });

  it("computes deltas across periods, positive meaning climbing", () => {
    const out = computeRankings([
      // Period 1: AAA #1, BBB #2
      row("AAA", "2025-12-31", 50),
      row("BBB", "2025-12-31", 40),
      // Period 2: BBB overtakes
      row("AAA", "2026-03-31", 45),
      row("BBB", "2026-03-31", 60),
    ]);
    const bbb = out.find((r) => r.countryIso3 === "BBB" && r.period === "2026-03-31");
    const aaa = out.find((r) => r.countryIso3 === "AAA" && r.period === "2026-03-31");
    expect(bbb).toMatchObject({ rank: 1, prevRank: 2, delta: 1 });
    expect(aaa).toMatchObject({ rank: 2, prevRank: 1, delta: -1 });
  });

  it("leaves prevRank and delta null in the first period", () => {
    const out = computeRankings([row("AAA", "2025-12-31", 10)]);
    expect(out[0]).toMatchObject({ prevRank: null, delta: null });
  });

  it("orders periods chronologically regardless of input order", () => {
    const out = computeRankings([
      row("AAA", "2026-03-31", 10),
      row("AAA", "2025-06-30", 30),
      row("AAA", "2025-12-31", 20),
      row("BBB", "2026-03-31", 5),
      row("BBB", "2025-06-30", 5),
      row("BBB", "2025-12-31", 5),
    ]);
    // AAA declines but stays #1 throughout, so prevRank is always 1 after the first.
    const first = out.find((r) => r.countryIso3 === "AAA" && r.period === "2025-06-30");
    const last = out.find((r) => r.countryIso3 === "AAA" && r.period === "2026-03-31");
    expect(first?.prevRank).toBeNull();
    expect(last?.prevRank).toBe(1);
  });

  it("gives percentile 1 to the best and 0 to the worst", () => {
    const out = computeRankings([
      row("AAA", "2026-03-31", 30),
      row("BBB", "2026-03-31", 20),
      row("CCC", "2026-03-31", 10),
    ]);
    expect(out.find((r) => r.countryIso3 === "AAA")?.percentile).toBe(1);
    expect(out.find((r) => r.countryIso3 === "CCC")?.percentile).toBe(0);
  });

  it("handles a single-country period without dividing by zero", () => {
    const out = computeRankings([row("AAA", "2026-03-31", 1)]);
    expect(out[0]?.percentile).toBe(1);
    expect(Number.isFinite(out[0]!.percentile)).toBe(true);
  });

  it("throws on an unregistered metric key rather than guessing direction", () => {
    expect(() =>
      computeRankings([
        { countryIso3: "AAA", metricKey: "made.up.metric", period: "2024", value: 1 },
      ]),
    ).toThrow(/Unknown metric key/);
  });
});
