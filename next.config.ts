import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@elastic/elasticsearch"],
};

export default nextConfig;
