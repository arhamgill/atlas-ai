import { geoEquirectangular, geoGraticule10, geoPath } from "d3-geo";
import type { CountryFeature } from "./topology";

/**
 * Paints the choropleth into a 2D canvas that is then mapped onto the globe as
 * a texture.
 *
 * Doing it this way means the sphere stays ONE draw call no matter how many
 * countries carry data, layer switches become a GPU crossfade between two
 * textures, and the entire GPU budget is free for atmosphere and bloom.
 *
 * The projection must agree exactly with `sphere.ts`:
 *   x = (lng + 180) / 360 * width      (u)
 *   y = (90 - lat) / 180 * height      (v, flipped by THREE's flipY)
 * which is what geoEquirectangular gives at this translate/scale.
 */
export function createProjection(width: number) {
  const height = width / 2;
  return geoEquirectangular()
    .translate([width / 2, height / 2])
    .scale(width / (2 * Math.PI));
}

export interface ChoroplethOptions {
  features: CountryFeature[];
  valueByIso3: Map<string, number>;
  color: (value: number) => string;
  noDataColor: string;
  oceanColor: string;
  borderColor: string;
  graticuleColor: string;
  width?: number;
}

export function drawChoropleth({
  features,
  valueByIso3,
  color,
  noDataColor,
  oceanColor,
  borderColor,
  graticuleColor,
  width = 4096,
}: ChoroplethOptions): HTMLCanvasElement {
  const height = width / 2;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const projection = createProjection(width);
  const path = geoPath(projection, ctx);

  ctx.fillStyle = oceanColor;
  ctx.fillRect(0, 0, width, height);

  // Graticule first, so land sits on top of the grid.
  ctx.beginPath();
  path(geoGraticule10());
  ctx.strokeStyle = graticuleColor;
  ctx.lineWidth = width / 2048;
  ctx.stroke();

  for (const f of features) {
    const value = f.iso3 ? valueByIso3.get(f.iso3) : undefined;
    ctx.beginPath();
    path(f);
    ctx.fillStyle = value === undefined ? noDataColor : color(value);
    ctx.fill();
  }

  // Borders in a second pass so no fill paints over a neighbour's edge.
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = width / 2600;
  ctx.lineJoin = "round";
  for (const f of features) {
    ctx.beginPath();
    path(f);
    ctx.stroke();
  }

  return canvas;
}

/**
 * A white-on-black mask of specific countries, used by the shader to make the
 * hovered and selected countries glow. Redrawn only when the selection
 * changes, never per frame.
 */
export function drawMask(
  features: CountryFeature[],
  hovered: string | null,
  selected: string | null,
  width = 2048,
): HTMLCanvasElement {
  const height = width / 2;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const projection = createProjection(width);
  const path = geoPath(projection, ctx);

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);

  // Red channel = hover, green channel = selection. One texture, two signals.
  for (const f of features) {
    if (!f.iso3) continue;
    const isHovered = f.iso3 === hovered;
    const isSelected = f.iso3 === selected;
    if (!isHovered && !isSelected) continue;

    ctx.beginPath();
    path(f);
    ctx.fillStyle = `rgb(${isHovered ? 255 : 0}, ${isSelected ? 255 : 0}, 0)`;
    ctx.fill();

    ctx.beginPath();
    path(f);
    ctx.strokeStyle = `rgb(${isHovered ? 255 : 0}, ${isSelected ? 255 : 0}, 255)`;
    ctx.lineWidth = width / 500;
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  return canvas;
}
