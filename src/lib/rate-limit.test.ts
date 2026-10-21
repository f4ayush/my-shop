import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {} }));

const { clientIpFrom, isAllowed, LIMITS, trustedProxyCount } = await import("./rate-limit");

describe("clientIpFrom", () => {
  it("takes the hop our single trusted proxy appended, not the client-supplied ones", () => {
    expect(clientIpFrom("203.0.113.9", null, 1)).toBe("203.0.113.9");
    // A client can prepend anything; only the last entry came from our proxy.
    expect(clientIpFrom("1.2.3.4, 203.0.113.9", null, 1)).toBe("203.0.113.9");
  });

  it("counts back through several trusted proxies", () => {
    expect(clientIpFrom("1.2.3.4, 203.0.113.9, 10.0.0.2", null, 2)).toBe("203.0.113.9");
  });

  it("falls back to X-Real-IP when the header is missing or too short", () => {
    expect(clientIpFrom(null, "198.51.100.7", 1)).toBe("198.51.100.7");
    expect(clientIpFrom("10.0.0.2", "198.51.100.7", 2)).toBe("198.51.100.7");
    expect(clientIpFrom(" , ", null, 1)).toBeNull();
  });

  it("ignores X-Forwarded-For entirely with no trusted proxies", () => {
    expect(clientIpFrom("1.2.3.4", "198.51.100.7", 0)).toBe("198.51.100.7");
    expect(clientIpFrom("1.2.3.4", null, 0)).toBeNull();
  });
});

describe("trustedProxyCount", () => {
  it("defaults to 1 and rejects nonsense", () => {
    expect(trustedProxyCount(undefined)).toBe(1);
    expect(trustedProxyCount("0")).toBe(0);
    expect(trustedProxyCount("2")).toBe(2);
    expect(trustedProxyCount("-1")).toBe(1);
    expect(trustedProxyCount("abc")).toBe(1);
    expect(trustedProxyCount("1.5")).toBe(1);
  });
});

describe("isAllowed", () => {
  it("allows up to and including the max", () => {
    expect(isAllowed(1, LIMITS.otpSend)).toBe(true);
    expect(isAllowed(LIMITS.otpSend.max, LIMITS.otpSend)).toBe(true);
    expect(isAllowed(LIMITS.otpSend.max + 1, LIMITS.otpSend)).toBe(false);
  });
});
