import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DOMParser } from "@xmldom/xmldom";
import { describe, expect, it } from "vitest";

const SVG_PATH = join(process.cwd(), "src/app/icon.svg");

/**
 * The favicon is served as image/svg+xml, which browsers parse as strict XML —
 * unlike the lenient HTML parser used when an SVG is inlined into a page.
 *
 * This bit once: the comments named the design tokens directly (--bg-base,
 * --accent), and a double hyphen is illegal inside an XML comment. The file
 * rendered perfectly in every HTML preview and silently failed to appear as a
 * favicon, because browsers just drop an SVG that will not parse.
 */
describe("app icon", () => {
  const source = readFileSync(SVG_PATH, "utf8");

  it("is well-formed XML", () => {
    const errors: string[] = [];
    const doc = new DOMParser({
      onError: (_level, message) => errors.push(String(message)),
    }).parseFromString(source, "image/svg+xml");

    expect(errors).toEqual([]);
    expect(doc.documentElement?.nodeName).toBe("svg");
  });

  it("has no double hyphen inside a comment", () => {
    // Strip the delimiters, then anything left containing "--" is illegal.
    const bodies = [...source.matchAll(/<!--([\s\S]*?)-->/g)].map((m) => m[1] ?? "");
    const offenders = bodies.filter((b) => b.includes("--"));
    expect(offenders).toEqual([]);
  });

  it("declares an intrinsic size as well as a viewBox", () => {
    // Some browsers refuse an SVG favicon that only carries a viewBox.
    expect(source).toMatch(/width="32"/);
    expect(source).toMatch(/height="32"/);
    expect(source).toMatch(/viewBox="0 0 32 32"/);
  });
});
