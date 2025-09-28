import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",        // enables static export
  assetPrefix: "./",       // ensures assets are loaded with relative paths
  trailingSlash: true,     // helps when hosting on itch.io or other static hosts
};

export default nextConfig;