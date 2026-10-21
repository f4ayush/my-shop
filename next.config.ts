import type { NextConfig } from "next";
import { hstsHeaders, securityHeaders } from "./src/lib/security-headers";

const dev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Prescription photos/PDFs are uploaded through Server Actions (app limit: 5 MB per file).
    serverActions: { bodySizeLimit: "6mb" },
  },
  async headers() {
    const hsts = hstsHeaders({ dev });
    return [
      ...(hsts.length ? [{ source: "/:path*", headers: hsts }] : []),
      // Config headers override a route's own, so the prescription file route (which sets its own,
      // see prescriptionFileHeaders) is left out here.
      { source: "/:path((?!api/prescriptions/).*)", headers: securityHeaders({ dev }) },
    ];
  },
};

export default nextConfig;
