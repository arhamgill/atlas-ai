/**
 * V0 placeholder. Exists to verify the design tokens resolve end-to-end
 * before any real UI is built. Replaced in V1 by the globe hero.
 */

const LAYERS = [
  { key: "adoption", label: "Adoption", countries: 147, source: "Microsoft / OWID" },
  { key: "investment", label: "Investment", countries: 119, source: "CSET / OWID" },
  { key: "development", label: "Development", countries: 35, source: "Epoch AI" },
  { key: "research", label: "Research", countries: 189, source: "OWID" },
] as const;

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-20">
      <p className="numeric text-2xs tracking-[0.2em] text-[var(--text-tertiary)] uppercase">
        V0 · Foundation
      </p>

      <h1 className="mt-4 text-[length:var(--text-2xl)] leading-[1.1] font-medium tracking-tight">
        AI Atlas
      </h1>
      <p className="mt-3 max-w-xl text-[length:var(--text-base)] text-[var(--text-secondary)]">
        The global AI race, visualized. Design tokens and layer ramps below — if these
        render correctly, the token pipeline is wired.
      </p>

      <div className="mt-14 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--border-subtle)] sm:grid-cols-2">
        {LAYERS.map((layer) => (
          <section key={layer.key} className="bg-[var(--bg-surface)] p-5">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-[length:var(--text-sm)] font-medium">
                {layer.label}
              </h2>
              <span className="numeric text-xs text-[var(--text-tertiary)]">
                {layer.countries} countries
              </span>
            </div>

            <div
              className="mt-4 flex h-2 overflow-hidden rounded-[var(--radius-sm)]"
              role="img"
              aria-label={`${layer.label} colour ramp, five steps`}
            >
              {[1, 2, 3, 4, 5].map((step) => (
                <span
                  key={step}
                  className="flex-1"
                  style={{ background: `var(--ramp-${layer.key}-${step})` }}
                />
              ))}
            </div>

            <p className="mt-3 text-xs text-[var(--text-tertiary)]">{layer.source}</p>
          </section>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-6 text-xs text-[var(--text-tertiary)]">
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
    </main>
  );
}
