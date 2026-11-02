import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // web/ is a self-contained app; the repo root's package-lock.json belongs to
  // release-kit. Pin the root so Next doesn't guess the monorepo root.
  outputFileTracingRoot: __dirname,
  turbopack: { root: __dirname },
};

export default nextConfig;
