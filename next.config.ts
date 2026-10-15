import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const config: NextConfig = {
  output: "standalone",
  allowedDevOrigins: [
    "127.0.0.1",
    ...Object.values(networkInterfaces())
      .flat()
      .filter((entry) => entry?.family === "IPv4" && !entry.internal)
      .map((entry) => entry!.address),
  ],
  serverExternalPackages: ["@electric-sql/pglite"],
  outputFileTracingIncludes: {
    "/api/command": ["./supabase/migrations/*.sql"],
  },
  trailingSlash: true,
  images: { unoptimized: true },
  devIndicators: false,
  outputFileTracingRoot: process.cwd(),
};
export default function nextConfig(phase: string): NextConfig {
  return {
    ...config,
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  };
}
