import { describe, expect, it } from "vitest";
import {
  getByIso3,
  getByNumeric,
  isNonCountry,
  resolveCountry,
  resolveOrThrow,
} from "./crosswalk";
import { normalizeName, tokenKey } from "./normalize";

describe("normalizeName", () => {
  it("strips diacritics so Türkiye matches Turkiye", () => {
    expect(normalizeName("Türkiye")).toBe("turkiye");
    expect(normalizeName("Côte d'Ivoire")).toBe("cote d ivoire");
  });

  it("collapses punctuation and case", () => {
    expect(normalizeName("Korea, Rep.")).toBe("korea rep");
    expect(normalizeName("  Hong   Kong  ")).toBe("hong kong");
  });
});

describe("tokenKey", () => {
  it("is order-insensitive and drops grammatical filler", () => {
    expect(tokenKey("Korea (Republic of)")).toBe(tokenKey("Republic of Korea"));
  });

  it("does not conflate genuinely different countries", () => {
    expect(tokenKey("Republic of the Congo")).not.toBe(
      tokenKey("Democratic Republic of the Congo"),
    );
    expect(tokenKey("Guinea")).not.toBe(tokenKey("Equatorial Guinea"));
    expect(tokenKey("Niger")).not.toBe(tokenKey("Nigeria"));
  });
});

describe("resolveCountry", () => {
  it("passes ISO3 codes through", () => {
    expect(resolveCountry("USA")).toEqual({ ok: true, iso3: "USA", via: "iso3" });
    expect(resolveCountry("deu")).toEqual({ ok: true, iso3: "DEU", via: "iso3" });
  });

  // These are the exact strings Epoch AI emits — the only source in the
  // project that requires name resolution at all.
  it.each([
    ["United States of America", "USA"],
    ["United Kingdom of Great Britain and Northern Ireland", "GBR"],
    ["Korea (Republic of)", "KOR"],
    ["Hong Kong", "HKG"],
    ["Czechia", "CZE"],
    ["Russian Federation", "RUS"],
    ["Taiwan", "TWN"],
    ["United Arab Emirates", "ARE"],
    ["Saudi Arabia", "SAU"],
    ["Singapore", "SGP"],
    ["Israel", "ISR"],
    ["Switzerland", "CHE"],
    ["Finland", "FIN"],
    ["Denmark", "DNK"],
  ])("resolves Epoch name %s -> %s", (name, iso3) => {
    const r = resolveCountry(name);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.iso3).toBe(iso3);
  });

  it("recognises aggregates as non-countries rather than failing", () => {
    for (const agg of ["World", "Europe", "Multinational", "Asia"]) {
      expect(isNonCountry(agg)).toBe(true);
      expect(resolveCountry(agg)).toEqual({ ok: false, reason: "non-country" });
    }
  });

  it("returns unmatched for genuine nonsense", () => {
    expect(resolveCountry("Wakanda")).toEqual({ ok: false, reason: "unmatched" });
    expect(resolveCountry("")).toEqual({ ok: false, reason: "unmatched" });
  });

  it("never silently maps Niger to Nigeria", () => {
    const niger = resolveCountry("Niger");
    const nigeria = resolveCountry("Nigeria");
    expect(niger.ok && niger.iso3).toBe("NER");
    expect(nigeria.ok && nigeria.iso3).toBe("NGA");
  });
});

describe("resolveOrThrow", () => {
  it("throws with actionable guidance on an unmatched name", () => {
    expect(() => resolveOrThrow("Wakanda", "test")).toThrow(
      /Could not resolve country/,
    );
    expect(() => resolveOrThrow("Wakanda", "test")).toThrow(/MANUAL_ALIASES/);
  });

  it("throws distinctly when handed an aggregate", () => {
    expect(() => resolveOrThrow("World", "test")).toThrow(/non-country aggregate/);
  });
});

describe("numeric bridge (globe TopoJSON keys on ISO numeric)", () => {
  it("maps numeric ids to countries", () => {
    expect(getByNumeric("840")?.iso3).toBe("USA");
    expect(getByNumeric(276)?.iso3).toBe("DEU");
    expect(getByNumeric("4")?.iso3).toBe("AFG"); // zero-padding
  });

  it("does not invent a country for a missing numeric code", () => {
    // Kosovo has no ISO numeric; "000" must not resolve to it or anything else.
    expect(getByNumeric("000")).toBeUndefined();
    expect(getByIso3("UNK")?.isoNumeric).toBeNull();
  });
});
