/**
 * Sphere <-> geography conversions.
 *
 * The globe is a single textured sphere, so these two functions are the entire
 * contract between the map we paint and the points the user clicks. They must
 * be exact inverses of each other, and they must agree with the equirectangular
 * projection used in `render-maps.ts` — hence the round-trip tests.
 *
 * Derived from THREE.SphereGeometry's own parameterisation:
 *   theta = (90 - lat) in radians, measured from +Y
 *   phi   = (lng + 180) in radians
 *   x = -cos(phi) * sin(theta),  y = cos(theta),  z = sin(phi) * sin(theta)
 */

const DEG = Math.PI / 180;

export interface LatLng {
  lat: number;
  lng: number;
}

export function latLngToVector3(
  lat: number,
  lng: number,
  radius = 1,
): [number, number, number] {
  const theta = (90 - lat) * DEG;
  const phi = (lng + 180) * DEG;
  const sinTheta = Math.sin(theta);
  return [
    -radius * Math.cos(phi) * sinTheta,
    radius * Math.cos(theta),
    radius * Math.sin(phi) * sinTheta,
  ];
}

export function vector3ToLatLng(x: number, y: number, z: number): LatLng {
  const r = Math.sqrt(x * x + y * y + z * z) || 1;
  const lat = Math.asin(Math.max(-1, Math.min(1, y / r))) / DEG;
  let lng = Math.atan2(z, -x) / DEG - 180;
  // Wrap into [-180, 180) so d3-geo's point-in-polygon behaves at the seam.
  while (lng < -180) lng += 360;
  while (lng >= 180) lng -= 360;
  return { lat, lng };
}

/** Shortest angular distance in degrees — used to ease camera flights. */
export function angularDistance(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * DEG;
  const dLng = (b.lng - a.lng) * DEG;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin(dLng / 2) ** 2;
  return (2 * Math.asin(Math.min(1, Math.sqrt(h)))) / DEG;
}
