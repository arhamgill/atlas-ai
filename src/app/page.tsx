import { Suspense } from "react";
import { GlobeExperience } from "@/components/globe/GlobeExperience";
import { getGlobeCountries, getGlobeLayers } from "@/lib/db/queries";

/**
 * The globe is the primary navigation surface.
 *
 * Layer payloads are fetched here in an RSC and handed to the client as props,
 * so the first paint has data already — no client-side waterfall. The page is
 * static with ISR, keeping the database off the critical render path.
 */
export const revalidate = 3600;

function GlobeFallback() {
  return (
    <div className="grid h-[100svh] w-full place-items-center bg-[var(--bg-base)]">
      <p className="numeric text-2xs animate-pulse tracking-[0.24em] text-[var(--text-tertiary)] uppercase">
        Rendering globe
      </p>
    </div>
  );
}

export default async function Home() {
  const [layers, countries] = await Promise.all([
    getGlobeLayers(),
    getGlobeCountries(),
  ]);

  // Only ship metadata for countries that actually appear in a layer.
  const present = new Set(layers.flatMap((l) => l.rows.map((r) => r[0])));
  const trimmed = countries
    .filter((c) => present.has(c.iso3))
    .map((c) => ({ iso3: c.iso3, name: c.name, region: c.region }));

  return (
    // The globe reads its layer and country from the URL, which means
    // useSearchParams under the hood. Without this boundary the whole page
    // opts out of static prerendering and the build fails outright.
    <Suspense fallback={<GlobeFallback />}>
      <GlobeExperience layers={layers} countries={trimmed} />
    </Suspense>
  );
}
