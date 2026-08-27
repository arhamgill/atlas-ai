"use client";

import { useEffect } from "react";

/**
 * Route-level boundary. The globe touches WebGL and the pages touch a network
 * database, so "it threw" is a real state and deserves better than a blank page.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[100svh] w-full max-w-[var(--shell-max)] flex-col justify-center px-4 py-24 sm:px-8">
      <p className="numeric text-2xs tracking-[0.24em] text-[var(--text-tertiary)] uppercase">
        Error
      </p>
      <h1 className="mt-4 max-w-xl text-[length:var(--text-2xl)] leading-tight font-medium tracking-tight text-balance">
        Something broke on the way to this page.
      </h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
        The data behind this view lives in a hosted database, so this is most often a
        cold start or a dropped connection rather than anything permanent.
      </p>
      {error.digest && (
        <p className="numeric text-2xs mt-3 text-[var(--text-tertiary)]">
          Reference: {error.digest}
        </p>
      )}
      <div className="mt-8">
        <button
          onClick={reset}
          className="rounded-[var(--radius)] border border-[var(--border-strong)] px-4 py-2 text-xs transition-colors hover:border-[var(--border-accent)] hover:text-[var(--accent)]"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
