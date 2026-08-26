import type { Feature, FeatureCollection, Geometry } from "geojson";
import { geoContains } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import topoData from "world-atlas/countries-110m.json";
import { getByNumeric } from "./crosswalk";

export interface CountryFeature extends Feature<Geometry> {
  /** Null for the three disputed territories with no ISO numeric code
   *  (N. Cyprus, Somaliland, Kosovo). They render as no-data land. */
  iso3: string | null;
  name: string;
  /** [minLng, minLat, maxLng, maxLat] — cheap prefilter before geoContains. */
  bbox: [number, number, number, number];
}

let cache: CountryFeature[] | null = null;

function computeBbox(geometry: Geometry): [number, number, number, number] {
  let minLng = 180;
  let minLat = 90;
  let maxLng = -180;
  let maxLat = -90;

  const visit = (coords: unknown): void => {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === "number" && typeof coords[1] === "number") {
      const [lng, lat] = coords as [number, number];
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      return;
    }
    for (const c of coords) visit(c);
  };

  if ("coordinates" in geometry) visit(geometry.coordinates);
  return [minLng, minLat, maxLng, maxLat];
}

/**
 * World country polygons, joined to ISO3 through the numeric bridge.
 *
 * world-atlas keys on ISO 3166-1 NUMERIC while every data source keys on ISO3,
 * which is the whole reason the crosswalk carries a numeric field.
 */
export function getCountryFeatures(): CountryFeature[] {
  if (cache) return cache;

  const topo = topoData as unknown as Topology;
  const fc = feature(topo, topo.objects.countries!) as unknown as FeatureCollection;

  cache = fc.features.map((f) => {
    const numeric =
      f.id === undefined || f.id === null ? null : String(f.id).padStart(3, "0");
    const entry = numeric ? getByNumeric(numeric) : undefined;
    return {
      ...f,
      iso3: entry?.iso3 ?? null,
      name: entry?.name ?? String(f.properties?.["name"] ?? "Unknown"),
      bbox: computeBbox(f.geometry),
    } as CountryFeature;
  });

  return cache;
}

/**
 * Which country contains this point? Exact point-in-polygon via d3-geo, with a
 * bounding-box prefilter so a pointermove costs a handful of real tests.
 *
 * Doing picking on the CPU means the globe needs no per-country meshes and no
 * ID-buffer readback — the sphere stays a single draw call.
 */
export function findCountryAt(lng: number, lat: number): CountryFeature | null {
  for (const f of getCountryFeatures()) {
    const [minLng, minLat, maxLng, maxLat] = f.bbox;
    if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) continue;
    if (geoContains(f, [lng, lat])) return f;
  }
  return null;
}
