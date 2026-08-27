import { layerColor } from "./primitives";

/**
 * An inline magnitude bar for a table row.
 *
 * One colour for the whole column, never a value-ramp: the bar's length already
 * encodes magnitude, and shading it darker-where-bigger would spend the only
 * free channel restating what the length says.
 *
 * The scale is square-root, not linear. Private AI investment spans six orders
 * of magnitude — the United States at $301B against small economies in the
 * single-digit millions — so on a linear scale every bar but one is invisible.
 */
export function BarCell({
  value,
  max,
  layer,
  width = 64,
}: {
  value: number;
  max: number;
  layer: string | null;
  width?: number;
}) {
  const ratio = max > 0 ? Math.sqrt(Math.max(0, value) / max) : 0;
  const filled = Math.max(value > 0 ? 2 : 0, ratio * width);

  return (
    <span className="inline-block align-middle" style={{ width }} aria-hidden>
      <span
        className="block h-[5px] overflow-hidden rounded-full"
        style={{ background: "var(--border-subtle)" }}
      >
        <span
          className="block h-full rounded-full"
          style={{ width: `${filled}px`, background: layerColor(layer, 4) }}
        />
      </span>
    </span>
  );
}
