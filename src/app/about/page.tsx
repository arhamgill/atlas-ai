import type { Metadata } from "next";
import Link from "next/link";
import { layerColor } from "@/components/charts/primitives";
import { getAtlasTotals, getCountryTable } from "@/lib/db/queries";
import { formatPeriod } from "@/lib/metrics/scales";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "About",
  description:
    "How AI Atlas is built: a verified ETL pipeline into Postgres, a single-sphere WebGL globe, and the decisions behind both.",
};

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-[var(--border-subtle)] py-12">
      <div className="grid gap-6 lg:grid-cols-[180px_1fr] lg:gap-12">
        <div>
          <span className="numeric text-2xs tracking-[0.2em] text-[var(--text-tertiary)]">
            {n}
          </span>
          <h2 className="mt-1.5 text-[length:var(--text-lg)] leading-tight font-medium tracking-tight">
            {title}
          </h2>
        </div>
        <div className="max-w-2xl space-y-4 text-sm leading-relaxed text-[var(--text-secondary)]">
          {children}
        </div>
      </div>
    </section>
  );
}

export default async function AboutPage() {
  const [totals, table] = await Promise.all([getAtlasTotals(), getCountryTable()]);

  return (
    <main className="mx-auto w-full max-w-[var(--shell-max)] px-4 pt-24 pb-24 sm:px-8">
      <h1 className="max-w-2xl text-[length:var(--text-2xl)] leading-tight font-medium tracking-tight text-balance">
        A WebGL globe and a real data pipeline, in the same repository.
      </h1>
      <p className="mt-5 max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)]">
        AI Atlas visualizes four dimensions of the global AI landscape — adoption,
        investment, model development and research. Every figure on screen traces to a
        row in Postgres, which traces to a dated snapshot of a published dataset.
        Nothing is illustrative.
      </p>

      {/* ---------- Live totals ---------- */}
      <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--border-subtle)] sm:grid-cols-4">
        {[
          { label: "Countries with data", value: totals.countries },
          { label: "Metric rows", value: totals.metricRows },
          { label: "Notable models", value: totals.models },
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
      <p className="numeric text-2xs mt-2 text-[var(--text-tertiary)]">
        Read live from the database on this page load.
      </p>

      <Section n="01" title="The data, and what was wrong with it">
        <p>
          Four layers, each verified against source before any interface existed. Of the
          seven chart slugs originally planned, <strong>four were wrong</strong> — two
          had been renamed upstream and returned 404, and two were not country-level at
          all: their entity column held a category (deal type, or academia versus
          industry) rather than a country.
        </p>
        <p>
          Replacements were found by querying Our World in Data&rsquo;s search endpoint,
          which returns the available entities for each chart. Testing whether that list
          contains real country names is a one-request check for whether a chart is
          country-level. That check now ships as a script, because hand-guessing a slug
          is how the original four went wrong.
        </p>
        <div className="mt-6 grid gap-px overflow-hidden rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--border-subtle)] sm:grid-cols-2">
          {table.layers.map((l) => (
            <div key={l.key} className="bg-[var(--bg-surface)] p-4">
              <span className="flex items-center gap-2">
                <span
                  className="inline-block size-2 rounded-[2px]"
                  style={{ background: layerColor(l.layer, 4) }}
                />
                <span className="text-xs font-medium text-[var(--text-primary)]">
                  {l.label}
                </span>
              </span>
              <p className="numeric text-2xs mt-2 text-[var(--text-tertiary)]">
                {l.total} countries · {formatPeriod(l.period)}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section n="02" title="Country identity is the hard part">
        <p>
          Four ID systems collide here. Our World in Data publishes ISO3 codes; Epoch AI
          publishes official ISO 3166 long-form names; the globe&rsquo;s TopoJSON
          geometry keys on ISO 3166-1 <em>numeric</em>; curated data uses whatever gets
          typed.
        </p>
        <p>
          A single crosswalk resolves all of them — 250 countries, 1,088 indexed
          aliases, zero collisions — with a token-key fallback so{" "}
          <span className="numeric text-[var(--text-primary)]">
            &ldquo;Korea (Republic of)&rdquo;
          </span>{" "}
          matches{" "}
          <span className="numeric text-[var(--text-primary)]">
            &ldquo;Republic of Korea&rdquo;
          </span>{" "}
          without hand-writing every permutation.
        </p>
        <p>
          The ingest <strong>throws</strong> on a name it cannot resolve. The natural
          failure mode of a name-matching pipeline is to silently skip what it cannot
          match, and a map that quietly loses fifteen countries looks completely fine
          until somebody checks.
        </p>
      </Section>

      <Section n="03" title="The globe is one sphere, not 177 meshes">
        <p>
          The obvious approach renders each country as its own mesh. Instead the
          choropleth is painted into a 2048×1024 canvas and mapped onto a single sphere.
          The sphere is one draw call regardless of how many countries carry data, and
          switching layers becomes a GPU crossfade between two textures rather than 177
          mesh updates.
        </p>
        <p>
          Picking runs on the CPU: the raycast hit converts to latitude and longitude,
          then point-in-polygon with a bounding-box prefilter. Exact, and no ID-buffer
          readback. That works because{" "}
          <strong>the globe never rotates — the camera orbits</strong>, so world space
          and globe space stay identical and a hit needs no rotation unwound.
        </p>
        <p>Everything that was freed up went into atmosphere, bloom and a starfield.</p>
      </Section>

      <Section n="04" title="Adding a layer is a data change, not a migration">
        <p>
          Metrics are stored tall — one row per country, per metric, per period — with
          metric metadata in its own table the app reads at runtime. A fifth globe layer
          is a row in that table plus an ingest source: no migration, no component
          change. The layer switcher discovers it.
        </p>
        <p>
          The cost is real and worth naming: every read filters on a metric key, and
          type safety over those keys lives in a registry rather than in the column
          list. Ingest rejects any row whose key has no definition, so a typo cannot
          create a phantom metric.
        </p>
      </Section>

      <Section n="05" title="What this deliberately does not do">
        <p>
          <strong>There is no overall AI score.</strong> It would be the obvious
          feature. The United Arab Emirates leads adoption, the United States leads
          investment and model development, China leads research — three dimensions,
          three different winners. Producing one ranking means deciding how many
          published papers a billion dollars is worth, and there is no defensible
          answer. Publishing one anyway would launder an opinion into something that
          looks like a measurement.
        </p>
        <p>
          <strong>Missing data is never a zero.</strong> It has its own colour token and
          a permanent place in every legend. The development layer covers 34 countries;
          most of the map is empty because most of the world has never produced a
          frontier model. That emptiness is the finding.
        </p>
        <p>
          A planned &ldquo;fastest rising&rdquo; view is also on hold. The adoption
          estimates are modelled, and low-data countries are imputed in regional blocks
          — twelve West African countries share exactly 10.1%. Rank movement inside such
          a block is an artefact of the model, not a national trend, so the feature
          needs an honest answer before it ships.
        </p>
      </Section>

      <Section n="06" title="Stack">
        <p>
          Next.js 16 with the App Router and React 19, TypeScript in strict mode with
          unchecked indexed access enabled — this project parses a lot of CSV. three.js
          through React Three Fiber for the globe, with custom shaders. Tailwind v4 over
          a single file of design tokens. Charts are hand-built React and SVG on d3
          scales, with no chart library. Neon serverless Postgres through Drizzle.
          Zustand for scene state, nuqs to mirror it into the URL. Vitest and
          Playwright.
        </p>
        <p>
          Country pages are statically generated and revalidated hourly, so the database
          is never on the critical render path.
        </p>
      </Section>

      <footer className="border-t border-[var(--border-subtle)] pt-10">
        <p className="max-w-2xl text-sm text-[var(--text-secondary)]">
          Data from{" "}
          <a
            className="text-[var(--accent)] underline-offset-4 hover:underline"
            href="https://ourworldindata.org"
            rel="noreferrer"
          >
            Our World in Data
          </a>
          ,{" "}
          <a
            className="text-[var(--accent)] underline-offset-4 hover:underline"
            href="https://github.com/microsoft/ai-diffusion-report"
            rel="noreferrer"
          >
            Microsoft
          </a>
          ,{" "}
          <a
            className="text-[var(--accent)] underline-offset-4 hover:underline"
            href="https://epoch.ai/data/notable-ai-models"
            rel="noreferrer"
          >
            Epoch AI
          </a>{" "}
          and{" "}
          <a
            className="text-[var(--accent)] underline-offset-4 hover:underline"
            href="https://hai.stanford.edu/ai-index"
            rel="noreferrer"
          >
            Stanford HAI
          </a>
          , under their respective licences.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-[var(--radius)] border border-[var(--border-strong)] px-4 py-2 text-xs transition-colors hover:border-[var(--border-accent)] hover:text-[var(--accent)]"
          >
            Open the globe
          </Link>
          <Link
            href="/countries"
            className="rounded-[var(--radius)] border border-[var(--border-subtle)] px-4 py-2 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
          >
            Browse countries
          </Link>
        </div>
      </footer>
    </main>
  );
}
