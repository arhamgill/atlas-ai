/**
 * Post-ingest verification: what actually landed in Postgres.
 *
 *   pnpm ingest:report
 *
 * Includes a hard integrity check against three figures verified by hand
 * against the Microsoft AI Diffusion CSV on 2026-08-24. If those three don't
 * match, the pipeline is wrong no matter how healthy the row counts look.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../src/lib/db/client";
import {
  countries,
  metricDefs,
  metrics,
  models,
  rankings,
  sources,
} from "../../src/lib/db/schema";

/** country iso3 -> expected adoption % at 2026-03-31 (Microsoft Q1 2026). */
const INTEGRITY_CHECKS: [string, number][] = [
  ["ARE", 70.1],
  ["SGP", 63.4],
  ["NOR", 48.6],
  ["IRL", 48.4],
  ["FRA", 47.8],
];

function fmt(n: number | string): string {
  return Number(n).toLocaleString("en-US");
}

async function main() {
  console.log("AI Atlas — ingest report\n");

  const [counts] = await db
    .select({
      countries: sql<number>`(select count(*) from ${countries})`,
      sources: sql<number>`(select count(*) from ${sources})`,
      metricDefs: sql<number>`(select count(*) from ${metricDefs})`,
      metrics: sql<number>`(select count(*) from ${metrics})`,
      rankings: sql<number>`(select count(*) from ${rankings})`,
      models: sql<number>`(select count(*) from ${models})`,
    })
    .from(sql`(select 1) as _`);

  console.log("Row counts");
  for (const [k, v] of Object.entries(counts ?? {})) {
    console.log(`  ${k.padEnd(12)} ${fmt(v as number).padStart(8)}`);
  }

  // --- Per-metric coverage ------------------------------------------------
  const perMetric = await db
    .select({
      key: metricDefs.key,
      layer: metricDefs.layer,
      unit: metricDefs.unit,
      countries: sql<number>`count(distinct ${metrics.countryIso3})`,
      periods: sql<number>`count(distinct ${metrics.period})`,
      rows: sql<number>`count(*)`,
      minPeriod: sql<string>`min(${metrics.period})`,
      maxPeriod: sql<string>`max(${metrics.period})`,
    })
    .from(metricDefs)
    .leftJoin(metrics, eq(metrics.metricKey, metricDefs.key))
    .groupBy(metricDefs.key, metricDefs.layer, metricDefs.unit)
    .orderBy(metricDefs.key);

  console.log("\nPer-metric coverage");
  for (const m of perMetric) {
    console.log(
      `  ${m.key.padEnd(30)} ${String(m.countries).padStart(4)} countries · ` +
        `${String(m.periods).padStart(2)} periods (${m.minPeriod}…${m.maxPeriod}) · ` +
        `${fmt(m.rows).padStart(6)} rows · ${m.layer ?? "context"}`,
    );
  }

  // --- Integrity check ----------------------------------------------------
  console.log("\nIntegrity check — adoption at 2026-03-31 vs Microsoft source");
  let failures = 0;
  for (const [iso3, expected] of INTEGRITY_CHECKS) {
    const [row] = await db
      .select({ value: metrics.value, rank: rankings.rank })
      .from(metrics)
      .leftJoin(
        rankings,
        and(
          eq(rankings.countryIso3, metrics.countryIso3),
          eq(rankings.metricKey, metrics.metricKey),
          eq(rankings.period, metrics.period),
        ),
      )
      .where(
        and(
          eq(metrics.countryIso3, iso3),
          eq(metrics.metricKey, "adoption.genai_share"),
          eq(metrics.period, "2026-03-31"),
        ),
      );

    const actual = row?.value;
    const ok = actual !== undefined && Math.abs(actual - expected) < 0.05;
    if (!ok) failures++;
    console.log(
      `  ${ok ? "PASS" : "FAIL"}  ${iso3}  expected ${expected}  got ${actual ?? "(missing)"}` +
        `${row?.rank ? `  rank #${row.rank}` : ""}`,
    );
  }

  // --- Fastest rising (the Trends hero, on real deltas) -------------------
  const risers = await db
    .select({
      iso3: rankings.countryIso3,
      name: countries.name,
      rank: rankings.rank,
      prevRank: rankings.prevRank,
      delta: rankings.delta,
    })
    .from(rankings)
    .innerJoin(countries, eq(countries.iso3, rankings.countryIso3))
    .where(
      and(
        eq(rankings.metricKey, "adoption.genai_share"),
        eq(rankings.period, "2026-03-31"),
      ),
    )
    .orderBy(sql`${rankings.delta} desc nulls last`)
    .limit(5);

  console.log("\nFastest rising — adoption rank, H2 2025 → Q1 2026");
  for (const r of risers) {
    console.log(
      `  ${r.name.padEnd(24)} #${String(r.prevRank).padStart(3)} → #${String(r.rank).padStart(3)}` +
        `  (${r.delta !== null && r.delta > 0 ? "+" : ""}${r.delta})`,
    );
  }

  // --- Countries with no data at all --------------------------------------
  const [orphans] = await db
    .select({ n: sql<number>`count(*)` })
    .from(countries)
    .where(
      sql`not exists (select 1 from ${metrics} m where m.country_iso3 = ${countries.iso3})`,
    );

  console.log(
    `\nCountries in reference table with zero metrics: ${orphans?.n ?? 0} of ${counts?.countries ?? 0}`,
  );
  console.log(
    "  (expected — the crosswalk carries all 250 ISO entities incl. territories)",
  );

  // --- Provenance ---------------------------------------------------------
  const srcs = await db
    .select({
      id: sources.id,
      license: sources.license,
      originator: sources.originator,
      retrievedAt: sources.retrievedAt,
    })
    .from(sources)
    .orderBy(sources.id);

  console.log("\nSources");
  for (const s of srcs) {
    console.log(
      `  ${s.id.padEnd(52)} ${s.license.padEnd(10)} ${s.retrievedAt.toISOString().slice(0, 10)}`,
    );
    if (s.originator) console.log(`    originator: ${s.originator}`);
  }

  if (failures > 0) {
    console.error(`\n${failures} integrity check(s) FAILED — the pipeline is wrong.`);
    process.exit(1);
  }
  console.log("\nAll integrity checks passed.");
}

main().catch((err: unknown) => {
  console.error("Report failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
