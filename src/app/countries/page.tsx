import type { Metadata } from "next";
import { CountryTable } from "@/components/panels/CountryTable";
import { getCountryTable } from "@/lib/db/queries";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Countries",
  description:
    "Every country ranked across AI adoption, private investment, model development and research. Sortable, searchable and fully keyboard-navigable.",
};

export default async function CountriesPage() {
  const data = await getCountryTable();

  return (
    <main className="mx-auto w-full max-w-[var(--shell-max)] px-4 pt-24 pb-24 sm:px-8">
      <h1 className="text-[length:var(--text-2xl)] leading-tight font-medium tracking-tight">
        Countries
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)]">
        The same data the globe shows, as a table. Sort by any dimension, filter by
        region, and open any country for its full history. Press{" "}
        <kbd className="numeric rounded border border-[var(--border-subtle)] px-1 py-0.5 text-[10px]">
          /
        </kbd>{" "}
        to search and use the arrow keys to move between rows.
      </p>

      <div className="mt-8">
        <CountryTable data={data} />
      </div>
    </main>
  );
}
