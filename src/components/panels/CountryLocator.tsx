import { geoCentroid, geoCircle, geoOrthographic, geoPath } from "d3-geo";
import { getCountryFeatures } from "@/lib/geo/topology";
import { layerColor } from "@/components/charts/primitives";

/**
 * A small orthographic globe turned to face one country.
 *
 * Server-rendered SVG — `geoPath` with no canvas context returns path strings,
 * so this costs no JavaScript on the client. It exists because a name and a
 * region tell you far less than a silhouette does.
 */
export function CountryLocator({
  iso3,
  layer,
  size = 132,
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

  const r = size / 2 - 1;
  const projection = geoOrthographic()
    .rotate([-lng, -lat])
    .translate([size / 2, size / 2])
    .scale(r);
  const path = geoPath(projection);

  // The visible hemisphere, used both as the ocean disc and as a clip.
  const disc = geoCircle().center([lng, lat]).radius(90)();

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Location of ${target.name} on the globe`}
      className="shrink-0"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="var(--bg-raised)"
        stroke="var(--border-subtle)"
      />

      {/* Every other country, recessive. */}
      <g clipPath="url(#locator-clip)">
        {features
          .filter((f) => f.iso3 !== iso3)
          .map((f, i) => {
            const d = path(f);
            return d ? (
              <path
                key={f.iso3 ?? `x-${i}`}
                d={d}
                fill="var(--no-data)"
                opacity={0.85}
              />
            ) : null;
          })}

        {/* The subject, in its layer's colour. */}
        <path
          d={path(target) ?? ""}
          fill={layerColor(layer, 4)}
          stroke={layerColor(layer, 5)}
          strokeWidth={0.75}
        />
      </g>

      <defs>
        <clipPath id="locator-clip">
          <path d={path(disc) ?? ""} />
        </clipPath>
      </defs>

      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--border-strong)"
        strokeWidth={1}
      />
    </svg>
  );
}
