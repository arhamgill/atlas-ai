/**
 * Ingest orchestrator: fetch -> validate -> resolve -> upsert.
 *
 *   pnpm ingest              full run against DATABASE_URL
 *   pnpm ingest -- --dry-run fetch + resolve + report, write nothing
 *   pnpm ingest -- --offline reuse committed snapshots, no network
 *
 * Fails loudly. An unresolved country name or a vanished upstream column is a
 * hard error, never a silent drop — a quietly shrinking map is the one failure
 * mode that looks fine right up until someone checks.
 */
import { sql } from "drizzle-orm";
import { db } from "../../src/lib/db/client";
import {
  countries as countriesTable,
  metricDefs,
  metrics as metricsTable,
  models as modelsTable,
  rankings as rankingsTable,
  sources as sourcesTable,
} from "../../src/lib/db/schema";
import { COUNTRIES } from "../../src/lib/geo/crosswalk";
import { METRIC_DEFS } from "../../src/lib/metrics/registry";
import { computeRankings } from "./compute-rankings";
import { EPOCH_SOURCE, ingestEpoch } from "./sources/epoch";
import { OWID_DATASETS, OWID_SOURCES, ingestOwid } from "./sources/owid";
import type { IngestResult, MetricRow, ModelRow } from "./types";

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const OFFLINE = args.has("--offline");

/** Neon's HTTP driver takes one round trip per statement; batch to stay fast. */
const CHUNK = 500;

async function insertChunked<T>(
  label: string,
  rows: T[],
  insert: (batch: T[]) => Promise<unknown>,
): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    await insert(batch);
    const done = Math.min(i + CHUNK, rows.length);
    process.stdout.write(`\r  ${label}: ${done}/${rows.length}`);
  }
  if (rows.length) process.stdout.write("\n");
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

