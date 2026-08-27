"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef } from "react";
import type { GlobeLayer } from "@/lib/db/queries";
import { formatMetric, formatPeriod } from "@/lib/metrics/scales";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { useGlobeStore } from "@/lib/state/globe";

export interface CountryMeta {
  iso3: string;
  name: string;
  region: string | null;
}

interface Props {
  layers: GlobeLayer[];
  countries: CountryMeta[];
}

const EASE = [0.22, 1, 0.36, 1] as const;

export function GlobeHud({ layers, countries }: Props) {
  const layerIndex = useGlobeStore((s) => s.layerIndex);
  const setLayer = useGlobeStore((s) => s.setLayer);
  const hovered = useGlobeStore((s) => s.hovered);
  const selected = useGlobeStore((s) => s.selected);
  const setSelected = useGlobeStore((s) => s.setSelected);
  const pointer = useGlobeStore((s) => s.pointer);

  const sectionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Switching layers while the panel is open used to change only a faint
  // background, and the relevant section could be scrolled out of sight
  // entirely — so the figures appeared not to respond at all. Bring it into
  // view whenever the active layer changes.
  useEffect(() => {
    if (!selected) return;
    const el = sectionRefs.current[layerIndex];
    const scroller = el?.parentElement;
    if (!el || !scroller) return;

    // Leave it alone if it is already fully visible — scrolling a section that
    // the user can already see is just noise.
    const view = scroller.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    if (box.top >= view.top - 2 && box.bottom <= view.bottom + 2) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // "start", not "nearest": nearest scrolls the minimum possible amount and
    // can leave a tall section still clipped. Pinning the active layer to the
    // top of the list makes where to look unambiguous.
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [layerIndex, selected]);

  const nameByIso3 = useMemo(
    () => new Map(countries.map((c) => [c.iso3, c])),
    [countries],
  );

  /** iso3 -> [value, rank] for every layer, so lookups are O(1) per country. */
  const index = useMemo(
    () => layers.map((l) => new Map(l.rows.map((r) => [r[0], r]))),
    [layers],
  );

  const active = layers[layerIndex];
  const activeIndex = index[layerIndex];
  if (!active || !activeIndex) return null;

  const hoveredRow = hovered ? activeIndex.get(hovered) : undefined;
  const hoveredMeta = hovered ? nameByIso3.get(hovered) : undefined;
  const selectedMeta = selected ? nameByIso3.get(selected) : undefined;

  return (
    <>
      {/* ---------- Layer switcher ---------- */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center p-2 sm:p-6">
        <div
          role="tablist"
          aria-label="Globe data layer"
          className="pointer-events-auto flex max-w-full [scrollbar-width:none] gap-0.5 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--bg-surface)_82%,transparent)] p-1 backdrop-blur-md sm:gap-1 [&::-webkit-scrollbar]:hidden"
        >
          {layers.map((layer, i) => {
            const isActive = i === layerIndex;
            return (
              <button
                key={layer.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => setLayer(i)}
                className="group relative shrink-0 rounded-[var(--radius)] px-2 py-1.5 text-left sm:px-4 sm:py-2"
              >
                {/* Slides between tabs instead of each one flicking its own
                    background on and off, so the change is something you see
                    happen rather than something you have to notice. */}
                {isActive && (
                  <motion.span
                    layoutId="switcher-active-tab"
                    className="absolute inset-0 rounded-[var(--radius)] bg-[var(--bg-raised)]"
                    transition={{ duration: 0.3, ease: EASE }}
                  />
                )}
                <span
                  className="relative block text-[10px] tracking-[0.1em] uppercase sm:text-[11px] sm:tracking-[0.14em]"
                  style={{
                    color: isActive ? "var(--text-primary)" : "var(--text-tertiary)",
                  }}
                >
                  {layer.shortLabel}
                </span>
                <span className="numeric text-2xs relative mt-1 block text-[var(--text-tertiary)]">
                  {layer.rows.length}
                </span>
                <span className="relative mt-1.5 flex h-0.5 w-full overflow-hidden rounded-full">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <span
                      key={s}
                      className="flex-1 transition-opacity"
                      style={{
                        background: `var(--ramp-${layer.layer}-${s})`,
                        opacity: isActive ? 1 : 0.34,
                        transitionDuration: "var(--dur-ui)",
                      }}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------- Title + legend ---------- */}
      <div className="pointer-events-none absolute top-14 left-0 z-20 max-w-[78%] bg-[radial-gradient(120%_100%_at_0%_0%,var(--bg-base)_25%,transparent_75%)] p-4 pr-10 pb-10 sm:max-w-none sm:px-8 sm:pt-4 sm:pr-16">
        <AnimatePresence mode="wait">
          <motion.h1
            key={active.key}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="mt-1.5 max-w-xs text-[length:var(--text-lg)] leading-[1.15] font-medium tracking-tight sm:mt-2 sm:text-[length:var(--text-xl)]"
          >
            {active.label}
          </motion.h1>
        </AnimatePresence>
        <p className="numeric mt-1.5 text-xs text-[var(--text-tertiary)]">
          {formatPeriod(active.period)} · {active.rows.length} countries
        </p>

        <div className="mt-5 flex items-center gap-2">
          <span className="flex h-1.5 w-28 overflow-hidden rounded-full">
            {[1, 2, 3, 4, 5].map((s) => (
              <span
                key={s}
                className="flex-1"
                style={{ background: `var(--ramp-${active.layer}-${s})` }}
              />
            ))}
          </span>
          <span className="numeric text-2xs text-[var(--text-tertiary)]">
            low → high
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span
            className="inline-block size-2.5 rounded-[2px]"
            style={{ background: "var(--no-data)" }}
          />
          <span className="text-2xs text-[var(--text-tertiary)]">No data</span>
        </div>
      </div>

      {/* ---------- Hover tooltip ---------- */}
      <AnimatePresence>
        {hovered && hoveredMeta && (
          <motion.div
            key="tooltip"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.14, ease: EASE }}
            className="pointer-events-none absolute z-30 min-w-[150px] rounded-[var(--radius)] border border-[var(--border-strong)] bg-[color-mix(in_srgb,var(--bg-raised)_92%,transparent)] px-3 py-2 backdrop-blur-md"
            style={{
              left: Math.min(pointer.x + 16, (globalThis.innerWidth ?? 1200) - 190),
              top: pointer.y + 16,
            }}
          >
            <p className="text-xs font-medium text-[var(--text-primary)]">
              {hoveredMeta.name}
            </p>
            {hoveredRow ? (
              <div className="mt-1.5 flex items-baseline justify-between gap-4">
                <span className="numeric text-[length:var(--text-lg)] leading-none text-[var(--text-primary)]">
                  {formatMetric(hoveredRow[1], active.unit, active.precision)}
                </span>
                <span className="numeric text-2xs text-[var(--text-tertiary)]">
                  #{hoveredRow[2]}
                </span>
              </div>
            ) : (
              <p className="text-2xs mt-1.5 text-[var(--no-data-text)]">
                No data for this layer
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------- Country panel ---------- */}
      <AnimatePresence>
        {selected && selectedMeta && (
          <motion.aside
            key="panel"
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 28 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="pointer-events-auto absolute top-0 right-0 z-30 flex h-full w-full max-w-[340px] flex-col border-l border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--bg-surface)_92%,transparent)] backdrop-blur-xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] p-5">
              <div>
                <p className="numeric text-2xs tracking-[0.18em] text-[var(--text-tertiary)] uppercase">
                  {selectedMeta.iso3}
                  {selectedMeta.region ? ` · ${selectedMeta.region}` : ""}
                </p>
                <h2 className="mt-1.5 text-[length:var(--text-lg)] leading-tight font-medium">
                  {selectedMeta.name}
                </h2>
              </div>
              <button
                onClick={() => setSelected(null)}
                aria-label="Close country panel"
                className="rounded-[var(--radius)] border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--text-tertiary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
              >
                Esc
              </button>
            </header>

            <div className="flex-1 overflow-y-auto">
              {layers.map((layer, i) => {
                const row = index[i]?.get(selected);
                const isActive = i === layerIndex;
                return (
                  <button
                    key={layer.key}
                    ref={(el) => {
                      sectionRefs.current[i] = el;
                    }}
                    onClick={() => setLayer(i)}
                    aria-current={isActive ? "true" : undefined}
                    className="relative block w-full border-b border-[var(--border-subtle)] py-5 pr-5 pl-6 text-left transition-colors hover:bg-[var(--bg-raised)]"
                    style={{
                      background: isActive ? "var(--bg-raised)" : undefined,
                      transitionDuration: "var(--dur-ui)",
                      transitionTimingFunction: "var(--ease)",
                    }}
                  >
                    {/* One shared bar that slides between sections, so the eye
                        is carried to the layer that just became active rather
                        than having to hunt for a changed background. */}
                    {isActive && (
                      <motion.span
                        layoutId="panel-active-layer"
                        className="absolute inset-y-0 left-0 w-[3px]"
                        style={{ background: `var(--ramp-${layer.layer}-4)` }}
                        transition={{ duration: 0.34, ease: EASE }}
                      />
                    )}

                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block size-2 rounded-[2px] transition-opacity"
                        style={{
                          background: `var(--ramp-${layer.layer}-4)`,
                          opacity: isActive ? 1 : 0.45,
                          transitionDuration: "var(--dur-ui)",
                        }}
                      />
                      <span
                        className="text-2xs tracking-[0.14em] uppercase transition-colors"
                        style={{
                          color: isActive
                            ? "var(--text-primary)"
                            : "var(--text-tertiary)",
                          transitionDuration: "var(--dur-ui)",
                        }}
                      >
                        {layer.shortLabel}
                      </span>
                      {isActive && (
                        <motion.span
                          initial={{ opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.22, ease: EASE }}
                          className="ml-auto rounded-full border px-1.5 py-0.5 text-[9px] tracking-[0.12em] uppercase"
                          style={{
                            borderColor: "var(--border-accent)",
                            color: "var(--accent)",
                          }}
                        >
                          On globe
                        </motion.span>
                      )}
                    </div>

                    {row ? (
                      <>
                        <AnimatedNumber
                          value={row[1]}
                          format={(v) => formatMetric(v, layer.unit, layer.precision)}
                          className="numeric mt-2.5 block leading-none transition-all"
                          style={{
                            fontSize: isActive ? "var(--text-2xl)" : "var(--text-lg)",
                            color: isActive
                              ? "var(--text-primary)"
                              : "var(--text-secondary)",
                            transitionDuration: "var(--dur-ui)",
                            transitionTimingFunction: "var(--ease)",
                          }}
                        />
                        <p className="numeric text-2xs mt-2 text-[var(--text-tertiary)]">
                          Rank #{row[2]} of {layer.rows.length}
                          {row[3] !== null && row[3] !== 0 && (
                            <span
                              className="ml-2"
                              style={{
                                color:
                                  row[3] > 0 ? "var(--positive)" : "var(--negative)",
                              }}
                            >
                              {row[3] > 0 ? "▲" : "▼"} {Math.abs(row[3])}
                            </span>
                          )}
                        </p>
                      </>
                    ) : (
                      <p className="mt-2.5 text-[length:var(--text-base)] text-[var(--no-data-text)]">
                        No data
                      </p>
                    )}

                    <p className="numeric text-2xs mt-2 text-[var(--text-tertiary)]">
                      {formatPeriod(layer.period)}
                    </p>
                  </button>
                );
              })}
            </div>

            <footer className="border-t border-[var(--border-subtle)] p-4">
              <p className="text-2xs leading-relaxed text-[var(--text-tertiary)]">
                {active.methodologyNote ?? "Source data as published."}
              </p>
            </footer>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
