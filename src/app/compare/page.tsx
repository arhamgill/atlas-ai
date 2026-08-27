import type { Metadata } from "next";
import { Suspense } from "react";
import { CompareBoard } from "@/components/panels/CompareBoard";
import {
  getCompareSeries,
  getCountriesWithData,
  getCountryTable,
} from "@/lib/db/queries";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Compare",
  description:
    "Compare up to four countries across AI adoption, private investment, model development and research — each shown as a percentile within its own dimension.",
};

export default async function ComparePage() {
  /*
   * Every country's history ships with the page — 11 KB gzipped, against a
   * server round-trip on every chip toggle if the selection were read here
   * instead. That keeps the route static and selection changes instant, with
   * no API route and no loading state.
   */
  const withData = await getCountriesWithData();
  const [data, series] = await Promise.all([
    getCountryTable(),
    getCompareSeries(withData),
  ]);

  return (
    <main className="mx-auto w-full max-w-[var(--shell-max)] px-4 pt-24 pb-24 sm:px-8">
      <h1 className="text-[length:var(--text-2xl)] leading-tight font-medium tracking-tight">
        Compare
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)]">
        Up to four countries, side by side across every dimension. The selection lives
        in the URL, so a comparison is a link you can send.
      </p>
      <p className="mt-2 max-w-xl text-xs leading-relaxed text-[var(--text-tertiary)]">
        Each trajectory is scaled to its own country and shows direction, not size — the
        figure above it carries the magnitude. Periods line up across a row, so a
        country missing a year leaves a gap rather than stretching to fill the width.
      </p>

      <div className="mt-8">
        {/* Reading the selection from the URL means useSearchParams, which Next
            requires inside a Suspense boundary for the page to prerender. */}
        <Suspense
          fallback={
            <p className="text-sm text-[var(--text-tertiary)]">Loading comparison…</p>
          }
        >
          <CompareBoard data={data} series={series} />
        </Suspense>
      </div>
    </main>
  );
}
