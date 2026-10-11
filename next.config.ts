import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Demo prototype: never let a type nit block a Vercel deploy.
  typescript: { ignoreBuildErrors: true },
  reactStrictMode: true,
};

export default nextConfig;
