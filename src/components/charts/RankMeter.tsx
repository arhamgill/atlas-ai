import { layerColor } from "./primitives";

/**
 * Where a country sits in a ranking, as a position on a track.
 *
 * "#67 of 147" is precise but gives no sense of scale — this shows the same
 * fact spatially. The unfilled track is a lighter step of the same ramp rather
 * than plain grey, so the state reads across the whole bar.
 */
export function RankMeter({
  rank,
  total,
  layer,
  label,
}: {
  rank: number;
  total: number;
  layer: string | null;
  label?: string;
}) {
  if (!rank || !total) return null;
  // Rank 1 sits at the full-strength end; last sits at the empty end.
  const pct = total <= 1 ? 1 : 1 - (rank - 1) / (total - 1);

  return (
    <span
      className="relative block h-1 w-full overflow-hidden rounded-full"
      style={{ background: layerColor(layer, 1) }}
      role="img"
      aria-label={label ?? `Rank ${rank} of ${total}`}
    >
      <span
        className="absolute inset-y-0 left-0 rounded-full"
        style={{
          width: `${Math.max(2, pct * 100)}%`,
          background: layerColor(layer, 4),
        }}
      />
    </span>
  );
}
