import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { hashToken, newToken, secureCookie } from "./tokens";

const SESSION_COOKIE = "sid";
const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;

export type CurrentUser = { id: string; phone: string; name: string | null; role: string };

export async function createSession(userId: string): Promise<void> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie,
    path: "/",
    expires: expiresAt,
  });
}

/** The signed-in user for this request, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { expiresAt: true, user: { select: { id: true, phone: true, name: true, role: true } } },
  });
  if (!session || session.expiresAt <= new Date()) return null;
  return session.user;
});

/** Redirects to login (and back to `returnTo` afterwards) when nobody is signed in. */
export async function requireUser(returnTo: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return user;
}

export function isStaff(user: CurrentUser | null): boolean {
  return user?.role === "PHARMACIST" || user?.role === "ADMIN";
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
