import { interpolateRgbBasis } from "d3-interpolate";
import { scaleLinear, scaleLog, type ScaleContinuousNumeric } from "d3-scale";

/**
 * Colour ramps are read from CSS custom properties at runtime rather than
 * duplicated here, so `src/styles/tokens.css` stays the single place any colour
 * is defined.
 */
export function readRamp(layer: string): string[] {
  if (typeof window === "undefined") return ["#222", "#888"];
  const css = getComputedStyle(document.documentElement);
  const stops = [1, 2, 3, 4, 5]
    .map((i) => css.getPropertyValue(`--ramp-${layer}-${i}`).trim())
    .filter(Boolean);
  return stops.length ? stops : ["#222", "#888"];
}

export function readToken(name: string, fallback = "#22262c"): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export interface ColorScale {
  (value: number): string;
  /** Five evenly spaced sample values, for the legend. */
  ticks: number[];
  min: number;
  max: number;
}

/**
 * Build a colour scale for one layer.
 *
 * Percent metrics are close to uniform, so they get a linear domain. Counts and
 * USD are heavily skewed — the United States has 17x China's private AI
 * investment — so a linear ramp would paint the whole world the darkest stop
 * and one country the brightest. Those use a log domain instead.
 */
export function buildColorScale(
  layer: string,
  unit: string,
  values: number[],
): ColorScale {
  const ramp = readRamp(layer);
  const interpolate = interpolateRgbBasis(ramp);

  const positive = values.filter((v) => Number.isFinite(v) && v > 0);
  const min = positive.length ? Math.min(...positive) : 0;
  const max = positive.length ? Math.max(...positive) : 1;

  const useLog = unit !== "percent" && max / Math.max(min, 1) > 50;

  const base: ScaleContinuousNumeric<number, number> = useLog
    ? scaleLog()
        .domain([Math.max(min, 1), Math.max(max, 2)])
        .clamp(true)
    : scaleLinear()
        .domain([Math.min(min, ...values), max])
        .clamp(true);

  base.range([0, 1]);

  const fn = ((value: number) => {
    if (!Number.isFinite(value)) return interpolate(0);
    if (useLog && value <= 0) return interpolate(0);
    return interpolate(base(value));
  }) as ColorScale;

  const [d0, d1] = base.domain() as [number, number];
  fn.ticks = [0, 0.25, 0.5, 0.75, 1].map((t) =>
    useLog ? d0 * Math.pow(d1 / d0, t) : d0 + (d1 - d0) * t,
  );
  fn.min = min;
  fn.max = max;

  return fn;
}

export function formatMetric(value: number, unit: string, precision: number): string {
  if (!Number.isFinite(value)) return "—";
  if (unit === "percent") return `${value.toFixed(precision)}%`;
  if (unit === "usd") {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
    return `$${Math.round(value)}`;
  }
  return Math.round(value).toLocaleString("en-US");
}

export function formatPeriod(period: string): string {
  if (period.includes("–")) return period;
  if (!period.includes("-")) return period;
  const [y, m] = period.split("-");
  const q = { "03": "Q1", "06": "Q2", "09": "Q3", "12": "Q4" }[m ?? ""] ?? "";
  return q ? `${q} ${y}` : period;
}
