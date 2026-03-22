import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Netlify handles image optimization via its CDN
  images: {
    unoptimized: true,
  },

  // Compress responses (Netlify CDN also gzips, but keeps it safe)
  compress: true,

  // Reduce bundle size by stripping source maps in production
  productionBrowserSourceMaps: false,

  // Required for @netlify/plugin-nextjs — do not use "standalone"
  // output: "standalone" is NOT compatible with Netlify's plugin
};

export default nextConfig;