async function main() {
  const t0 = Date.now();
  console.log(
    `AI Atlas ingest${DRY_RUN ? " (DRY RUN — nothing will be written)" : ""}` +
      `${OFFLINE ? " [offline: using committed snapshots]" : ""}\n`,
  );

  // --- Fetch + resolve ---------------------------------------------------
  console.log("Fetching sources");
  const results: IngestResult[] = [];
  for (const ds of OWID_DATASETS) {
    const r = await ingestOwid(ds, { offline: OFFLINE });
    results.push(r);
    console.log(
      `  ok  ${ds.slug}\n` +
        `      ${fmt(r.metrics.length)} rows · ${r.countries.length} countries · ` +
        `${r.periods.length} periods (${r.periods[0]} … ${r.periods.at(-1)})`,
    );
  }
  const epoch = await ingestEpoch({ offline: OFFLINE });
  results.push(epoch);
  console.log(
    `  ok  ${epoch.sourceId}\n` +
      `      ${fmt(epoch.models?.length ?? 0)} models · ${epoch.countries.length} countries · ` +
      `${epoch.periods.length} periods (${epoch.periods[0]} … ${epoch.periods.at(-1)})`,
  );

  // --- Integrity gate ----------------------------------------------------
  const unresolved = results.flatMap((r) =>
    r.unresolved.map((u) => `${r.sourceId}: ${u}`),
  );
  if (unresolved.length) {
    console.error(`\nFATAL — ${unresolved.length} unresolved country name(s):`);
    for (const u of unresolved) console.error(`  ${u}`);
    console.error(
      "\nAdd aliases to MANUAL_ALIASES (or NON_COUNTRIES) in " +
        "scripts/ingest/build-crosswalk.ts, re-run `pnpm ingest:crosswalk`, then retry.",
    );
    process.exit(1);
  }

  const allMetrics: MetricRow[] = results.flatMap((r) => r.metrics);
  const allModels: ModelRow[] = results.flatMap((r) => r.models ?? []);

  const definedKeys = new Set(METRIC_DEFS.map((m) => m.key));
  const orphanKeys = [...new Set(allMetrics.map((m) => m.metricKey))].filter(
    (k) => !definedKeys.has(k),
  );
  if (orphanKeys.length) {
    console.error(`\nFATAL — metric keys with no definition: ${orphanKeys.join(", ")}`);
    console.error("Add them to METRIC_DEFS in src/lib/metrics/registry.ts.");
    process.exit(1);
  }

  const rankings = computeRankings(allMetrics);

  // --- Coverage summary --------------------------------------------------
  console.log("\nCoverage");
  const usedCountries = new Set(allMetrics.map((m) => m.countryIso3));
  for (const def of METRIC_DEFS) {
    const rows = allMetrics.filter((m) => m.metricKey === def.key);
    const c = new Set(rows.map((m) => m.countryIso3)).size;
    const p = new Set(rows.map((m) => m.period)).size;
    const layer = def.layer ? `layer:${def.layer}` : "context";
    console.log(
      `  ${def.key.padEnd(30)} ${String(c).padStart(4)} countries · ` +
        `${String(p).padStart(2)} periods · ${fmt(rows.length).padStart(7)} rows · ${layer}`,
    );
  }
  console.log(
    `\n  metric rows ${fmt(allMetrics.length)} · rankings ${fmt(rankings.length)} · ` +
      `models ${fmt(allModels.length)} · distinct countries ${usedCountries.size}`,
  );

  const skipped = [...new Set(results.flatMap((r) => r.skippedAggregates))];
  if (skipped.length) {
    console.log(
      `\n  Excluded as non-countries (${skipped.length}): ${skipped.join(", ")}`,
    );
  }

  if (DRY_RUN) {
    console.log(`\nDry run complete in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
    return;
  }

  // --- Write -------------------------------------------------------------
  console.log("\nWriting to Postgres");

  // Truncate in FK-safe order; ingest is idempotent by design.
  await db.execute(
    sql`truncate table ${rankingsTable}, ${metricsTable}, ${modelsTable} restart identity cascade`,
  );

  const sourceRows = [...OWID_SOURCES, EPOCH_SOURCE].map((s) => ({
    id: s.id,
    name: s.name,
    url: s.url,
    license: s.license,
    originator: s.originator ?? null,
    cadence: s.cadence ?? null,
    notes: s.notes ?? null,
    retrievedAt: new Date(),
  }));
  await db
    .insert(sourcesTable)
    .values(sourceRows)
    .onConflictDoUpdate({
      target: sourcesTable.id,
      set: {
        name: sql`excluded.name`,
        url: sql`excluded.url`,
        license: sql`excluded.license`,
        originator: sql`excluded.originator`,
        cadence: sql`excluded.cadence`,
        notes: sql`excluded.notes`,
        retrievedAt: sql`excluded.retrieved_at`,
      },
    });
  console.log(`  sources: ${sourceRows.length}`);

  const countryRows = COUNTRIES.map((c) => ({
    iso3: c.iso3,
    iso2: c.iso2,
    isoNumeric: c.isoNumeric,
    name: c.name,
    officialName: c.officialName,
    region: c.region,
    subregion: c.subregion,
    lat: c.lat,
    lng: c.lng,
  }));
  await insertChunked("countries", countryRows, (batch) =>
    db
      .insert(countriesTable)
      .values(batch)
      .onConflictDoUpdate({
        target: countriesTable.iso3,
        set: {
          iso2: sql`excluded.iso2`,
          isoNumeric: sql`excluded.iso_numeric`,
          name: sql`excluded.name`,
          officialName: sql`excluded.official_name`,
          region: sql`excluded.region`,
          subregion: sql`excluded.subregion`,
          lat: sql`excluded.lat`,
          lng: sql`excluded.lng`,
        },
      }),
  );

  const defRows = METRIC_DEFS.map((m) => ({
    key: m.key,
    label: m.label,
    shortLabel: m.shortLabel,
    description: m.description,
    unit: m.unit,
    precision: m.precision,
    higherIsBetter: m.higherIsBetter,
    layer: m.layer,
    periodType: m.periodType,
    sourceId: m.sourceId,
    methodologyNote: m.methodologyNote ?? null,
  }));
  await db
    .insert(metricDefs)
    .values(defRows)
    .onConflictDoUpdate({
      target: metricDefs.key,
      set: {
        label: sql`excluded.label`,
        shortLabel: sql`excluded.short_label`,
        description: sql`excluded.description`,
        unit: sql`excluded.unit`,
        precision: sql`excluded.precision`,
        higherIsBetter: sql`excluded.higher_is_better`,
        layer: sql`excluded.layer`,
        periodType: sql`excluded.period_type`,
        sourceId: sql`excluded.source_id`,
        methodologyNote: sql`excluded.methodology_note`,
      },
    });
  console.log(`  metric_defs: ${defRows.length}`);

  await insertChunked("metrics", allMetrics, (batch) =>
    db.insert(metricsTable).values(batch),
  );
  await insertChunked("rankings", rankings, (batch) =>
    db.insert(rankingsTable).values(batch),
  );
  await insertChunked("models", allModels, (batch) =>
    db.insert(modelsTable).values(batch),
  );

  console.log(`\nIngest complete in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
  console.log("Run `pnpm ingest:report` to verify what landed.");
}

main().catch((err: unknown) => {
  console.error("\nIngest failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
