import { line as d3line, curveMonotoneX } from "d3-shape";
import { scaleLinear, scalePoint } from "d3-scale";
import { AREA_OPACITY, DOT_R, layerColor } from "./primitives";

/**
 * A trend shape, not a chart. No axes, no labels, no interaction — it sits
 * inside a stat tile and answers "which way is this going?" in a glance.
 *
 * Server-rendered: there is nothing to interact with, so it costs no JS.
 */
export function Sparkline({
  values,
  layer,
  width = 92,
  height = 28,
  ariaLabel,
}: {
  values: number[];
  layer: string | null;
  width?: number;
  height?: number;
  ariaLabel?: string;
}) {
  if (values.length < 2) {
    return (
      <div
        style={{ width, height }}
        className="flex items-center"
        aria-hidden={!ariaLabel}
      >
        <span className="text-2xs text-[var(--no-data-text)]">—</span>
      </div>
    );
  }

  const pad = DOT_R + 1;
  const x = scalePoint<number>()
    .domain(values.map((_, i) => i))
    .range([pad, width - pad]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat series should sit on the centre line, not collapse onto the floor.
  const y =
    min === max
      ? () => height / 2
      : scaleLinear()
          .domain([min, max])
          .range([height - pad, pad]);

  const path =
    d3line<number>()
      .x((_, i) => x(i) ?? 0)
      .y((v) => y(v))
      .curve(curveMonotoneX)(values) ?? "";

  const lastX = x(values.length - 1) ?? 0;
  const lastY = y(values[values.length - 1] ?? 0);
  const color = layerColor(layer, 4);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role={ariaLabel ? "img" : "presentation"}
      aria-label={ariaLabel}
      className="overflow-visible"
    >
      {/* Wash under the line, so direction reads even at this size. */}
      <path
        d={`${path} L ${lastX} ${height} L ${x(0) ?? 0} ${height} Z`}
        fill={color}
        opacity={AREA_OPACITY}
      />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Only the current value gets a dot — the rest are carried by the line. */}
      <circle
        cx={lastX}
        cy={lastY}
        r={DOT_R - 1}
        fill={color}
        stroke="var(--bg-surface)"
        strokeWidth={2}
      />
    </svg>
  );
}
