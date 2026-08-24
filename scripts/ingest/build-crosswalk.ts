/**
 * Generates data/seed/country-crosswalk.json — the single source of truth for
 * country identity across four different ID systems:
 *
 *   OWID          -> ISO3 in a `Code` column
 *   Epoch AI      -> official ISO 3166 long-form names
 *   world-atlas   -> ISO 3166-1 NUMERIC ids (this is why the numeric bridge exists)
 *   curated data  -> whatever we type by hand
 *
 * Run with: pnpm ingest:crosswalk
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import worldCountries from "world-countries";
import { normalizeName, tokenKey } from "../../src/lib/geo/normalize";

interface RawCountry {
  cca2: string;
  ccn3: string;
  cca3: string;
  name: { common: string; official: string };
  altSpellings: string[];
  region: string;
  subregion: string;
  latlng: [number, number];
}

/**
 * Names upstream sources use that world-countries does not list as a spelling.
 * Add here when ingest throws — never loosen the resolver instead.
 */
const MANUAL_ALIASES: Record<string, string[]> = {
  USA: ["United States of America", "United States", "US", "USA"],
  GBR: ["United Kingdom of Great Britain and Northern Ireland", "UK", "Great Britain"],
  KOR: ["Korea (Republic of)", "Korea, Rep.", "South Korea", "Republic of Korea"],
  PRK: [
    "Korea (Democratic People's Republic of)",
    "Korea, Dem. People's Rep.",
    "North Korea",
  ],
  RUS: ["Russian Federation"],
  IRN: ["Iran (Islamic Republic of)", "Iran, Islamic Rep."],
  VNM: ["Viet Nam"],
  TWN: ["Taiwan, Province of China", "Chinese Taipei"],
  HKG: ["Hong Kong SAR", "Hong Kong SAR, China", "Hong Kong, China"],
  MAC: ["Macao SAR, China", "Macau"],
  CZE: ["Czech Republic"],
  TUR: ["Turkiye", "Turkey"],
  COD: [
    "Democratic Republic of Congo",
    "Congo, Dem. Rep.",
    "DR Congo",
    "Congo-Kinshasa",
  ],
  COG: ["Congo, Rep.", "Republic of the Congo", "Congo-Brazzaville"],
  CIV: ["Cote d'Ivoire", "Ivory Coast"],
  SYR: ["Syrian Arab Republic"],
  LAO: ["Lao People's Democratic Republic", "Laos", "Lao PDR"],
  MDA: ["Moldova, Republic of", "Republic of Moldova"],
  TZA: ["Tanzania, United Republic of", "United Republic of Tanzania"],
  BOL: ["Bolivia (Plurinational State of)"],
  VEN: ["Venezuela (Bolivarian Republic of)", "Venezuela, RB"],
  BRN: ["Brunei Darussalam"],
  CPV: ["Cape Verde"],
  SWZ: ["Swaziland"],
  MKD: ["Macedonia", "Macedonia, FYR"],
  MMR: ["Burma"],
  PSE: ["Palestine, State of", "West Bank and Gaza", "State of Palestine"],
  EGY: ["Egypt, Arab Rep."],
  SVK: ["Slovak Republic"],
  KGZ: ["Kyrgyz Republic"],
  YEM: ["Yemen, Rep."],
  GMB: ["Gambia, The", "The Gambia"],
  BHS: ["Bahamas, The"],
  LCA: ["St. Lucia"],
  KNA: ["St. Kitts and Nevis"],
  VCT: ["St. Vincent and the Grenadines"],
  SXM: ["Sint Maarten (Dutch part)"],
  MAF: ["Saint Martin (French part)"],
  VGB: ["British Virgin Islands"],
  VIR: ["U.S. Virgin Islands", "Virgin Islands (U.S.)"],
  FSM: ["Micronesia (country)", "Micronesia, Fed. Sts."],
  TLS: ["East Timor"],
  CAF: ["Central African Rep."],
  ARE: ["UAE"],
};

/**
 * Aggregates and sentinels that must never resolve to a country. Anything
 * matched here is filtered *before* resolution rather than failing ingest.
 */
