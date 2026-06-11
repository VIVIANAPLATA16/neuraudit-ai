import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@elastic/elasticsearch"],
  // API routes: export const maxDuration = 60 (agent/search, summary, compare)
  experimental: {
    // Align serverless budget with Cloud Run request timeout
    proxyTimeout: 60_000,
  },
};

export default nextConfig;
