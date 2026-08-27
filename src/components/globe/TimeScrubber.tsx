"use client";

import { useGlobeStore } from "@/lib/state/globe";
import { formatPeriod } from "@/lib/metrics/scales";

/**
 * Steps the globe through a layer's history.
 *
 * Investment carries ten years and research nine, none of which were reachable
 * before — the globe only ever painted the most recent period. Layers with a
 * single period (development is an all-time total) render nothing at all, so
 * this is purely additive.
 *
 * A native range input carries the keyboard behaviour for free: arrows step,
 * Home and End jump to either end, and it is announced as a slider.
 */
export function TimeScrubber({ periods, layer }: { periods: string[]; layer: string }) {
  const periodIndex = useGlobeStore((s) => s.periodIndex);
  const setPeriod = useGlobeStore((s) => s.setPeriod);
  const markInteracted = useGlobeStore((s) => s.markInteracted);

  const last = periods.length - 1;
  if (last < 1) return null;

  const current = periodIndex < 0 ? last : Math.min(periodIndex, last);
  const isLatest = current === last;

  return (
    <div className="pointer-events-auto flex w-full max-w-[min(30rem,90vw)] items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--bg-surface)_82%,transparent)] px-3.5 py-2.5 backdrop-blur-md">
      {/* Endpoints are context, not the readout — the legend names the period
          you are on. On a phone they cost half the track, so they go. */}
      <span className="numeric text-2xs hidden shrink-0 tracking-[0.14em] text-[var(--text-tertiary)] uppercase sm:block">
        {formatPeriod(periods[0] ?? "")}
      </span>

      <span className="relative flex min-w-0 flex-1 items-center">
        {/* Ticks sit behind the input so the number of stops is visible before
            you drag — otherwise a slider implies a continuous range that the
            data does not have. */}
        <span
          className="pointer-events-none absolute inset-x-0 flex justify-between px-[7px]"
          aria-hidden
        >
          {periods.map((p, i) => (
            <span
              key={p}
              className="block h-2 w-px transition-opacity"
              style={{
                background:
                  i <= current ? `var(--ramp-${layer}-4)` : "var(--border-strong)",
                opacity: i <= current ? 0.9 : 0.6,
                transitionDuration: "var(--dur-ui)",
              }}
            />
          ))}
        </span>

        <input
          type="range"
          min={0}
          max={last}
          step={1}
          value={current}
          onChange={(e) => {
            markInteracted();
            const next = Number(e.target.value);
            setPeriod(next === last ? -1 : next);
          }}
          aria-label={`Period: ${formatPeriod(periods[current] ?? "")}`}
          aria-valuetext={formatPeriod(periods[current] ?? "")}
          className="scrubber relative z-10 w-full"
          style={{ accentColor: `var(--ramp-${layer}-4)` }}
        />
      </span>

      <span className="numeric text-2xs hidden shrink-0 tracking-[0.14em] text-[var(--text-tertiary)] uppercase sm:block">
        {formatPeriod(periods[last] ?? "")}
      </span>

      {/* Which period you are on, in the control you are dragging. */}
      <span
        className="numeric text-2xs shrink-0 tracking-[0.14em] uppercase sm:hidden"
        style={{ color: `var(--ramp-${layer}-5)` }}
      >
        {formatPeriod(periods[current] ?? "")}
      </span>

      {/* Getting back to the present has to be one click, not a careful drag. */}
      <button
        onClick={() => {
          markInteracted();
          setPeriod(-1);
        }}
        disabled={isLatest}
        className="text-2xs shrink-0 rounded-[var(--radius)] border px-2 py-1 tracking-[0.12em] uppercase transition-colors disabled:opacity-0"
        style={{
          borderColor: "var(--border-accent)",
          color: "var(--accent)",
          transitionDuration: "var(--dur-ui)",
        }}
      >
        Now
      </button>
    </div>
  );
}
