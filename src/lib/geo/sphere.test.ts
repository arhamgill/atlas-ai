import { describe, expect, it } from "vitest";
import { latLngToVector3, vector3ToLatLng } from "./sphere";
import { findCountryAt, getCountryFeatures } from "./topology";

describe("sphere projection round trip", () => {
  it.each([
    ["equator/prime meridian", 0, 0],
    ["north", 45, 10],
    ["south", -33.9, 151.2],
    ["far west", 12, -170],
    ["far east", -12, 170],
    ["near north pole", 89, 5],
  ])("%s survives lat/lng -> vec3 -> lat/lng", (_label, lat, lng) => {
    const [x, y, z] = latLngToVector3(lat, lng);
    const back = vector3ToLatLng(x, y, z);
    expect(back.lat).toBeCloseTo(lat, 6);
    expect(back.lng).toBeCloseTo(lng, 6);
  });

  it("puts the poles on the Y axis", () => {
    const [, ny] = latLngToVector3(90, 0);
    const [, sy] = latLngToVector3(-90, 0);
    expect(ny).toBeCloseTo(1, 6);
    expect(sy).toBeCloseTo(-1, 6);
  });

  it("keeps points on the unit sphere", () => {
    const [x, y, z] = latLngToVector3(37.7, -122.4);
    expect(Math.sqrt(x * x + y * y + z * z)).toBeCloseTo(1, 6);
  });
});

describe("country picking", () => {
  it("loads and joins the world topology", () => {
    const features = getCountryFeatures();
    expect(features.length).toBeGreaterThan(150);
    const joined = features.filter((f) => f.iso3 !== null);
    // The three unmatched are disputed territories with no ISO numeric code.
    expect(features.length - joined.length).toBe(3);
  });

  // Real capitals — this is the end-to-end check that the projection, the
  // topology and the ISO3 join all agree.
  it.each([
    ["Paris", 48.85, 2.35, "FRA"],
    ["Tokyo", 35.68, 139.69, "JPN"],
    ["Brasilia", -15.79, -47.88, "BRA"],
    ["Canberra", -35.28, 149.13, "AUS"],
    ["Nairobi", -1.29, 36.82, "KEN"],
    ["Ottawa", 45.42, -75.69, "CAN"],
    ["New Delhi", 28.61, 77.21, "IND"],
  ])("finds %s -> %s", (_city, lat, lng, iso3) => {
    expect(findCountryAt(lng, lat)?.iso3).toBe(iso3);
  });

  it("resolves a point through the sphere, as the globe actually does", () => {
    // Exactly the path a click takes: 3D intersection -> lat/lng -> country.
    const [x, y, z] = latLngToVector3(48.85, 2.35);
    const { lat, lng } = vector3ToLatLng(x, y, z);
    expect(findCountryAt(lng, lat)?.iso3).toBe("FRA");
  });

  it("returns null over open ocean", () => {
    expect(findCountryAt(-140, 0)).toBeNull();
  });
});
