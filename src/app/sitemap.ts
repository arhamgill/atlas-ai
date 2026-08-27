import type { MetadataRoute } from "next";
import { getCountriesWithData } from "@/lib/db/queries";
import { siteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const iso3 = await getCountriesWithData();
  const now = new Date();

  return [
    { url: siteUrl("/"), lastModified: now, priority: 1 },
    { url: siteUrl("/countries"), lastModified: now, priority: 0.9 },
    { url: siteUrl("/compare"), lastModified: now, priority: 0.7 },
    { url: siteUrl("/about"), lastModified: now, priority: 0.6 },
    ...iso3.map((code) => ({
      url: siteUrl(`/countries/${code.toLowerCase()}`),
      lastModified: now,
      priority: 0.8,
    })),
  ];
}
