"use client";

import { scaleLinear, scalePoint } from "d3-scale";
import { area as d3area, line as d3line, curveMonotoneX } from "d3-shape";
import { useMemo, useState } from "react";
import { useInView } from "@/components/ui/useInView";
import { formatMetric } from "@/lib/metrics/scales";
import {
  AREA_OPACITY,
  DEFAULT_MARGIN,
  DOT_R,
  DOT_RING,
  GRID_STROKE,
  STROKE,
  compact,
  layerColor,
  niceTicks,
  shortPeriod,
} from "./primitives";

export interface TimeSeriesPoint {
  period: string;
  value: number;
  rank?: number | null;
  total?: number | null;
}

/**
 * One metric over time for one country.
 *
 * Deliberately a single series: the four layers have incompatible units, and
 * putting two of them on one plot would mean a second y-axis — the alignment
 * of which is arbitrary and invents a correlation the data does not contain.
 * Four small charts, one axis each.
 *
 * No legend, for the same reason: one series means the title already says what
 * is plotted, and a one-swatch box would just restate it.
 */
export function TimeSeries({
  points,
  layer,
  unit,
  precision,
  height = 190,
  label,
  showRank = true,
}: {
  points: TimeSeriesPoint[];
  layer: string | null;
  unit: string;
  precision: number;
  height?: number;
  label: string;
  /** Off for metrics aggregated all-time, where a per-period rank
   *  contradicts the headline figure beside it. */
  showRank?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const { ref: viewRef, inView } = useInView<HTMLElement>();
  const [width, setWidth] = useState(560);
  const m = DEFAULT_MARGIN;

  const { x, y, linePath, areaPath, ticks } = useMemo(() => {
    const innerW = Math.max(80, width - m.left - m.right);
    const innerH = Math.max(60, height - m.top - m.bottom);

    const xs = scalePoint<number>()
      .domain(points.map((_, i) => i))
      .range([0, innerW]);

    const values = points.map((p) => p.value);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    // Always include zero for counts and money: a truncated axis exaggerates
    // change, and these are magnitudes where zero is meaningful.
    const base = unit === "percent" ? Math.max(0, lo - (hi - lo) * 0.15) : 0;
    const top = hi === base ? hi + 1 : hi + (hi - base) * 0.12;

    const ys = scaleLinear().domain([base, top]).range([innerH, 0]).nice();

    return {
      x: xs,
      y: ys,
      ticks: niceTicks(base, top, 4),
      linePath:
        d3line<TimeSeriesPoint>()
          .x((_, i) => xs(i) ?? 0)
          .y((p) => ys(p.value))
          .curve(curveMonotoneX)(points) ?? "",
      areaPath:
        d3area<TimeSeriesPoint>()
          .x((_, i) => xs(i) ?? 0)
          .y0(innerH)
          .y1((p) => ys(p.value))
          .curve(curveMonotoneX)(points) ?? "",
    };
  }, [points, width, height, unit, m.left, m.right, m.top, m.bottom]);

  if (points.length < 2) return null;

  const color = layerColor(layer, 4);
  const innerW = Math.max(80, width - m.left - m.right);
  const innerH = Math.max(60, height - m.top - m.bottom);
  const active = hover ?? points.length - 1;
  const tickStep = ticks.length > 1 ? (ticks[1] ?? 0) - (ticks[0] ?? 0) : undefined;
  const activePoint = points[active];

  return (
    <figure ref={viewRef} className="relative m-0">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={`${label} over time`}
        ref={(el) => {
          // Track the real rendered width so the point scale matches the SVG.
          const w = el?.parentElement?.clientWidth;
          if (w && Math.abs(w - width) > 2) setWidth(w);
        }}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`fade-${layer}-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={AREA_OPACITY * 2.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        <g transform={`translate(${m.left},${m.top})`}>
          {/* Hairline, solid, recessive. Horizontal only — vertical rules would
              compete with the data at this density. */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={0}
                x2={innerW}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--border-subtle)"
                strokeWidth={GRID_STROKE}
              />
              <text
                x={-10}
                y={y(t)}
                dy="0.32em"
                textAnchor="end"
                className="numeric fill-[var(--text-tertiary)] text-[10px]"
              >
                {compact(t, unit, tickStep)}
              </text>
            </g>
          ))}

          <path
            d={areaPath}
            fill={`url(#fade-${layer}-${label})`}
            style={{
              opacity: inView ? 1 : 0,
              transition: "opacity 600ms var(--ease) 240ms",
            }}
          />
          {/*
            The line draws itself in by animating a dash offset.

            `pathLength={1}` renormalises the path's own length to 1, so the
            dash array and offset are the same two numbers for every series
            regardless of its real geometry — no getTotalLength() call, and so
            no DOM read during render.
          */}
          <path
            d={linePath}
            pathLength={1}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={1}
            strokeDashoffset={inView ? 0 : 1}
            style={{ transition: "stroke-dashoffset 900ms var(--ease)" }}
          />

          {/* Crosshair for the hovered period. */}
          {hover !== null && (
            <line
              x1={x(hover) ?? 0}
              x2={x(hover) ?? 0}
              y1={0}
              y2={innerH}
              stroke="var(--border-strong)"
              strokeWidth={GRID_STROKE}
            />
          )}

          {points.map((p, i) => {
            const isActive = i === active;
            return (
              <circle
                key={p.period}
                cx={x(i) ?? 0}
                cy={y(p.value)}
                r={isActive ? DOT_R : DOT_R - 1.5}
                fill={color}
                stroke="var(--bg-surface)"
                strokeWidth={DOT_RING}
                opacity={inView ? (isActive ? 1 : 0.85) : 0}
                style={{
                  transition: `opacity 320ms var(--ease) ${360 + i * 45}ms`,
                }}
              />
            );
          })}

          {/* Hit targets far wider than the dots, so hovering is easy. */}
          {points.map((p, i) => (
            <rect
              key={`hit-${p.period}`}
              x={(x(i) ?? 0) - innerW / (points.length * 2)}
              y={0}
              width={innerW / points.length}
              height={innerH}
              fill="transparent"
              onPointerEnter={() => setHover(i)}
            />
          ))}

          {/* X labels: first, last and the hovered one. Labelling every period
              turns the axis into noise at this width. */}
          {points.map((p, i) => {
            const show = i === 0 || i === points.length - 1 || i === hover;
            if (!show) return null;
            return (
              <text
                key={`x-${p.period}`}
                x={x(i) ?? 0}
                y={innerH + 18}
                textAnchor={
                  i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"
                }
                className="numeric fill-[var(--text-tertiary)] text-[10px]"
              >
                {shortPeriod(p.period)}
              </text>
            );
          })}
        </g>
      </svg>

      {activePoint && (
        <figcaption className="mt-1 flex items-baseline gap-2 text-xs">
          <span className="numeric text-[var(--text-primary)]">
            {formatMetric(activePoint.value, unit, precision)}
          </span>
          <span className="numeric text-[var(--text-tertiary)]">
            {shortPeriod(activePoint.period)}
          </span>
          {showRank && activePoint.rank != null && activePoint.total != null && (
            <span className="numeric ml-auto text-[var(--text-tertiary)]">
              rank #{activePoint.rank} of {activePoint.total}
            </span>
          )}
        </figcaption>
      )}
    </figure>
  );
}
