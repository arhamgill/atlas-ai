# Deployment

The app is a standard Next.js 16 project and deploys to Vercel without a
`vercel.json`. The only thing it needs from you is a database URL.

---

## Before you start

The database must already be migrated and seeded. If you have been running it
locally it already is — the same Neon database serves production, so there is
nothing to move.

```bash
pnpm db:migrate      # schema
pnpm ingest          # data
pnpm ingest:report   # all five integrity checks should pass
```

---

## Steps

1. **Import the repo** at [vercel.com/new](https://vercel.com/new). Framework
   preset, build command and output directory are all detected — change nothing.

2. **Add the environment variable** before the first build:

   | Name           | Value                                  | Environments                     |
   | -------------- | -------------------------------------- | -------------------------------- |
   | `DATABASE_URL` | your Neon **pooled** connection string | Production, Preview, Development |

   The host must contain `-pooler`. The direct endpoint opens a real connection
   per invocation and will exhaust Neon's limit under serverless.

   **This is needed at build time, not just at runtime.** 194 country pages are
   prerendered, so a missing variable fails the build rather than degrading at
   request time. The error says exactly this if you forget.

3. **Deploy.** A cold build runs about a minute: ~200 static pages plus the
   ingest-free page data.

4. **Optional — a custom domain.** Add it in Vercel, then set:

   | Name                   | Value                     |
   | ---------------------- | ------------------------- |
   | `NEXT_PUBLIC_SITE_URL` | `https://your-domain.com` |

   Without it the sitemap, robots and Open Graph tags fall back to Vercel's
   generated production URL, which works but is not the URL you want indexed.

---

## After deploying

```bash
curl -sI https://<your-domain>/                    # 200
curl -sI https://<your-domain>/countries/zzz       # 404, not 200
curl -s  https://<your-domain>/sitemap.xml | head  # 198 URLs
curl -s  https://<your-domain>/robots.txt
```

Then in a browser:

- The globe flies in and countries respond to hover and click
- `⌘K` opens search
- A country page loads with four charts
- `/countries` sorts and filters

---

## Things worth knowing

**Country pages are static with hourly ISR.** The database is not on the
critical render path, so a Neon cold start never delays a page view. Only the
per-country Open Graph images are rendered on demand, and those are requested
almost exclusively by crawlers.

**Refreshing the data does not require a redeploy in principle**, but in
practice it does: the pages are prerendered at build. After running `pnpm ingest`
against the production database, trigger a redeploy so the static pages pick the
new figures up. Upstream sources update every three to six months, so this is
rare.

**Function region.** Neon's free tier here is in `us-east-2`. Vercel's default
function region is `iad1` (Virginia), which is close enough that the difference
is not worth pinning a region for — and pinning an unavailable region breaks the
deploy. Leave it alone unless you move the database.

**No Content-Security-Policy.** The globe compiles GLSL and Next injects inline
bootstrap scripts, so a strict policy needs per-request nonces and a loose one
permitting `unsafe-inline` would be theatre. The other security headers
(`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`,
`Permissions-Policy`) are set in `next.config.ts` and verified in production.

**The build needs network access** to nothing — all source CSVs are committed to
`data/snapshots/`. Only the database is required.
