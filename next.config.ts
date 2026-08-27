import bundleAnalyzer from "@next/bundle-analyzer";
import type { NextConfig } from "next";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/**
 * Applied to every route.
 *
 * No Content-Security-Policy yet: the globe compiles GLSL and Next injects
 * inline bootstrap scripts, so a strict policy needs per-request nonces, and a
 * loose one that permits 'unsafe-inline' would be security theatre. The headers
 * below are the ones that are unambiguously correct without that work.
 */
const SECURITY_HEADERS = [
  // Stop browsers second-guessing declared content types.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send the origin cross-site, the full path same-site.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing here should ever be framed.
  { key: "X-Frame-Options", value: "DENY" },
  // The app asks for none of these; deny them up front.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // No value in advertising the framework version.
  poweredByHeader: false,

  // three.js and friends ship large namespaces; let Next pull in only what is
  // used rather than the whole barrel on every route that touches them.
  experimental: {
    optimizePackageImports: ["three", "motion"],
  },

  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default withBundleAnalyzer(nextConfig);
