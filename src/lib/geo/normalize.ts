/**
 * Country-name normalization shared by the crosswalk builder and the resolver.
 * Kept in its own module so both sides are guaranteed to agree — a builder and
 * a resolver that normalize differently is a silent-miss factory.
 */

/** Lowercase, strip diacritics and punctuation, collapse whitespace. */
export function normalizeName(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // combining marks
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[.,'’`()\[\]\-–—/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Order-insensitive key: normalized tokens sorted alphabetically, with
 * grammatical filler removed. Lets "Korea (Republic of)" match
 * "Republic of Korea" without hand-writing an alias for every permutation.
 *
 * Used only as a *fallback* after exact normalized matching fails, and any
 * key that would be ambiguous is dropped at build time.
 */
const FILLER = new Set(["of", "the", "and", "de", "del", "la", "le"]);

export function tokenKey(input: string): string {
  return normalizeName(input)
    .split(" ")
    .filter((t) => t.length > 0 && !FILLER.has(t))
    .sort()
    .join(" ");
}
