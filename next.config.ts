import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Node HTTP clients out of the bundler; undici breaks if evaluated in the browser.
  serverExternalPackages: ["undici"],
};

export default nextConfig;
