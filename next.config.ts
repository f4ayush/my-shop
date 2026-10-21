import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Prescription photos/PDFs are uploaded through Server Actions (app limit: 5 MB per file).
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
