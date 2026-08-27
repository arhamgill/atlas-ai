import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[100svh] w-full max-w-[var(--shell-max)] flex-col justify-center px-4 py-24 sm:px-8">
      <p className="numeric text-2xs tracking-[0.24em] text-[var(--text-tertiary)] uppercase">
        404
      </p>
      <h1 className="mt-4 max-w-xl text-[length:var(--text-2xl)] leading-tight font-medium tracking-tight text-balance">
        There is no page here.
      </h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
        If you were looking for a country, it may be one of the territories with no AI
        data in any source — those have no page. Try the full list, or press{" "}
        <kbd className="numeric rounded border border-[var(--border-subtle)] px-1 py-0.5 text-[10px]">
          ⌘K
        </kbd>{" "}
        to search.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
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
          All countries
        </Link>
      </div>
    </main>
  );
}
