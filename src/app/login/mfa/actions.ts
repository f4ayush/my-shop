"use server";

import { redirect } from "next/navigation";
import { enrollTotp, verifySecondFactor } from "@/lib/auth/mfa";
import { completeMfa, getPendingMfa } from "@/lib/auth/session";
import { mergeGuestCartInto } from "@/lib/cart";
import { hitRateLimit, LIMITS } from "@/lib/rate-limit";
import { safeNextPath } from "@/lib/safe-redirect";

export type MfaState = { error?: string; signedOut?: boolean };

export async function mfaAction(_prev: MfaState, formData: FormData): Promise<MfaState> {
  const next = safeNextPath(formData.get("next"));
  const code = String(formData.get("code") ?? "");

  if (!(await hitRateLimit(LIMITS.mfaVerify))) {
    return { error: "Too many attempts from your network. Please try again in a few minutes." };
  }
  const pending = await getPendingMfa();
  if (!pending) return { error: "Your sign-in timed out. Please log in again.", signedOut: true };

  const result = formData.get("intent") === "enroll" ? await enrollTotp(pending, code) : await verifySecondFactor(pending, code);
  if (!result.ok) return { error: result.error, signedOut: result.signedOut };
  await completeMfa(pending);
  await mergeGuestCartInto(pending.user.id);
  redirect(next);
}
