import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parse } from "csv-parse/sync";

const SNAPSHOT_DIR = resolve(process.cwd(), "data/snapshots");
const MANIFEST = resolve(SNAPSHOT_DIR, "manifest.json");

type Manifest = Record<string, { url: string; retrievedAt: string; bytes: number }>;

function readManifest(): Manifest {
  if (!existsSync(MANIFEST)) return {};
  try {
    return JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest;
  } catch {
    return {};
  }
}

function writeManifest(m: Manifest) {
  mkdirSync(dirname(MANIFEST), { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + "\n", "utf8");
}

export interface FetchOptions {
  /** Reuse the committed snapshot instead of hitting the network. */
  offline?: boolean;
}

/**
 * Download a CSV, write it to data/snapshots/, and record its retrieval date.
 *
 * Snapshots are committed so a build is reproducible even if an upstream URL
 * moves — which, per the V0 probe, happens more often than you would hope.
 */
export async function fetchCsv(
  name: string,
  url: string,
  opts: FetchOptions = {},
): Promise<string> {
  const file = resolve(SNAPSHOT_DIR, `${name}.csv`);

  if (opts.offline) {
    if (!existsSync(file)) {
      throw new Error(`[${name}] offline mode but no snapshot at ${file}`);
    }
    return readFileSync(file, "utf8");
  }

  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(
      `[${name}] HTTP ${res.status} ${res.statusText} for ${url}\n` +
        `  If this is a 404 the upstream slug has moved. Use "pnpm ingest:discover" ` +
        `to find its replacement — do not guess.`,
    );
  }
  const text = await res.text();
  if (text.length < 50) throw new Error(`[${name}] suspiciously small response`);

  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  writeFileSync(file, text, "utf8");

  const manifest = readManifest();
  manifest[name] = {
    url,
    retrievedAt: new Date().toISOString(),
    bytes: Buffer.byteLength(text, "utf8"),
  };
  writeManifest(manifest);

  return text;
}

/** Parse CSV text into records keyed by header name. */
export function parseCsv(text: string): Record<string, string>[] {
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
  }) as Record<string, string>[];
}
