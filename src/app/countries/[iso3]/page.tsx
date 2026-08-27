import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TimeSeries } from "@/components/charts/TimeSeries";
import { layerColor } from "@/components/charts/primitives";
import { CountryLocator } from "@/components/panels/CountryLocator";
import { MetricTile } from "@/components/panels/MetricTile";
import { ModelsTable } from "@/components/panels/ModelsTable";
import { PeerStrip } from "@/components/panels/PeerStrip";
import { Reveal } from "@/components/ui/Reveal";
import { getCountriesWithData, getCountryDetail, getPeers } from "@/lib/db/queries";
import { formatMetric, formatPeriod } from "@/lib/metrics/scales";

/**
 * Country pages are statically generated and revalidated hourly, so the
 * database is never on the critical render path for the most-linked route in
 * the product.
 */
export const revalidate = 3600;

/**
 * Only the countries that actually have data get a page, and anything else is
 * a real 404.
 *
 * With dynamicParams enabled, Next renders unknown paths on demand — and
 * because generateMetadata resolved before the page threw notFound(), the
 * response had already committed a 200. /countries/zzz served the not-found
 * body under a 200 status, which is exactly what a crawler indexes as a valid
 * page. Restricting to prebuilt params makes the status honest.
 */
export const dynamicParams = false;

export async function generateStaticParams() {
  const iso3 = await getCountriesWithData();
  return iso3.map((code) => ({ iso3: code.toLowerCase() }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ iso3: string }>;
}): Promise<Metadata> {
  const { iso3 } = await params;
  const country = await getCountryDetail(iso3);
  if (!country) return { title: "Country not found" };

  const adoption = country.metrics.find((m) => m.layer === "adoption")?.latest;
  const description = adoption
    ? `${country.name}: ${formatMetric(adoption.value, "percent", 1)} generative AI adoption, ranked #${adoption.rank} of ${adoption.total}. Investment, research and model development compared.`
    : `AI adoption, investment, research and model development for ${country.name}.`;

  return { title: country.name, description };
}

