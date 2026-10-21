"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { sendOtp, verifyOtp } from "@/lib/auth/otp";
import { createSession, destroySession } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/session-policy";
import { mergeGuestCartInto } from "@/lib/cart";
import { maskPhone, normalizeIndianMobile } from "@/lib/phone";
import { hitRateLimit, LIMITS } from "@/lib/rate-limit";
import { safeNextPath } from "@/lib/safe-redirect";

export type LoginState = {
  step: "phone" | "code";
  phone?: string;
  error?: string;
  info?: string;
};

const TOO_MANY_REQUESTS = "Too many attempts from your network. Please try again in a few minutes.";

export async function loginAction(prev: LoginState, formData: FormData): Promise<LoginState> {
  const intent = formData.get("intent");

  if (intent === "change") return { step: "phone" };

  if (intent === "send" || intent === "resend") {
    const phone = normalizeIndianMobile(String(formData.get("phone") ?? prev.phone ?? ""));
    if (!phone) return { step: "phone", error: "Enter a valid 10-digit Indian mobile number." };
    if (!(await hitRateLimit(LIMITS.otpSend))) {
      return { step: intent === "resend" ? "code" : "phone", phone, error: TOO_MANY_REQUESTS };
    }
    const result = await sendOtp(phone);
    if (!result.ok) return { step: intent === "resend" ? "code" : "phone", phone, error: result.error };
    return { step: "code", phone, info: `We sent a 6-digit code to ${maskPhone(phone)}.` };
  }

  if (intent === "verify") {
    const phone = normalizeIndianMobile(prev.phone ?? "");
    if (!phone) return { step: "phone", error: "Please enter your mobile number again." };
    const code = String(formData.get("code") ?? "").trim();
    if (!(await hitRateLimit(LIMITS.otpVerify))) return { step: "code", phone, error: TOO_MANY_REQUESTS };
    if (!(await verifyOtp(phone, code))) {
      return { step: "code", phone, error: "That code is incorrect or has expired." };
    }

    const user = await db.user.upsert({ where: { phone }, update: {}, create: { phone } });
    const next = safeNextPath(formData.get("next"));
    await createSession(user);
    // Staff aren't signed in yet: the session stays pending until the second factor.
    if (isStaffRole(user.role)) redirect(`/login/mfa?next=${encodeURIComponent(next)}`);
    await mergeGuestCartInto(user.id);
    redirect(next);
  }

  return { step: "phone", error: "Something went wrong. Please try again." };
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}
