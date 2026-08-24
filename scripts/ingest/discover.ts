/**
 * Find country-level OWID charts without guessing slugs.
 *
 *   pnpm ingest:discover -- "AI patents"
 *
 * Built after the V0 probe, where four of seven hand-guessed slugs turned out
 * to be wrong (two 404, two global-only). OWID's search endpoint returns an
 * `availableEntities` array per chart; testing it for real country names is a
 * reliable one-request check for whether a chart is country-level.
 */
const PROBE_COUNTRIES = [
  "United States",
  "Germany",
  "India",
  "Brazil",
  "Japan",
  "Kenya",
  "France",
  "Indonesia",
];

interface SearchResult {
  title: string;
  slug: string;
  subtitle?: string;
  availableEntities?: string[];
}

async function search(query: string): Promise<SearchResult[]> {
  const url = `https://ourworldindata.org/api/search?q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OWID search failed: HTTP ${res.status}`);
  const json = (await res.json()) as { results?: SearchResult[] };
  return json.results ?? [];
}

async function main() {
  const query = process.argv
    .slice(2)
    .filter((a) => a !== "--")
    .join(" ")
    .trim();
  if (!query) {
    console.error('Usage: pnpm ingest:discover -- "<search terms>"');
    process.exit(1);
  }

  console.log(`OWID chart search: "${query}"\n`);
  const results = await search(query);
  if (results.length === 0) {
    console.log("No results.");
    return;
  }

  const scored = results.map((r) => {
    const entities = r.availableEntities ?? [];
    const hits = PROBE_COUNTRIES.filter((c) => entities.includes(c)).length;
    return { ...r, entities: entities.length, hits };
  });

  const countryLevel = scored.filter((r) => r.hits >= 5);
  const other = scored.filter((r) => r.hits < 5);

  console.log(`COUNTRY-LEVEL (${countryLevel.length}) — usable as a globe layer`);
  for (const r of countryLevel) {
    console.log(`  ${r.slug}`);
    console.log(`    ${r.title}`);
    console.log(`    ${r.entities} entities`);
    console.log(`    https://ourworldindata.org/grapher/${r.slug}.csv?csvType=full`);
  }

  console.log(`\nNOT COUNTRY-LEVEL (${other.length}) — context charts only`);
  for (const r of other) {
    const sample = (r.availableEntities ?? []).slice(0, 3).join(", ");
    console.log(`  ${r.slug}  [${r.entities} entities: ${sample}…]`);
  }
}

main().catch((err: unknown) => {
  console.error("Discovery failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
