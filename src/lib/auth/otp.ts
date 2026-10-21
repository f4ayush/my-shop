import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { otpMessage } from "@/lib/sms/templates";
import { sendSms } from "./sms";

const OTP_TTL_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 30_000;
const SEND_WINDOW_MS = 15 * 60_000;
const MAX_SENDS_PER_WINDOW = 3;

function otpSecret(): string {
  const secret = process.env.OTP_SECRET;
  if (!secret || secret.length < 32) throw new Error("OTP_SECRET is missing or too short");
  return secret;
}

function hashOtp(phone: string, code: string): string {
  return createHmac("sha256", otpSecret()).update(`${phone}:${code}`).digest("hex");
}

export type SendOtpResult = { ok: true } | { ok: false; error: string };

export async function sendOtp(phone: string): Promise<SendOtpResult> {
  const now = Date.now();
  const recent = await db.otpChallenge.findMany({
    where: { phone, createdAt: { gt: new Date(now - SEND_WINDOW_MS) } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (recent[0] && now - recent[0].createdAt.getTime() < RESEND_COOLDOWN_MS) {
    return { ok: false, error: "Please wait 30 seconds before requesting another code." };
  }
  if (recent.length >= MAX_SENDS_PER_WINDOW) {
    return { ok: false, error: "Too many codes requested. Please try again in 15 minutes." };
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  await db.otpChallenge.create({
    data: { phone, codeHash: hashOtp(phone, code), expiresAt: new Date(now + OTP_TTL_MS) },
  });
  await sendSms(phone, otpMessage(code));
  return { ok: true };
}

/** Checks a code against the phone's latest live challenge. Each guess counts towards the limit. */
export async function verifyOtp(phone: string, code: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;

  const challenge = await db.otpChallenge.findFirst({
    where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) return false;

  // Count the attempt atomically before comparing, so parallel guesses can't exceed the limit.
  const counted = await db.otpChallenge.updateMany({
    where: { id: challenge.id, consumedAt: null, attempts: { lt: MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  if (counted.count !== 1) return false;

  const expected = Buffer.from(challenge.codeHash, "hex");
  const actual = Buffer.from(hashOtp(phone, code), "hex");
  if (!timingSafeEqual(expected, actual)) return false;

  // Single use: only one request can consume it.
  const consumed = await db.otpChallenge.updateMany({
    where: { id: challenge.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  return consumed.count === 1;
}
