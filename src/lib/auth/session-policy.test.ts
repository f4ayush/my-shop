import { describe, expect, it } from "vitest";
import {
  CUSTOMER_SESSION_TTL_MS,
  PENDING_MFA_TTL_MS,
  STAFF_SESSION_TTL_MS,
  isStaffRole,
  sessionState,
  sessionTtlMs,
} from "./session-policy";

const now = new Date("2026-10-22T10:00:00Z");
const later = new Date(now.getTime() + 60_000);
const earlier = new Date(now.getTime() - 1);

describe("sessionState", () => {
  it("customers are active with the SMS code alone", () => {
    expect(sessionState({ role: "CUSTOMER", expiresAt: later, mfaVerifiedAt: null }, "CUSTOMER", now)).toBe("active");
  });

  it("staff are pending until the second factor, then active", () => {
    expect(sessionState({ role: "PHARMACIST", expiresAt: later, mfaVerifiedAt: null }, "PHARMACIST", now)).toBe("pending_mfa");
    expect(sessionState({ role: "ADMIN", expiresAt: later, mfaVerifiedAt: null }, "ADMIN", now)).toBe("pending_mfa");
    expect(sessionState({ role: "ADMIN", expiresAt: later, mfaVerifiedAt: now }, "ADMIN", now)).toBe("active");
  });

  it("expired sessions are revoked", () => {
    expect(sessionState({ role: "CUSTOMER", expiresAt: earlier, mfaVerifiedAt: null }, "CUSTOMER", now)).toBe("revoked");
    expect(sessionState({ role: "ADMIN", expiresAt: now, mfaVerifiedAt: now }, "ADMIN", now)).toBe("revoked");
  });

  it("any role change revokes the session — promotion, demotion or sideways", () => {
    // A customer session must not become a staff session (it never had a second factor).
    expect(sessionState({ role: "CUSTOMER", expiresAt: later, mfaVerifiedAt: null }, "PHARMACIST", now)).toBe("revoked");
    // Removed staff lose access straight away.
    expect(sessionState({ role: "PHARMACIST", expiresAt: later, mfaVerifiedAt: now }, "CUSTOMER", now)).toBe("revoked");
    expect(sessionState({ role: "PHARMACIST", expiresAt: later, mfaVerifiedAt: now }, "ADMIN", now)).toBe("revoked");
  });
});

describe("sessionTtlMs", () => {
  it("gives staff a short pending window and a shift-length session", () => {
    expect(sessionTtlMs("CUSTOMER", false)).toBe(CUSTOMER_SESSION_TTL_MS);
    expect(sessionTtlMs("PHARMACIST", false)).toBe(PENDING_MFA_TTL_MS);
    expect(sessionTtlMs("ADMIN", true)).toBe(STAFF_SESSION_TTL_MS);
    expect(STAFF_SESSION_TTL_MS).toBeLessThanOrEqual(12 * 60 * 60_000);
    expect(PENDING_MFA_TTL_MS).toBeLessThanOrEqual(15 * 60_000);
  });

  it("isStaffRole", () => {
    expect(isStaffRole("PHARMACIST")).toBe(true);
    expect(isStaffRole("ADMIN")).toBe(true);
    expect(isStaffRole("CUSTOMER")).toBe(false);
    expect(isStaffRole("")).toBe(false);
  });
});
