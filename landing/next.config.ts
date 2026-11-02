import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static: `next build` writes plain HTML, CSS, JS and images to out/,
  // which Cloudflare Workers static assets serves (see wrangler.jsonc and DEPLOY.md).
  output: "export",
  poweredByHeader: false,
  reactStrictMode: true,
  // landing/ is a self-contained app; the repo root's package-lock.json belongs
  // to release-kit. Pin the root so Next doesn't guess the monorepo root.
  outputFileTracingRoot: __dirname,
  turbopack: { root: __dirname },
};

export default nextConfig;
