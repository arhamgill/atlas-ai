/**
 * Canonical origin for absolute URLs (sitemap, robots, OG tags).
 *
 * Vercel sets VERCEL_PROJECT_PRODUCTION_URL on production deploys; the explicit
 * override wins so a custom domain can be pointed at without a code change.
 */
export const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export function siteUrl(path = "/"): string {
  return `${SITE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}
