import bundleAnalyzer from "@next/bundle-analyzer";
import type { NextConfig } from "next";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // three.js and three-globe ship untranspiled ESM; let Next optimize them
  // rather than pulling the whole namespace into every route bundle.
  experimental: {
    optimizePackageImports: ["three", "lucide-react", "motion"],
  },
};

export default withBundleAnalyzer(nextConfig);
