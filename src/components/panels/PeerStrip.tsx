import Link from "next/link";
import { ViewTransition } from "react";
import type { Peer } from "@/lib/db/queries";
import { layerColor } from "@/components/charts/primitives";
import { formatMetric } from "@/lib/metrics/scales";

/**
 * The countries either side of this one in a ranking, plus a way to compare
 * them directly.
 *
 * Without this the country page is a dead end — you arrive from the globe or
 * the table and the only way onward is the back button.
 */
export function PeerStrip({
  peers,
  self,
  metricLabel,
  layer,
  unit,
  precision,
}: {
  peers: Peer[];
  self: { iso3: string; name: string; rank: number };
  metricLabel: string;
  layer: string | null;
  unit: string;
  precision: number;
}) {
  if (peers.length === 0) return null;

  const compareHref = `/compare?countries=${[self.iso3, ...peers.slice(0, 3).map((p) => p.iso3)].join(",")}`;

  return (
    <section className="mt-16" aria-labelledby="peers-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2
          id="peers-heading"
          className="text-2xs tracking-[0.2em] text-[var(--text-tertiary)] uppercase"
        >
          Ranked either side on {metricLabel.toLowerCase()}
        </h2>
        <Link
          href={compareHref}
          className="text-2xs tracking-[0.14em] text-[var(--accent)] uppercase underline-offset-4 hover:underline"
        >
          Compare these →
        </Link>
      </div>

      <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[...peers, { ...self, value: null }]
          .sort((a, b) => a.rank - b.rank)
          .map((entry) => {
            const isSelf = entry.iso3 === self.iso3;
            return (
              <li key={entry.iso3}>
                {isSelf ? (
                  <div
                    className="rounded-[var(--radius-lg)] border p-4"
                    style={{
                      borderColor: layerColor(layer, 3),
                      background: "var(--bg-surface)",
                    }}
                    aria-current="true"
                  >
                    <p className="numeric text-2xs text-[var(--text-tertiary)]">
                      #{entry.rank}
                    </p>
                    <p className="mt-1.5 truncate text-sm font-medium text-[var(--text-primary)]">
                      {entry.name}
                    </p>
                    <p className="text-2xs mt-1 text-[var(--text-tertiary)]">
                      This country
                    </p>
                  </div>
                ) : (
                  <Link
                    href={`/countries/${entry.iso3.toLowerCase()}`}
                    className="block rounded-[var(--radius-lg)] border border-[var(--border-subtle)] p-4 transition-colors hover:border-[var(--border-strong)]"
                    style={{ transitionDuration: "var(--dur-ui)" }}
                  >
                    <p className="numeric text-2xs text-[var(--text-tertiary)]">
                      #{entry.rank}
                    </p>
                    <ViewTransition
                      name={`country-name-${entry.iso3}`}
                      share="morph"
                      default="none"
                    >
                      <p className="mt-1.5 truncate text-sm text-[var(--text-secondary)]">
                        {entry.name}
                      </p>
                    </ViewTransition>
                    <p className="numeric text-2xs mt-1 text-[var(--text-tertiary)]">
                      {"value" in entry && entry.value !== null
                        ? formatMetric(entry.value, unit, precision)
                        : ""}
                    </p>
                  </Link>
                )}
              </li>
            );
          })}
      </ol>
    </section>
  );
}
