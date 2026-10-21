import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { isStaffRole, sessionState, sessionTtlMs } from "./session-policy";
import { hashToken, newToken, secureCookie } from "./tokens";

const SESSION_COOKIE = "sid";

export type CurrentUser = { id: string; phone: string; name: string | null; role: string };

/**
 * Starts a session for the user's current role. Staff sessions start pending (SMS code only)
 * unless `mfaVerified`; a pending session signs nobody in until completeMfa() replaces it.
 */
export async function createSession(user: { id: string; role: string }, opts: { mfaVerified?: boolean } = {}): Promise<void> {
  const mfaVerified = isStaffRole(user.role) && opts.mfaVerified === true;
  const token = newToken();
  const expiresAt = new Date(Date.now() + sessionTtlMs(user.role, mfaVerified));
  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId: user.id,
      role: user.role as "CUSTOMER" | "PHARMACIST" | "ADMIN",
      mfaVerifiedAt: mfaVerified ? new Date() : null,
      expiresAt,
    },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie,
    path: "/",
    expires: expiresAt,
  });
}

const loadSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      role: true,
      expiresAt: true,
      mfaVerifiedAt: true,
      totpSetupSecretEnc: true,
      user: { select: { id: true, phone: true, name: true, role: true, totpEnabledAt: true } },
    },
  });
  if (!session) return null;
  const state = sessionState(session, session.user.role, new Date());
  if (state === "revoked") {
    // Expired, or the user's role changed since sign-in: end it for good.
    await db.session.deleteMany({ where: { id: session.id } });
    return null;
  }
  return { ...session, state };
});

/** The signed-in user for this request, or null. Staff count only after the second factor. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await loadSession();
  if (!session || session.state !== "active") return null;
  const { id, phone, name, role } = session.user;
  return { id, phone, name, role };
});

export type PendingMfa = {
  sessionId: string;
  user: { id: string; phone: string; role: string; totpEnabled: boolean };
  totpSetupSecretEnc: string | null;
};

/** The staff member half-way through sign-in (SMS code done, second factor not yet), or null. */
export async function getPendingMfa(): Promise<PendingMfa | null> {
  const session = await loadSession();
  if (!session || session.state !== "pending_mfa") return null;
  return {
    sessionId: session.id,
    user: { id: session.user.id, phone: session.user.phone, role: session.user.role, totpEnabled: !!session.user.totpEnabledAt },
    totpSetupSecretEnc: session.totpSetupSecretEnc,
  };
}

/** Replaces the pending session with a fresh, fully signed-in staff session (new token). */
export async function completeMfa(pending: PendingMfa): Promise<void> {
  await db.session.deleteMany({ where: { id: pending.sessionId } });
  await createSession(pending.user, { mfaVerified: true });
}

/** Redirects to login (and back to `returnTo` afterwards) when nobody is signed in. */
export async function requireUser(returnTo: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return user;
}

export function isStaff(user: CurrentUser | null): boolean {
  return !!user && isStaffRole(user.role);
}

/** Staff-only pages answer 404 to everyone else, so they aren't discoverable. */
export async function requireStaff(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || !isStaff(user)) notFound();
  return user;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}