export default async function CountryPage({
  params,
}: {
  params: Promise<{ iso3: string }>;
}) {
  const { iso3 } = await params;
  const country = await getCountryDetail(iso3);
  if (!country) notFound();

  const withData = country.metrics.filter((m) => m.latest !== null);

  // The hero is the dimension this country leads on — a genuine editorial
  // statement, and far more informative than repeating whichever metric
  // happens to be first. Ranked by percentile so layers with wildly different
  // country counts compare fairly.
  const strongest = withData
    .filter((m) => m.latest?.rank)
    .sort((a, b) => {
      const pa = (a.latest!.rank! - 1) / Math.max(1, a.latest!.total - 1);
      const pb = (b.latest!.rank! - 1) / Math.max(1, b.latest!.total - 1);
      return pa - pb;
    })[0];

  /*
   * "Strongest on X" is faint praise when X is 94th of 181. The verb has to
   * match the rank, or the sentence overstates what the data says.
   */
  const strongestVerb = (() => {
    const l = strongest?.latest;
    if (!l?.rank) return null;
    const pct = (l.rank - 1) / Math.max(1, l.total - 1);
    if (l.rank <= 10) return "Leads on";
    if (pct <= 0.25) return "Strong on";
    if (pct <= 0.5) return "Ranks best on";
    return "Ranks highest on";
  })();

  const uncovered = country.metrics.filter((m) => m.latest === null);

  const charts = country.metrics.filter((m) => m.series.length >= 2);

  // Peers on the country's own strongest dimension — the ranking where it is
  // most interesting to see who sits either side of it.
  const peers =
    strongest?.latest?.rank != null ? await getPeers(strongest.key, country.iso3) : [];

  return (
    <main className="mx-auto w-full max-w-[var(--shell-max)] px-4 pt-24 pb-24 sm:px-8">
      {/* ---------- Hero ---------- */}
      <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            href="/countries"
            className="numeric text-2xs tracking-[0.18em] text-[var(--text-tertiary)] uppercase transition-colors hover:text-[var(--text-secondary)]"
          >
            ← All countries
          </Link>

          <h1 className="mt-4 text-[length:var(--text-3xl)] leading-[0.95] font-medium tracking-tight text-balance">
            {country.name}
          </h1>

          <p className="numeric mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-tertiary)]">
            <span className="tracking-[0.18em] uppercase">{country.iso3}</span>
            {country.region && <span>· {country.region}</span>}
            {country.subregion && country.subregion !== country.region && (
              <span>· {country.subregion}</span>
            )}
          </p>

          {country.officialName !== country.name && (
            <p className="mt-2 max-w-md text-xs text-[var(--text-tertiary)]">
              {country.officialName}
            </p>
          )}

          {strongest?.latest && (
            <p className="mt-8 max-w-lg text-[length:var(--text-lg)] leading-snug text-[var(--text-secondary)]">
              {strongestVerb}{" "}
              <span
                className="font-medium"
                style={{ color: layerColor(strongest.layer, 5) }}
              >
                {strongest.shortLabel.toLowerCase()}
              </span>
              {" — "}
              <span className="numeric text-[var(--text-primary)]">
                #{strongest.latest.rank}
              </span>{" "}
              of {strongest.latest.total} countries.
            </p>
          )}
        </div>

        <CountryLocator iso3={country.iso3} layer={strongest?.layer ?? "adoption"} />
      </div>

      {/* ---------- Metric tiles ---------- */}
      <section className="mt-14" aria-labelledby="metrics-heading">
        <h2
          id="metrics-heading"
          className="text-2xs tracking-[0.2em] text-[var(--text-tertiary)] uppercase"
        >
          The four dimensions
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {country.metrics.map((metric, i) => (
            <Reveal key={metric.key} delay={i * 60}>
              <MetricTile metric={metric} iso3={country.iso3} />
            </Reveal>
          ))}
        </div>
        {uncovered.length > 0 && (
          <p className="text-2xs mt-3 text-[var(--text-tertiary)]">
            No source covers {country.name} for{" "}
            {uncovered.map((m) => m.shortLabel.toLowerCase()).join(" or ")}. Shown as no
            data, never as zero.
          </p>
        )}
      </section>

      {/* ---------- Time series ----------
          Four separate plots, one axis each. The layers have incompatible
          units, and a shared axis would need a second y-scale whose alignment
          is arbitrary — inventing a correlation that is not in the data. */}
      {charts.length > 0 && (
        <section className="mt-16" aria-labelledby="trends-heading">
          <h2
            id="trends-heading"
            className="text-2xs tracking-[0.2em] text-[var(--text-tertiary)] uppercase"
          >
            Over time
          </h2>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {charts.map((metric, i) => (
              <Reveal key={metric.key} delay={i * 70}>
                <article className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block size-2 rounded-[2px]"
                      style={{ background: layerColor(metric.layer, 4) }}
                    />
                    <h3 className="text-[length:var(--text-sm)] font-medium">
                      {metric.label}
                    </h3>
                  </div>
                  <div className="mt-4">
                    <TimeSeries
                      points={metric.series}
                      layer={metric.layer}
                      unit={metric.unit}
                      precision={metric.precision}
                      label={metric.label}
                      showRank={metric.key !== "development.notable_models"}
                    />
                  </div>
                  {metric.methodologyNote && (
                    /* Native <details>: no JS, keyboard-operable and findable by
                     in-page search even while collapsed. These notes ran four
                     lines and were routinely taller than the chart above them. */
                    <details className="mt-4 border-t border-[var(--border-subtle)] pt-3">
                      <summary className="text-2xs cursor-pointer list-none tracking-[0.14em] text-[var(--text-tertiary)] uppercase transition-colors hover:text-[var(--text-secondary)]">
                        Method &amp; caveats
                      </summary>
                      <p className="text-2xs mt-2.5 leading-relaxed text-[var(--text-tertiary)]">
                        {metric.methodologyNote}
                      </p>
                    </details>
                  )}
                </article>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* ---------- Notable models ---------- */}
      {country.models.length > 0 && (
        <section className="mt-16" aria-labelledby="models-heading">
          <div className="flex items-baseline justify-between gap-4">
            <h2
              id="models-heading"
              className="text-2xs tracking-[0.2em] text-[var(--text-tertiary)] uppercase"
            >
              Notable AI models
            </h2>
            <span className="numeric text-2xs text-[var(--text-tertiary)]">
              {country.modelCount} all time · showing {country.models.length} most
              recent
            </span>
          </div>

          <ModelsTable models={country.models} total={country.modelCount} />
        </section>
      )}

      {strongest?.latest?.rank != null && (
        <PeerStrip
          peers={peers}
          self={{
            iso3: country.iso3,
            name: country.name,
            rank: strongest.latest.rank,
          }}
          metricLabel={strongest.shortLabel}
          layer={strongest.layer}
          unit={strongest.unit}
          precision={strongest.precision}
        />
      )}

      {/* ---------- Provenance ---------- */}
      <footer className="mt-16 border-t border-[var(--border-subtle)] pt-6">
        <p className="text-2xs leading-relaxed text-[var(--text-tertiary)]">
          Every figure on this page comes from a dated snapshot of a published dataset.
          Adoption from the Microsoft AI Diffusion Report via Our World in Data;
          investment from CSET; research from the Stanford AI Index; models from Epoch
          AI. Missing values are shown as no data, never as zero.
        </p>
        {withData[0]?.latest && (
          <p className="numeric text-2xs mt-3 text-[var(--text-tertiary)]">
            Latest period: {formatPeriod(withData[0].latest.period)}
          </p>
        )}
      </footer>
    </main>
  );
}
