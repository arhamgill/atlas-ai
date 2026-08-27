/**
 * Shared chart vocabulary.
 *
 * Every chart in the project is hand-built React + SVG on d3 scales — no chart
 * library. These constants are the mark specs, kept in one place so a line in
 * a sparkline and a line in a full time series are the same line.
 */

/** Line weight, round join and cap. */
export const STROKE = 2;
/** Data dots. Minimum r=4 so the mark is >= 8px and hoverable. */
export const DOT_R = 4;
/** Dots and end markers carry a ring in the surface colour so they stay legible
 *  where they cross the line or another mark. */
export const DOT_RING = 2;
/** Area washes are a hint of the series hue, never a saturated block. */
export const AREA_OPACITY = 0.12;
/** Gridlines are hairline, solid and recessive. Dashed reads as noise. */
export const GRID_STROKE = 1;

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const DEFAULT_MARGIN: Margin = { top: 16, right: 16, bottom: 26, left: 46 };

/**
 * A layer's ramp step, as a CSS variable reference.
 *
 * Charts use ONE step per series rather than shading marks by value: bar length
 * and line height already encode magnitude, and re-encoding it as hue burns the
 * only free channel on information the chart is already showing. The globe is
 * the exception, and legitimately so — a choropleth has no length channel, so
 * hue is the only one it has.
 */
export function layerColor(layer: string | null | undefined, step = 4): string {
  return layer ? `var(--ramp-${layer}-${step})` : "var(--text-tertiary)";
}

/** Axis tick values that land on round numbers rather than raw data extremes. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return [min || 0];
  }
  const span = max - min;
  const raw = span / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 7.5 ? 10 : norm >= 3.5 ? 5 : norm >= 1.5 ? 2 : 1) * mag;
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step * 0.001; v += step)
    out.push(Number(v.toFixed(10)));
  return out;
}

/**
 * Compact axis labels: 1.2K, 4.5M, $301B.
 *
 * `step` is the distance between ticks. Without it a percent axis spanning
 * 15.4 to 16.4 renders "16%" five times over — the labels must carry enough
 * precision to actually distinguish the gridlines they sit on.
 */
export function compact(value: number, unit: string, step?: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const prefix = unit === "usd" ? "$" : "";
  const suffix = unit === "percent" ? "%" : "";

  if (unit === "percent") {
    const dp = step === undefined ? 0 : step < 0.1 ? 2 : step < 1 ? 1 : 0;
    return `${sign}${prefix}${abs.toFixed(dp)}${suffix}`;
  }
  if (abs >= 1e12)
    return `${sign}${prefix}${(abs / 1e12).toFixed(abs >= 1e13 ? 0 : 1)}T`;
  if (abs >= 1e9) return `${sign}${prefix}${(abs / 1e9).toFixed(abs >= 1e10 ? 0 : 1)}B`;
  if (abs >= 1e6) return `${sign}${prefix}${(abs / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`;
  if (abs >= 1e3) return `${sign}${prefix}${(abs / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}K`;
  return `${sign}${prefix}${abs % 1 === 0 ? abs : abs.toFixed(1)}${suffix}`;
}

/** "2026-03-31" -> "Q1 26"; "2024" -> "2024". Axis labels need to be short. */
export function shortPeriod(period: string): string {
  if (!period.includes("-")) return period;
  const [y, m] = period.split("-");
  const q = { "03": "Q1", "06": "Q2", "09": "Q3", "12": "Q4" }[m ?? ""] ?? "";
  return q ? `${q} ${y?.slice(2)}` : period;
}
