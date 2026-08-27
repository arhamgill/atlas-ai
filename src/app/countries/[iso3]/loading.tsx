/**
 * Skeleton matching the country page's real geometry, so the layout does not
 * jump when the content arrives.
 */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-[var(--shell-max)] animate-pulse px-4 pt-24 pb-24 sm:px-8">
      <div className="h-3 w-28 rounded bg-[var(--bg-surface)]" />
      <div className="mt-6 h-14 w-72 rounded bg-[var(--bg-surface)]" />
      <div className="mt-4 h-3 w-48 rounded bg-[var(--bg-surface)]" />

      <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-44 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
          />
        ))}
      </div>

      <div className="mt-16 grid gap-3 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-72 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
          />
        ))}
      </div>
      <span className="sr-only">Loading country data…</span>
    </main>
  );
}