const NON_COUNTRIES = [
  "World",
  "Africa",
  "Asia",
  "Europe",
  "North America",
  "South America",
  "Oceania",
  "European Union",
  "European Union (27)",
  "Multinational",
  "High-income countries",
  "Upper-middle-income countries",
  "Lower-middle-income countries",
  "Low-income countries",
  "Academia",
  "Industry",
  "Other",
  "Academia and industry collaboration",
  "Merger/acquisition",
  "Minority stake",
  "Private investment",
  "Public offering",
  "Total",
];

function main() {
  const raw = worldCountries as unknown as RawCountry[];

  const countries = raw
    .filter((c) => c.cca3 && c.cca2 && Array.isArray(c.latlng) && c.latlng.length === 2)
    .map((c) => {
      const aliases = new Set<string>([
        c.name.common,
        c.name.official,
        c.cca3,
        ...(c.altSpellings ?? []),
        ...(MANUAL_ALIASES[c.cca3] ?? []),
      ]);
      // Two-letter altSpellings ("KR") are too collision-prone to index.
      for (const a of [...aliases]) if (a.length <= 2) aliases.delete(a);

      return {
        iso3: c.cca3,
        iso2: c.cca2,
        // No fabricated fallback: a country without ISO numeric cannot be
        // rendered on the world-atlas TopoJSON globe, and must say so.
        isoNumeric: /^\d{3}$/.test(c.ccn3 ?? "") ? c.ccn3 : null,
        name: c.name.common,
        officialName: c.name.official,
        region: c.region || null,
        subregion: c.subregion || null,
        lat: c.latlng[0],
        lng: c.latlng[1],
        aliases: [...aliases].sort(),
      };
    })
    .sort((a, b) => a.iso3.localeCompare(b.iso3));

  // --- Collision detection -------------------------------------------------
  const exactOwners = new Map<string, Set<string>>();
  const tokenOwners = new Map<string, Set<string>>();
  for (const c of countries) {
    for (const alias of c.aliases) {
      const e = normalizeName(alias);
      if (e) (exactOwners.get(e) ?? exactOwners.set(e, new Set()).get(e)!).add(c.iso3);
      const t = tokenKey(alias);
      if (t) (tokenOwners.get(t) ?? tokenOwners.set(t, new Set()).get(t)!).add(c.iso3);
    }
  }

  const exactCollisions = [...exactOwners.entries()].filter(([, o]) => o.size > 1);
  const ambiguousTokenKeys = [...tokenOwners.entries()]
    .filter(([, o]) => o.size > 1)
    .map(([k]) => k)
    .sort();

  const unknownAliasTargets = Object.keys(MANUAL_ALIASES).filter(
    (iso3) => !countries.some((c) => c.iso3 === iso3),
  );
  const missingNumeric = countries.filter((c) => c.isoNumeric === null);

  const payload = {
    generatedAt: new Date().toISOString().slice(0, 10),
    countries,
    nonCountries: NON_COUNTRIES,
    ambiguousTokenKeys,
  };

  const out = resolve(process.cwd(), "data/seed/country-crosswalk.json");
  writeFileSync(out, JSON.stringify(payload, null, 2) + "\n", "utf8");

  console.log(`crosswalk written        : ${out}`);
  console.log(`countries                : ${countries.length}`);
  console.log(`total aliases indexed    : ${exactOwners.size}`);
  console.log(
    `ambiguous token keys     : ${ambiguousTokenKeys.length} (dropped from fallback)`,
  );
  console.log(`non-country sentinels    : ${NON_COUNTRIES.length}`);

  if (exactCollisions.length) {
    console.log(
      `\nEXACT-NAME COLLISIONS (${exactCollisions.length}) — these need attention:`,
    );
    for (const [name, owners] of exactCollisions.slice(0, 15)) {
      console.log(`  "${name}" -> ${[...owners].join(", ")}`);
    }
  }
  if (unknownAliasTargets.length) {
    console.log(
      `\nMANUAL_ALIASES targets not in world-countries: ${unknownAliasTargets.join(", ")}`,
    );
  }
  if (missingNumeric.length) {
    console.log(
      `\nNo ISO numeric (will not be clickable on the globe): ` +
        missingNumeric.map((c) => `${c.iso3}(${c.name})`).join(", "),
    );
  }
}

main();
