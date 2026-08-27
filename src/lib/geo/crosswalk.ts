import crosswalkData from "../../../data/seed/country-crosswalk.json";
import { normalizeName, tokenKey } from "./normalize";

export interface CountryEntry {
  iso3: string;
  iso2: string;
  isoNumeric: string | null;
  name: string;
  officialName: string;
  region: string | null;
  subregion: string | null;
  lat: number;
  lng: number;
  aliases: string[];
}

export interface Crosswalk {
  generatedAt: string;
  countries: CountryEntry[];
  /** Names that are deliberately not countries (aggregates, sentinels). */
  nonCountries: string[];
  /** Token keys dropped for being ambiguous across two or more countries. */
  ambiguousTokenKeys: string[];
}

const data = crosswalkData as unknown as Crosswalk;

export const COUNTRIES: readonly CountryEntry[] = data.countries;

const byIso3 = new Map(COUNTRIES.map((c) => [c.iso3, c]));
const byNumeric = new Map(
  COUNTRIES.filter((c) => c.isoNumeric !== null).map((c) => [c.isoNumeric!, c]),
);

const exactIndex = new Map<string, string>();
for (const c of COUNTRIES) {
  for (const alias of c.aliases) exactIndex.set(normalizeName(alias), c.iso3);
}

const ambiguous = new Set(data.ambiguousTokenKeys);
const tokenIndex = new Map<string, string>();
for (const c of COUNTRIES) {
  for (const alias of c.aliases) {
    const key = tokenKey(alias);
    if (!key || ambiguous.has(key)) continue;
    tokenIndex.set(key, c.iso3);
  }
}

const nonCountries = new Set(data.nonCountries.map(normalizeName));

export function getByIso3(iso3: string): CountryEntry | undefined {
  return byIso3.get(iso3.toUpperCase());
}

/** The globe's TopoJSON keys on ISO 3166-1 numeric, so this bridge is required. */
export function getByNumeric(numeric: string | number): CountryEntry | undefined {
  return byNumeric.get(String(numeric).padStart(3, "0"));
}

/** True for known aggregates and sentinels ("World", "Europe", "Multinational"). */
export function isNonCountry(name: string): boolean {
  return nonCountries.has(normalizeName(name));
}

export type ResolveResult =
  | { ok: true; iso3: string; via: "iso3" | "exact" | "token" }
  | { ok: false; reason: "non-country" | "unmatched" };

/**
 * Resolve a free-text country name (or an ISO3 code) to ISO3.
 *
 * Deliberately returns a result object rather than throwing: callers decide
 * whether an unmatched name is fatal. Ingest treats it as fatal — see
 * `resolveOrThrow`.
 */
export function resolveCountry(input: string): ResolveResult {
  const raw = input.trim();
  if (!raw) return { ok: false, reason: "unmatched" };

  if (/^[A-Za-z]{3}$/.test(raw) && byIso3.has(raw.toUpperCase())) {
    return { ok: true, iso3: raw.toUpperCase(), via: "iso3" };
  }
  if (isNonCountry(raw)) return { ok: false, reason: "non-country" };

  const exact = exactIndex.get(normalizeName(raw));
  if (exact) return { ok: true, iso3: exact, via: "exact" };

  const token = tokenIndex.get(tokenKey(raw));
  if (token) return { ok: true, iso3: token, via: "token" };

  return { ok: false, reason: "unmatched" };
}

/**
 * Ingest-side resolver. Throws on an unmatched name so a bad upstream rename
 * fails the pipeline loudly instead of silently shrinking the map.
 */
export function resolveOrThrow(input: string, context: string): string {
  const r = resolveCountry(input);
  if (r.ok) return r.iso3;
  if (r.reason === "non-country") {
    throw new Error(
      `[${context}] "${input}" is a known non-country aggregate; filter it before resolving.`,
    );
  }
  throw new Error(
    `[${context}] Could not resolve country "${input}". ` +
      `Add an alias in scripts/ingest/build-crosswalk.ts (MANUAL_ALIASES) ` +
      `or list it in NON_COUNTRIES, then re-run "pnpm ingest:crosswalk".`,
  );
}
