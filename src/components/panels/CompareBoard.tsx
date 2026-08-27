"use client";

import Link from "next/link";
import { useQueryState } from "nuqs";
import { useMemo, useState } from "react";
import { Sparkline } from "@/components/charts/Sparkline";
import { layerColor } from "@/components/charts/primitives";
import type { CompareSeries, CountryTable as TableData } from "@/lib/db/queries";
import { formatMetric, formatPeriod } from "@/lib/metrics/scales";

const MAX = 4;
const DEFAULT = ["USA", "CHN", "DEU"];

/** Rank -> 0..1, where 1 is best. The only scale on which four metrics with
 *  incompatible units can honestly share a chart. */
function percentile(rank: number | null, total: number): number | null {
  if (!rank || total <= 1) return rank ? 1 : null;
  return 1 - (rank - 1) / (total - 1);
}

export function CompareBoard({
  data,
  series,
}: {
  data: TableData;
  /** iso3 -> metric key -> that country's history on the metric's period grid. */
  series: Record<string, Record<string, CompareSeries>>;
}) {
  const [param, setParam] = useQueryState("countries", { history: "replace" });
  const [query, setQuery] = useState("");

  const selected = useMemo(() => {
    const codes = (param ?? DEFAULT.join(","))
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
    const seen = new Set<string>();
    return codes
      .filter((c) => (seen.has(c) ? false : (seen.add(c), true)))
      .map((c) => data.rows.find((r) => r.iso3 === c))
      .filter((r): r is TableData["rows"][number] => Boolean(r))
      .slice(0, MAX);
  }, [param, data.rows]);

  const setSelected = (codes: string[]) =>
    void setParam(codes.length ? codes.join(",") : null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return data.rows
      .filter(
        (r) =>
          !selected.some((s) => s.iso3 === r.iso3) &&
          (r.name.toLowerCase().includes(q) || r.iso3.toLowerCase().includes(q)),
      )
      .slice(0, 6);
  }, [query, data.rows, selected]);

  return (
    <>
      {/* ---------- Picker ---------- */}
      <div className="flex flex-wrap items-center gap-2">
        {selected.map((c) => (
          <span
            key={c.iso3}
            className="flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--bg-surface)] py-1 pr-1.5 pl-3 text-sm"
          >
            {c.name}
            <button
              onClick={() =>
                setSelected(
                  selected.filter((s) => s.iso3 !== c.iso3).map((s) => s.iso3),
                )
              }
              aria-label={`Remove ${c.name}`}
              className="grid size-5 place-items-center rounded-full text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-raised)] hover:text-[var(--text-primary)]"
            >
              ×
            </button>
          </span>
        ))}

        {selected.length < MAX && (
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Add a country…"
              aria-label="Add a country to compare"
              className="w-44 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-accent)] focus:outline-none"
            />
            {matches.length > 0 && (
              <ul className="absolute top-full left-0 z-40 mt-1 w-56 overflow-hidden rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--bg-raised)] py-1 shadow-xl">
                {matches.map((m) => (
                  <li key={m.iso3}>
                    <button
                      onClick={() => {
                        setSelected([...selected.map((s) => s.iso3), m.iso3]);
                        setQuery("");
                      }}
                      className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-[var(--bg-overlay)]"
                    >
                      {m.name}
                      <span className="numeric text-2xs text-[var(--text-tertiary)]">
                        {m.iso3}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {selected.length === 0 ? (
        <p className="mt-16 text-sm text-[var(--text-tertiary)]">
          Add a country to begin.
        </p>
      ) : (
        <>
          {/* ---------- The matrix ----------
              Rows are dimensions and columns are countries, so comparing two
              countries on one dimension is a horizontal scan — the task this
              page exists for. */}
          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <caption className="sr-only">
                Selected countries compared across four AI dimensions, each shown as a
                percentile within that dimension.
              </caption>
              <thead>
                <tr>
                  <th className="text-2xs w-40 pb-3 text-left font-normal tracking-[0.14em] text-[var(--text-tertiary)] uppercase">
                    Dimension
                  </th>
                  {selected.map((c) => (
                    <th key={c.iso3} className="pb-3 text-left align-bottom">
                      <Link
                        href={`/countries/${c.iso3.toLowerCase()}`}
                        className="block text-[length:var(--text-lg)] leading-tight font-medium tracking-tight transition-colors hover:text-[var(--accent)]"
                      >
                        {c.name}
                      </Link>
                      <span className="numeric text-2xs text-[var(--text-tertiary)]">
                        {c.iso3}
                        {c.region ? ` · ${c.region}` : ""}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {data.layers.map((layer) => {
                  return (
                    <tr
                      key={layer.key}
                      className="border-t border-[var(--border-subtle)] align-top"
                    >
                      <th scope="row" className="py-5 pr-6 text-left">
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block size-2 rounded-[2px]"
                            style={{ background: layerColor(layer.layer, 4) }}
                          />
                          <span className="text-sm font-medium text-[var(--text-primary)]">
                            {layer.shortLabel}
                          </span>
                        </span>
                        <span className="numeric text-2xs mt-1 block font-normal text-[var(--text-tertiary)]">
                          {formatPeriod(layer.period)} · {layer.total} countries
                        </span>
                      </th>

                      {selected.map((c) => {
                        const v = c.values[layer.key];
                        const pct = v ? percentile(v.rank, layer.total) : null;
                        return (
                          <td key={c.iso3} className="py-5 pr-6">
                            {v ? (
                              <>
                                <span className="numeric block text-[length:var(--text-lg)] leading-none">
                                  {formatMetric(v.value, layer.unit, layer.precision)}
                                </span>
                                <span className="numeric text-2xs mt-1.5 block text-[var(--text-tertiary)]">
                                  #{v.rank} of {layer.total}
                                </span>
                                <span className="mt-2 block">
                                  <Sparkline
                                    values={series[c.iso3]?.[layer.key]?.values ?? []}
                                    slots={series[c.iso3]?.[layer.key]?.slots}
                                    gridLength={series[c.iso3]?.[layer.key]?.gridLength}
                                    layer={layer.layer}
                                    width={150}
                                    height={26}
                                    ariaLabel={`${c.name} ${layer.shortLabel} over time`}
                                  />
                                </span>
                                <span
                                  className="mt-2.5 block h-1.5 w-full max-w-[180px] overflow-hidden rounded-full"
                                  style={{ background: layerColor(layer.layer, 1) }}
                                  role="img"
                                  aria-label={`${Math.round((pct ?? 0) * 100)}th percentile`}
                                >
                                  <span
                                    className="block h-full rounded-full"
                                    style={{
                                      width: `${Math.max(2, (pct ?? 0) * 100)}%`,
                                      background: layerColor(layer.layer, 4),
                                    }}
                                  />
                                </span>
                              </>
                            ) : (
                              <span className="text-sm text-[var(--no-data-text)]">
                                No data
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-10 max-w-2xl border-t border-[var(--border-subtle)] pt-6 text-xs leading-relaxed text-[var(--text-tertiary)]">
            Bars show each country&rsquo;s percentile <em>within that dimension</em>,
            which is the only scale on which a share of adults, a sum in dollars and a
            count of papers can honestly sit side by side. They are deliberately not
            added together: countries lead on different dimensions, and any single
            ranking would require inventing a weighting that says how many published
            papers a billion dollars is worth.
          </p>
        </>
      )}
    </>
  );
}
