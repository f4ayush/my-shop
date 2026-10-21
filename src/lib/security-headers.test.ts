import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, hstsHeaders, prescriptionFileHeaders, securityHeaders } from "./security-headers";

function directives(csp: string): Map<string, string[]> {
  return new Map(csp.split(";").map((d) => {
    const [name, ...values] = d.trim().split(/\s+/);
    return [name, values] as [string, string[]];
  }));
}

describe("contentSecurityPolicy", () => {
  const prod = directives(contentSecurityPolicy({ dev: false }));
  const dev = directives(contentSecurityPolicy({ dev: true }));

  it("allows Razorpay checkout and nothing else third-party for scripts", () => {
    expect(prod.get("script-src")).toEqual(["'self'", "'unsafe-inline'", "https://checkout.razorpay.com"]);
    expect(prod.get("frame-src")).toContain("https://api.razorpay.com");
    expect(prod.get("connect-src")).toContain("https://api.razorpay.com");
  });

  it("forbids framing, plugins and base/form hijacking", () => {
    expect(prod.get("frame-ancestors")).toEqual(["'none'"]);
    expect(prod.get("object-src")).toEqual(["'none'"]);
    expect(prod.get("base-uri")).toEqual(["'self'"]);
    expect(prod.get("form-action")).toEqual(["'self'"]);
    expect(prod.get("default-src")).toEqual(["'self'"]);
  });

  it("keeps eval and websockets to development", () => {
    expect(prod.get("script-src")).not.toContain("'unsafe-eval'");
    expect(prod.get("connect-src")).not.toContain("ws:");
    expect(prod.has("upgrade-insecure-requests")).toBe(true);
    expect(dev.get("script-src")).toContain("'unsafe-eval'");
    expect(dev.has("upgrade-insecure-requests")).toBe(false);
  });
});

describe("securityHeaders", () => {
  const byKey = (dev: boolean) => new Map(securityHeaders({ dev }).map((h) => [h.key, h.value]));

  it("sends HSTS in production only", () => {
    expect(hstsHeaders({ dev: false })).toEqual([{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]);
    expect(hstsHeaders({ dev: true })).toEqual([]);
  });

  it("sets the usual hardening headers", () => {
    const h = byKey(false);
    expect(h.get("X-Frame-Options")).toBe("DENY");
    expect(h.get("X-Content-Type-Options")).toBe("nosniff");
    expect(h.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(h.get("Permissions-Policy")).toContain("camera=()");
  });

  it("lets only our own pages frame prescription files, and locks down images", () => {
    const img = prescriptionFileHeaders("image/jpeg");
    expect(img["Content-Security-Policy"]).toBe("default-src 'none'; img-src 'self'; frame-ancestors 'self'");
    expect(img["X-Frame-Options"]).toBe("SAMEORIGIN");
    expect(img["Cache-Control"]).toBe("private, no-store");
    expect(img["Referrer-Policy"]).toBe("no-referrer");
    expect(prescriptionFileHeaders("application/pdf")["Content-Security-Policy"]).toBe("frame-ancestors 'self'");
  });
});
