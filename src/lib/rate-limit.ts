import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { db } from "@/lib/db";

// Per-IP fixed-window limits, counted in Postgres so they hold across server instances.
// Only a keyed hash of the IP is stored (data minimisation), and rows expire with their window.

export type Limit = { name: string; max: number; windowMs: number };

export const LIMITS = {
  otpSend: { name: "otp-send", max: 10, windowMs: 15 * 60_000 },
  otpVerify: { name: "otp-verify", max: 30, windowMs: 15 * 60_000 },
  mfaVerify: { name: "mfa-verify", max: 20, windowMs: 15 * 60_000 },
} satisfies Record<string, Limit>;

/**
 * The client IP from X-Forwarded-For, trusting only the last `trustedProxies` hops (the ones our
 * own load balancer/CDN appended). Anything to the left of that was sent by the client and can be
 * forged. Returns null if the header is missing or too short.
 */
export function clientIpFrom(forwardedFor: string | null, realIp: string | null, trustedProxies: number): string | null {
  if (trustedProxies <= 0) return realIp?.trim() || null;
  const hops = (forwardedFor ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  if (hops.length < trustedProxies) return realIp?.trim() || null;
  return hops[hops.length - trustedProxies] || null;
}

export function trustedProxyCount(raw: string | undefined): number {
  const n = Number(raw ?? "1");
  return Number.isInteger(n) && n >= 0 && n <= 5 ? n : 1;
}

/** Whether a request may go ahead given the bucket's count after this request was added. */
export function isAllowed(countAfterIncrement: number, limit: Limit): boolean {
  return countAfterIncrement <= limit.max;
}

function bucketKey(limit: Limit, ip: string): string {
  const secret = process.env.OTP_SECRET;
  if (!secret || secret.length < 32) throw new Error("OTP_SECRET is missing or too short");
  return `${limit.name}:${createHmac("sha256", secret).update(ip).digest("base64url").slice(0, 32)}`;
}

/** Counts this request against the caller's IP. Returns false once the limit is exceeded. */
export async function hitRateLimit(limit: Limit): Promise<boolean> {
  const h = await headers();
  const ip = clientIpFrom(h.get("x-forwarded-for"), h.get("x-real-ip"), trustedProxyCount(process.env.TRUSTED_PROXY_COUNT)) ?? "unknown";
  const key = bucketKey(limit, ip);
  const now = new Date();
  const windowStartAfter = new Date(now.getTime() - limit.windowMs);

  // One atomic statement: start a new window if the old one ended, otherwise add one.
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "windowStart", "count") VALUES (${key}, ${now}, 1)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowStart" <= ${windowStartAfter} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."windowStart" <= ${windowStartAfter} THEN ${now} ELSE "RateLimit"."windowStart" END
    RETURNING "count"`;

  // Occasionally clear out old windows so the table stays small.
  if (Math.random() < 0.01) {
    await db.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - 24 * 60 * 60_000) } } }).catch(() => undefined);
  }
  return isAllowed(Number(rows[0]?.count ?? 1), limit);
}
