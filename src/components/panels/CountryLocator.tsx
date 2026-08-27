import {
  geoCentroid,
  geoCircle,
  geoGraticule10,
  geoOrthographic,
  geoPath,
} from "d3-geo";
import { getCountryFeatures } from "@/lib/geo/topology";
import { layerColor } from "@/components/charts/primitives";

/**
 * A small orthographic globe turned to face one country.
 *
 * Server-rendered SVG: `geoPath` with no canvas context returns path strings,
 * so this costs no JavaScript on the client. That is the whole reason it is not
 * the real WebGL globe — mounting that here would put ~1.1 MB of three.js on
 * all 194 static country pages to render a thumbnail.
 */
export function CountryLocator({
  iso3,
  layer,
  size = 200,
}: {
  iso3: string;
  layer: string | null;
  size?: number;
}) {
  const features = getCountryFeatures();
  const target = features.find((f) => f.iso3 === iso3);
  if (!target) return null;

  const [lng, lat] = geoCentroid(target);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;

  const r = size / 2 - 2;
  const projection = geoOrthographic()
    .rotate([-lng, -lat])
    .translate([size / 2, size / 2])
    .scale(r);
  const path = geoPath(projection);

  // The visible hemisphere, used as the ocean disc and as the clip.
  const disc = geoCircle().center([lng, lat]).radius(90)();
  const clipId = `locator-clip-${iso3}`;
  const glowId = `locator-glow-${iso3}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Location of ${target.name} on the globe`}
      className="shrink-0"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={path(disc) ?? ""} />
        </clipPath>
        {/* Lit from the upper left, matching the real globe. */}
        <radialGradient id={glowId} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="var(--bg-overlay)" />
          <stop offset="100%" stopColor="var(--bg-base)" />
        </radialGradient>
      </defs>

      <circle cx={size / 2} cy={size / 2} r={r} fill={`url(#${glowId})`} />

      <g clipPath={`url(#${clipId})`}>
        {/* Graticule first, so land sits on the grid rather than beside it. */}
        <path
          d={path(geoGraticule10()) ?? ""}
          fill="none"
          stroke="var(--border-subtle)"
          strokeWidth={0.5}
        />

        {features
          .filter((f) => f.iso3 !== iso3)
          .map((f, i) => {
            const d = path(f);
            return d ? (
              <path
                key={f.iso3 ?? `x-${i}`}
                d={d}
                fill="var(--no-data)"
                stroke="var(--bg-base)"
                strokeWidth={0.4}
              />
            ) : null;
          })}

        <path
          d={path(target) ?? ""}
          fill={layerColor(layer, 4)}
          stroke={layerColor(layer, 5)}
          strokeWidth={0.9}
        />
      </g>

      {/* Limb, to close the sphere off against the page. */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--border-strong)"
        strokeWidth={1}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r + 1}
        fill="none"
        stroke="var(--accent)"
        strokeOpacity={0.25}
        strokeWidth={2}
      />
    </svg>
  );
}
