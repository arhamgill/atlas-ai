import Link from "next/link";
import { Sparkline } from "@/components/charts/Sparkline";
import { RankMeter } from "@/components/charts/RankMeter";
import { layerColor } from "@/components/charts/primitives";
import type { CountryMetric } from "@/lib/db/queries";
import { formatMetric, formatPeriod } from "@/lib/metrics/scales";

/**
 * Stat tile: label, value, movement, rank, trend.
 *
 * The value uses proportional figures rather than tabular ones. Tabular gives
 * every digit the width of a zero, which keeps columns aligned but makes a
 * standalone display number look loose — tabular is reserved for the table
 * views, where vertical alignment is the whole point.
 */
export function MetricTile({ metric, iso3 }: { metric: CountryMetric; iso3: string }) {
  const l = metric.latest;
  const color = layerColor(metric.layer, 4);

  return (
    <Link
      href={`/?layer=${metric.layer}&country=${iso3}`}
      className="group block rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 transition-colors hover:border-[var(--border-strong)]"
      style={{ transitionDuration: "var(--dur-ui)" }}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-block size-2 rounded-[2px]"
          style={{ background: color }}
        />
        <span className="text-2xs tracking-[0.14em] text-[var(--text-tertiary)] uppercase">
          {metric.shortLabel}
        </span>
      </div>

      {l ? (
        <>
          <div className="mt-3 flex items-end justify-between gap-3">
            <span className="text-[length:var(--text-2xl)] leading-none font-medium tracking-tight">
              {formatMetric(l.value, metric.unit, metric.precision)}
            </span>
            <Sparkline
              values={metric.series.map((p) => p.value)}
              layer={metric.layer}
              ariaLabel={`${metric.label} trend`}
            />
          </div>

          <div className="mt-4 flex items-baseline justify-between gap-2">
            <span className="numeric text-xs text-[var(--text-secondary)]">
              #{l.rank}
              <span className="text-[var(--text-tertiary)]"> of {l.total}</span>
            </span>
            {l.delta !== null && l.delta !== 0 && (
              <span
                className="numeric text-2xs"
                style={{
                  color: l.delta > 0 ? "var(--positive)" : "var(--negative)",
                }}
              >
                {l.delta > 0 ? "▲" : "▼"} {Math.abs(l.delta)}{" "}
                {Math.abs(l.delta) === 1 ? "place" : "places"}
              </span>
            )}
          </div>

          <div className="mt-2">
            <RankMeter
              rank={l.rank ?? 0}
              total={l.total}
              layer={metric.layer}
              label={`${metric.label}: rank ${l.rank} of ${l.total}`}
            />
          </div>

          <p className="numeric text-2xs mt-3 text-[var(--text-tertiary)]">
            {formatPeriod(l.period)}
          </p>
        </>
      ) : (
        <>
          <p className="mt-3 text-[length:var(--text-lg)] text-[var(--no-data-text)]">
            No data
          </p>
          <p className="text-2xs mt-4 leading-relaxed text-[var(--text-tertiary)]">
            This country is not covered by the source for this layer.
          </p>
        </>
      )}
    </Link>
  );
}
