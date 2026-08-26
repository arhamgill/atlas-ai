import { getAtlasTotals, getLayerSummaries } from "@/lib/db/queries";

/**
 * V0 status page. Every figure is read live from Postgres — nothing on this
 * page is hard-coded, so what you see is exactly what the ingest produced.
 * Replaced in V1 by the globe hero.
 */

export const revalidate = 3600;

function formatValue(value: number, unit: string, precision: number): string {
  if (unit === "percent") return `${value.toFixed(precision)}%`;
  if (unit === "usd") {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    return `$${value.toLocaleString("en-US")}`;
  }
  return value.toLocaleString("en-US");
}

function formatPeriod(period: string): string {
  if (!period.includes("-")) return period;
  const [y, m] = period.split("-");
  const q = { "03": "Q1", "06": "Q2", "09": "Q3", "12": "Q4" }[m ?? ""] ?? "";
  return `${q} ${y}`;
}

export default async function Home() {
  const [layers, totals] = await Promise.all([getLayerSummaries(), getAtlasTotals()]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-16 sm:py-24">
      <p className="numeric text-2xs tracking-[0.2em] text-[var(--text-tertiary)] uppercase">
        V0 · Foundation
      </p>

      <h1 className="mt-4 text-[length:var(--text-2xl)] leading-[1.05] font-medium tracking-tight">
        AI Atlas
      </h1>
      <p className="mt-3 max-w-xl text-[length:var(--text-base)] text-[var(--text-secondary)]">
        The global AI race, visualized. Every figure below is read live from Postgres —
        nothing on this page is hard-coded.
      </p>

      {/* Totals */}
      <dl className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--border-subtle)] sm:grid-cols-4">
        {[
          { label: "Countries", value: totals.countries },
          { label: "Metric rows", value: totals.metricRows },
          { label: "Models", value: totals.models },
          { label: "Sources", value: totals.sources },
        ].map((t) => (
          <div key={t.label} className="bg-[var(--bg-surface)] px-5 py-4">
            <dt className="text-2xs tracking-[0.14em] text-[var(--text-tertiary)] uppercase">
              {t.label}
            </dt>
            <dd className="numeric mt-2 text-[length:var(--text-xl)] leading-none">
              {t.value.toLocaleString("en-US")}
            </dd>
          </div>
        ))}
      </dl>

      {/* Layers */}
      <h2 className="text-2xs mt-16 tracking-[0.2em] text-[var(--text-tertiary)] uppercase">
        Globe layers
      </h2>

      <div className="mt-4 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--border-subtle)] sm:grid-cols-2">
        {layers.map((layer) => (
          <section key={layer.key} className="bg-[var(--bg-surface)] p-5">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="text-[length:var(--text-sm)] font-medium">
                {layer.label}
              </h3>
              <span className="numeric text-xs text-[var(--text-tertiary)]">
                {layer.countryCount} countries
              </span>
            </div>

            <div
              className="mt-4 flex h-1.5 overflow-hidden rounded-[var(--radius-sm)]"
              role="img"
              aria-label={`${layer.label} colour ramp, five steps`}
            >
              {[1, 2, 3, 4, 5].map((step) => (
                <span
                  key={step}
                  className="flex-1"
                  style={{ background: `var(--ramp-${layer.layer}-${step})` }}
                />
              ))}
            </div>

            <p className="mt-3 text-xs text-[var(--text-tertiary)]">
              {layer.periodCount} periods · {formatPeriod(layer.firstPeriod)} –{" "}
              {formatPeriod(layer.latestPeriod)}
            </p>

            <ol className="mt-4 space-y-1.5">
              {layer.leaders.map((l) => (
                <li key={l.iso3} className="flex items-baseline gap-3 text-xs">
                  <span className="numeric w-5 text-[var(--text-tertiary)]">
                    #{l.rank}
                  </span>
                  <span className="flex-1 truncate text-[var(--text-secondary)]">
                    {l.name}
                  </span>
                  <span className="numeric text-[var(--text-primary)]">
                    {formatValue(l.value, layer.unit, layer.precision)}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-[var(--text-tertiary)]">
        <span className="flex items-center gap-2">
          <span
            className="inline-block size-3 rounded-[var(--radius-sm)]"
            style={{ background: "var(--no-data)" }}
          />
          No data
        </span>
        <span className="flex items-center gap-2">
          <span
            className="inline-block size-3 rounded-[var(--radius-sm)]"
            style={{ background: "var(--accent)" }}
          />
          Accent (interactive only)
        </span>
        <a
          href="https://github.com/microsoft/ai-diffusion-report"
          className="text-[var(--accent)] underline-offset-4 hover:underline"
          rel="noreferrer"
        >
          Primary source
        </a>
      </div>

      <p className="mt-14 max-w-2xl border-t border-[var(--border-subtle)] pt-6 text-xs leading-relaxed text-[var(--text-tertiary)]">
        Next: the interactive globe. Development covers only{" "}
        {layers.find((l) => l.layer === "development")?.countryCount ?? 0} countries —
        that concentration is the story of that layer, not a gap to fill.
      </p>
    </main>
  );
}
