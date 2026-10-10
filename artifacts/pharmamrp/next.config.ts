import type { NextConfig } from "next";

const configuredBasePath = process.env.BASE_PATH;

const nextConfig: NextConfig = {
  basePath: configuredBasePath && configuredBasePath !== "/" ? configuredBasePath : "",
  allowedDevOrigins: ["**.replit.dev"],
};

export default nextConfig;
