// Session rules, kept free of Next.js and database imports so they can be unit tested.

export const CUSTOMER_SESSION_TTL_MS = 30 * 24 * 60 * 60_000;
/** Staff sessions last one working shift; after that they sign in again with both factors. */
export const STAFF_SESSION_TTL_MS = 8 * 60 * 60_000;
/** Time allowed between the SMS code and the second factor. */
export const PENDING_MFA_TTL_MS = 10 * 60_000;
export const MAX_MFA_ATTEMPTS = 5;

export type Role = "CUSTOMER" | "PHARMACIST" | "ADMIN";

export function isStaffRole(role: string): boolean {
  return role === "PHARMACIST" || role === "ADMIN";
}

export type SessionRow = { role: string; expiresAt: Date; mfaVerifiedAt: Date | null };

/**
 * What a stored session is worth for a user whose current role is `userRole`:
 * - "active": signed in;
 * - "pending_mfa": staff who passed the SMS code but not the second factor — grants nothing
 *   except finishing sign-in;
 * - "revoked": expired, or the role changed since sign-in — delete it.
 */
export function sessionState(session: SessionRow, userRole: string, now: Date): "active" | "pending_mfa" | "revoked" {
  if (session.expiresAt <= now) return "revoked";
  if (session.role !== userRole) return "revoked";
  if (isStaffRole(userRole) && !session.mfaVerifiedAt) return "pending_mfa";
  return "active";
}

/** Lifetime of a new session: staff are pending (short) until the second factor upgrades them. */
export function sessionTtlMs(role: string, mfaVerified: boolean): number {
  if (!isStaffRole(role)) return CUSTOMER_SESSION_TTL_MS;
  return mfaVerified ? STAFF_SESSION_TTL_MS : PENDING_MFA_TTL_MS;
}
