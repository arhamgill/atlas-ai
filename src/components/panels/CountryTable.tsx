"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { BarCell } from "@/components/charts/BarCell";
import { layerColor } from "@/components/charts/primitives";
import type { CountryTable as TableData } from "@/lib/db/queries";
import { formatMetric, formatPeriod } from "@/lib/metrics/scales";

type SortKey = "name" | string;

/**
 * The ranked, searchable mirror of the globe.
 *
 * The plan treats this as a requirement rather than a nice-to-have: the globe
 * cannot be the only route to the data, so everything on it has to be reachable
 * here with a keyboard and a screen reader.
 */
export function CountryTable({ data }: { data: TableData }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>(data.layers[0]?.key ?? "name");
  const [cursor, setCursor] = useState(-1);
  const searchRef = useRef<HTMLInputElement>(null);
  const rowsRef = useRef<(HTMLAnchorElement | null)[]>([]);

  // Filtering 190 rows on every keystroke is cheap, but deferring keeps the
  // input itself responsive when the list re-renders.
  const deferredQuery = useDeferredValue(query);

  const regions = useMemo(
    () =>
      [...new Set(data.rows.map((r) => r.region).filter(Boolean))].sort() as string[],
    [data.rows],
  );

  const rows = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const filtered = data.rows.filter((r) => {
      if (region && r.region !== region) return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || r.iso3.toLowerCase().includes(q);
    });

    if (sort === "name")
      return [...filtered].sort((a, b) => a.name.localeCompare(b.name));

    // Countries missing this metric sort last rather than reading as zero.
    return [...filtered].sort((a, b) => {
      const av = a.values[sort]?.value;
      const bv = b.values[sort]?.value;
      if (av === undefined && bv === undefined) return a.name.localeCompare(b.name);
      if (av === undefined) return 1;
      if (bv === undefined) return -1;
      return bv - av;
    });
  }, [data.rows, deferredQuery, region, sort]);

  // "/" focuses search, arrows walk the list, Enter opens the country.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (typing && e.key !== "Escape" && e.key !== "ArrowDown") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "Escape") {
        (el as HTMLInputElement | null)?.blur?.();
        setCursor(-1);
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => {
          const next = e.key === "ArrowDown" ? c + 1 : c - 1;
          return Math.max(0, Math.min(rows.length - 1, next));
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows.length]);

  useEffect(() => {
    if (cursor < 0) return;
    const el = rowsRef.current[cursor];
    el?.focus();
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  return (
    <>
      {/* ---------- Controls ---------- */}
      <div className="sticky top-14 z-30 -mx-4 border-b border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--bg-base)_88%,transparent)] px-4 py-3 backdrop-blur-md sm:-mx-8 sm:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[180px] flex-1">
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCursor(-1);
              }}
              placeholder="Search countries…"
              aria-label="Search countries"
              className="w-full rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-accent)] focus:outline-none"
            />
            {!query && (
              <kbd className="numeric pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded border border-[var(--border-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--text-tertiary)]">
                /
              </kbd>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <label
              htmlFor="sort"
              className="text-2xs tracking-[0.14em] text-[var(--text-tertiary)] uppercase"
            >
              Sort
            </label>
            <select
              id="sort"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setCursor(-1);
              }}
              className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-xs text-[var(--text-primary)] focus:border-[var(--border-accent)] focus:outline-none"
            >
              {data.layers.map((l) => (
                <option key={l.key} value={l.key}>
                  {l.shortLabel}
                </option>
              ))}
              <option value="name">Name</option>
            </select>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <FilterChip active={region === null} onClick={() => setRegion(null)}>
            All regions
          </FilterChip>
          {regions.map((r) => (
            <FilterChip key={r} active={region === r} onClick={() => setRegion(r)}>
              {r}
            </FilterChip>
          ))}
          <span className="numeric text-2xs ml-auto text-[var(--text-tertiary)]">
            {rows.length} of {data.rows.length}
          </span>
        </div>
      </div>

      {/* ---------- Table ---------- */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-left">
          <caption className="sr-only">
            Countries ranked by AI adoption, investment, development and research. Use
            arrow keys to move between rows.
          </caption>
          <thead>
            <tr className="border-b border-[var(--border-subtle)]">
              <th
                scope="col"
                className="text-2xs w-10 py-2 pr-2 font-normal tracking-[0.14em] text-[var(--text-tertiary)] uppercase"
              >
                #
              </th>
              <th
                scope="col"
                className="text-2xs py-2 pr-4 font-normal tracking-[0.14em] text-[var(--text-tertiary)] uppercase"
              >
                Country
              </th>
              {data.layers.map((l) => (
                <th
                  key={l.key}
                  scope="col"
                  aria-sort={sort === l.key ? "descending" : "none"}
                  className="text-2xs py-2 pr-4 font-normal tracking-[0.14em] uppercase"
                >
                  <button
                    onClick={() => setSort(l.key)}
                    className="flex items-center gap-1.5 transition-colors"
                    style={{
                      color:
                        sort === l.key ? "var(--text-primary)" : "var(--text-tertiary)",
                    }}
                  >
                    <span
                      className="inline-block size-1.5 rounded-[1px]"
                      style={{
                        background: layerColor(l.layer, 4),
                        opacity: sort === l.key ? 1 : 0.5,
                      }}
                    />
                    {l.shortLabel}
                    {sort === l.key && <span aria-hidden>↓</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.iso3}
                className="group border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-surface)]"
              >
                <td className="numeric py-2.5 pr-2 align-middle text-xs text-[var(--text-tertiary)]">
                  {sort === "name" ? "" : (row.values[sort]?.rank ?? "—")}
                </td>
                <td className="py-2.5 pr-4 align-middle">
                  <Link
                    ref={(el) => {
                      rowsRef.current[i] = el;
                    }}
                    href={`/countries/${row.iso3.toLowerCase()}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        router.push(`/countries/${row.iso3.toLowerCase()}`);
                    }}
                    className="flex items-baseline gap-2 rounded-[var(--radius-sm)] text-sm text-[var(--text-primary)] outline-offset-4 transition-colors group-hover:text-[var(--accent)]"
                  >
                    {row.name}
                    <span className="numeric text-2xs text-[var(--text-tertiary)]">
                      {row.iso3}
                    </span>
                  </Link>
                </td>

                {data.layers.map((l) => {
                  const v = row.values[l.key];
                  return (
                    <td key={l.key} className="py-2.5 pr-4 align-middle">
                      {v ? (
                        <span className="flex items-center gap-2.5">
                          <BarCell value={v.value} max={l.max} layer={l.layer} />
                          <span className="numeric text-xs text-[var(--text-secondary)]">
                            {formatMetric(v.value, l.unit, l.precision)}
                          </span>
                          {v.delta !== null && v.delta !== 0 && (
                            <span
                              className="numeric text-[10px]"
                              style={{
                                color:
                                  v.delta > 0 ? "var(--positive)" : "var(--negative)",
                              }}
                            >
                              {v.delta > 0 ? "▲" : "▼"}
                              {Math.abs(v.delta)}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--no-data-text)]">
                          No data
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length === 0 && (
          <p className="py-16 text-center text-sm text-[var(--text-tertiary)]">
            No country matches “{query}”{region ? ` in ${region}` : ""}.
          </p>
        )}
      </div>

      <p className="numeric text-2xs mt-6 text-[var(--text-tertiary)]">
        {data.layers
          .map(
            (l) => `${l.shortLabel} ${formatPeriod(l.period)} · ${l.total} countries`,
          )
          .join("   ·   ")}
      </p>
    </>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="text-2xs rounded-full border px-2.5 py-1 transition-colors"
      style={{
        borderColor: active ? "var(--border-accent)" : "var(--border-subtle)",
        color: active ? "var(--accent)" : "var(--text-tertiary)",
        background: active ? "var(--accent-glow)" : "transparent",
        transitionDuration: "var(--dur-ui)",
      }}
    >
      {children}
    </button>
  );
}
