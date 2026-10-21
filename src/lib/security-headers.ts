// Security headers for every response, applied in next.config.ts. Pure, so it can be unit tested.
// Imported by next.config.ts, so no "@/..." imports here.

type Header = { key: string; value: string };

const RAZORPAY = {
  script: ["https://checkout.razorpay.com"],
  frame: ["https://api.razorpay.com", "https://checkout.razorpay.com"],
  connect: ["https://api.razorpay.com", "https://lumberjack.razorpay.com"],
  img: ["https://*.razorpay.com"],
};

export function contentSecurityPolicy({ dev }: { dev: boolean }): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // Next.js inlines its bootstrap scripts, so 'unsafe-inline' is needed without per-request nonces.
    // Dev also needs eval for React's debugging tools.
    "script-src": ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : []), ...RAZORPAY.script],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...RAZORPAY.img],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", ...RAZORPAY.connect, ...(dev ? ["ws:"] : [])],
    // 'self' for the prescription PDF viewer in the Rx queue.
    "frame-src": ["'self'", ...RAZORPAY.frame],
    "frame-ancestors": ["'none'"],
    "form-action": ["'self'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
  };
  const policy = Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`);
  if (!dev) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

/** Two years, all subdomains. Production only: browsers would otherwise pin http://localhost to HTTPS. */
export function hstsHeaders({ dev }: { dev: boolean }): Header[] {
  return dev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }];
}

/** Headers for pages and most routes (next.config.ts). Note: these override headers a route sets itself. */
export function securityHeaders({ dev }: { dev: boolean }): Header[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy({ dev }) },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // Razorpay's checkout asks for payment; nothing here needs camera, mic or location.
    { key: "Permissions-Policy", value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.razorpay.com" "https://api.razorpay.com")' },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  ];
}

/**
 * Headers for a served prescription file. next.config.ts leaves /api/prescriptions/* to the route,
 * because config headers would override these. Files may be framed only by our own pages (the Rx
 * queue shows PDFs in an iframe). Images get a locked-down CSP; PDFs get none beyond framing,
 * since a stricter one can break the browser's built-in PDF viewer.
 */
export function prescriptionFileHeaders(mimeType: string): Record<string, string> {
  return {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "SAMEORIGIN",
    "Content-Security-Policy": mimeType.startsWith("image/")
      ? "default-src 'none'; img-src 'self'; frame-ancestors 'self'"
      : "frame-ancestors 'self'",
  };
}
