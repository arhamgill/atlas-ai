import { layerColor } from "./primitives";

/**
 * The shape of a column's distribution, sized to sit in a table header.
 *
 * A bar in a row tells you a country's value; it does not tell you whether that
 * value is unusual. These make the difference visible at a glance: adoption is
 * spread across the middle, while investment and research pile into the first
 * bin with a long thin tail — a handful of countries account for nearly
 * everything.
 */
export function Histogram({
  bins,
  layer,
  width = 74,
  height = 16,
}: {
  bins: number[];
  layer: string | null;
  width?: number;
  height?: number;
}) {
  const max = Math.max(1, ...bins);
  const gap = 1;
  const barW = Math.max(1, (width - gap * (bins.length - 1)) / bins.length);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Distribution across ${bins.reduce((a, b) => a + b, 0)} countries, low to high`}
      className="block"
    >
      {bins.map((n, i) => {
        // Square-root height so a single dominant bin does not flatten the rest
        // into invisibility.
        const h = n === 0 ? 0 : Math.max(1.5, Math.sqrt(n / max) * height);
        return (
          <rect
            key={i}
            x={i * (barW + gap)}
            y={height - h}
            width={barW}
            height={h}
            rx={0.5}
            fill={layerColor(layer, 3)}
            opacity={n === 0 ? 0.25 : 0.75}
          />
        );
      })}
    </svg>
  );
}
