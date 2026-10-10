import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const configuredBasePath = process.env.BASE_PATH;

const nextConfig = (phase: string): NextConfig => ({
  basePath: configuredBasePath && configuredBasePath !== "/" ? configuredBasePath : "",
  allowedDevOrigins: ["**.replit.dev", "localhost", "127.0.0.1"],
  // Builds must not replace the output used by the running preview.
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  experimental: {
    // Persisted task metadata can reference missing files after workspace restores.
    turbopackFileSystemCacheForDev: false,
  },
});

export default nextConfig;
