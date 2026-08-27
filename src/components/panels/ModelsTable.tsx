import type { CountryModel } from "@/lib/db/queries";
import { layerColor } from "@/components/charts/primitives";

/**
 * Notable models built in a country.
 *
 * Server-rendered. Sorting these twelve rows would need a client component on
 * all 194 static country pages, which is a poor trade for reordering a dozen
 * items — they already arrive newest first, which is the order people want.
 */

/** Training compute spans ~1e15 to ~1e26 FLOP, so the bar is log-scaled;
 *  on a linear scale every model but the frontier ones is invisible. */
function computeFraction(flop: number | null, maxLog: number, minLog: number): number {
  if (!flop || flop <= 0) return 0;
  const l = Math.log10(flop);
  if (maxLog === minLog) return 1;
  return Math.max(0.04, Math.min(1, (l - minLog) / (maxLog - minLog)));
}

function formatFlop(flop: number | null): string {
  if (!flop || flop <= 0) return "—";
  const exp = Math.floor(Math.log10(flop));
  const mant = flop / Math.pow(10, exp);
  return `${mant.toFixed(1)}e${exp}`;
}

export function ModelsTable({
  models,
  total,
}: {
  models: CountryModel[];
  total: number;
}) {
  const logs = models
    .map((m) => m.trainingComputeFlop)
    .filter((f): f is number => !!f && f > 0)
    .map((f) => Math.log10(f));
  const minLog = logs.length ? Math.min(...logs) : 0;
  const maxLog = logs.length ? Math.max(...logs) : 1;
  /*
   * Only show the column when enough models disclose it. Frontier labs mostly
   * do not publish training compute, so for a country like the United States
   * ten of the twelve most recent rows read "Not disclosed" — a column that is
   * five-sixths empty tells the reader nothing the footnote cannot.
   */
  const anyCompute = models.length > 0 && logs.length / models.length >= 0.25;

  return (
    <div className="mt-4 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border-subtle)]">
      <table className="w-full min-w-[680px] border-collapse text-left">
        <caption className="sr-only">
          The {models.length} most recently published notable AI models built in this
          country, of {total} all time.
        </caption>
        <thead>
          <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            {["Model", "Organization", "Domain"].map((h) => (
              <th
                key={h}
                scope="col"
                className="text-2xs px-4 py-2.5 font-normal tracking-[0.14em] text-[var(--text-tertiary)] uppercase"
              >
                {h}
              </th>
            ))}
            {anyCompute && (
              <th
                scope="col"
                className="text-2xs px-4 py-2.5 font-normal tracking-[0.14em] text-[var(--text-tertiary)] uppercase"
              >
                Training compute
              </th>
            )}
            <th
              scope="col"
              className="text-2xs px-4 py-2.5 text-right font-normal tracking-[0.14em] text-[var(--text-tertiary)] uppercase"
            >
              Published
            </th>
          </tr>
        </thead>
        <tbody>
          {models.map((model) => (
            <tr
              key={model.id}
              className="border-b border-[var(--border-subtle)] transition-colors last:border-0 hover:bg-[var(--bg-surface)]"
            >
              <td className="px-4 py-2.5 text-sm text-[var(--text-primary)]">
                {model.link ? (
                  <a
                    href={model.link}
                    rel="noreferrer noopener"
                    target="_blank"
                    className="underline-offset-4 hover:text-[var(--accent)] hover:underline"
                  >
                    {model.name}
                  </a>
                ) : (
                  model.name
                )}
              </td>

              <td className="px-4 py-2.5 text-sm text-[var(--text-secondary)]">
                {model.organization ?? "—"}
              </td>

              <td className="px-4 py-2.5">
                {model.domain ? (
                  <span className="flex flex-wrap gap-1">
                    {model.domain
                      .split(",")
                      .map((d) => d.trim())
                      .filter(Boolean)
                      .slice(0, 3)
                      .map((d) => (
                        <span
                          key={d}
                          className="text-2xs rounded-full border border-[var(--border-subtle)] px-1.5 py-0.5 text-[var(--text-tertiary)]"
                        >
                          {d}
                        </span>
                      ))}
                  </span>
                ) : (
                  <span className="text-sm text-[var(--no-data-text)]">—</span>
                )}
              </td>

              {anyCompute && (
                <td className="px-4 py-2.5">
                  {model.trainingComputeFlop ? (
                    <span className="flex items-center gap-2.5">
                      <span
                        className="inline-block h-[5px] w-16 overflow-hidden rounded-full"
                        style={{ background: "var(--border-subtle)" }}
                        aria-hidden
                      >
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${computeFraction(model.trainingComputeFlop, maxLog, minLog) * 100}%`,
                            background: layerColor("development", 4),
                          }}
                        />
                      </span>
                      <span className="numeric text-2xs text-[var(--text-secondary)]">
                        {formatFlop(model.trainingComputeFlop)}
                      </span>
                    </span>
                  ) : (
                    <span className="text-2xs text-[var(--no-data-text)]">
                      Not disclosed
                    </span>
                  )}
                </td>
              )}

              <td className="numeric px-4 py-2.5 text-right text-sm text-[var(--text-secondary)]">
                {model.publicationDate ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {anyCompute && (
        <p className="text-2xs border-t border-[var(--border-subtle)] px-4 py-2.5 text-[var(--text-tertiary)]">
          Compute bars are log-scaled across the models shown, in FLOP. Many
          organisations do not disclose it.
        </p>
      )}
    </div>
  );
}
