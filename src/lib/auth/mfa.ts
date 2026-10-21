import { db } from "@/lib/db";
import { hashRecoveryCode, mfaMasterKey, open, seal } from "./secret-box";
import type { PendingMfa } from "./session";
import { MAX_MFA_ATTEMPTS } from "./session-policy";
import { newRecoveryCodes, newTotpSecret, normalizeRecoveryCode, verifyTotp } from "./totp";

// Second factor for staff: TOTP from an authenticator app, or a one-time recovery code.
// The first enrolment happens right after the SMS code; resetting it needs `npm run staff:reset-mfa`.

export type MfaFailure = { ok: false; error: string; signedOut?: boolean };
export type MfaResult = { ok: true } | MfaFailure;

/** Counts a guess against the pending session. After too many, the session is ended. */
async function countAttempt(sessionId: string): Promise<boolean> {
  const counted = await db.session.updateMany({
    where: { id: sessionId, mfaVerifiedAt: null, mfaAttempts: { lt: MAX_MFA_ATTEMPTS } },
    data: { mfaAttempts: { increment: 1 } },
  });
  if (counted.count === 1) return true;
  await db.session.deleteMany({ where: { id: sessionId } });
  return false;
}

const TOO_MANY: MfaFailure = { ok: false, error: "Too many attempts. Please log in again.", signedOut: true };

export type TotpSetup = { secret: string; recoveryCodes: string[] };

/**
 * The authenticator secret and recovery codes being set up in this pending session, created on
 * first call and kept sealed on the session until enrolment. The codes are shown on the setup page,
 * before the first code is confirmed, because confirming signs the user in and moves them on.
 */
export async function getOrCreateSetup(pending: PendingMfa): Promise<TotpSetup> {
  const key = mfaMasterKey();
  if (pending.totpSetupSecretEnc) return JSON.parse(open(key, pending.totpSetupSecretEnc)) as TotpSetup;
  const setup: TotpSetup = { secret: newTotpSecret(), recoveryCodes: newRecoveryCodes() };
  await db.session.update({ where: { id: pending.sessionId }, data: { totpSetupSecretEnc: seal(key, JSON.stringify(setup)) } });
  return setup;
}

/** Confirms the authenticator app with its first code, then turns on TOTP and the recovery codes from the setup. */
export async function enrollTotp(pending: PendingMfa, code: string): Promise<MfaResult> {
  if (pending.user.totpEnabled || !pending.totpSetupSecretEnc) return { ok: false, error: "Please start again.", signedOut: true };
  if (!(await countAttempt(pending.sessionId))) return TOO_MANY;

  const key = mfaMasterKey();
  const setup = JSON.parse(open(key, pending.totpSetupSecretEnc)) as TotpSetup;
  const step = verifyTotp(setup.secret, code.trim(), Date.now());
  if (step === null) return { ok: false, error: "That code didn't match. Check the app shows My Pharmacy and try the newest code." };

  const enrolled = await db.$transaction(async (tx) => {
    // Only if nobody enrolled in the meantime (e.g. a second tab).
    const set = await tx.user.updateMany({
      where: { id: pending.user.id, totpEnabledAt: null },
      data: { totpSecretEnc: seal(key, setup.secret), totpEnabledAt: new Date(), totpLastStep: step },
    });
    if (set.count !== 1) return false;
    await tx.recoveryCode.deleteMany({ where: { userId: pending.user.id } });
    await tx.recoveryCode.createMany({
      data: setup.recoveryCodes.map((c) => ({ userId: pending.user.id, codeHash: hashRecoveryCode(key, normalizeRecoveryCode(c)!) })),
    });
    await tx.session.update({ where: { id: pending.sessionId }, data: { totpSetupSecretEnc: null } });
    await tx.auditLog.create({ data: { actorId: pending.user.id, action: "mfa.totp_enrolled", entityType: "User", entityId: pending.user.id } });
    return true;
  });
  if (!enrolled) return { ok: false, error: "Please start again.", signedOut: true };
  return { ok: true };
}

/** Checks an authenticator code, or a recovery code (used up on success). */
export async function verifySecondFactor(pending: PendingMfa, input: string): Promise<MfaResult> {
  if (!pending.user.totpEnabled) return { ok: false, error: "Please start again.", signedOut: true };
  if (!(await countAttempt(pending.sessionId))) return TOO_MANY;
  const key = mfaMasterKey();
  const value = input.trim();

  if (/^\d{6}$/.test(value)) {
    const user = await db.user.findUnique({ where: { id: pending.user.id }, select: { totpSecretEnc: true, totpLastStep: true } });
    if (!user?.totpSecretEnc) return { ok: false, error: "Please start again.", signedOut: true };
    const step = verifyTotp(open(key, user.totpSecretEnc), value, Date.now(), user.totpLastStep);
    if (step === null) return { ok: false, error: "That code is incorrect. Use the newest code from your authenticator app." };
    // Record the step atomically so the same code can't be used twice, even in parallel.
    const claimed = await db.user.updateMany({
      where: { id: pending.user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
      data: { totpLastStep: step },
    });
    if (claimed.count !== 1) return { ok: false, error: "That code was already used. Wait for the next one." };
    return { ok: true };
  }

  const normalized = normalizeRecoveryCode(value);
  if (!normalized) return { ok: false, error: "Enter the 6-digit code from your app, or a recovery code." };
  const used = await db.recoveryCode.updateMany({
    where: { userId: pending.user.id, codeHash: hashRecoveryCode(key, normalized), usedAt: null },
    data: { usedAt: new Date() },
  });
  if (used.count !== 1) return { ok: false, error: "That recovery code is incorrect or already used." };
  const left = await db.recoveryCode.count({ where: { userId: pending.user.id, usedAt: null } });
  await db.auditLog.create({
    data: { actorId: pending.user.id, action: "mfa.recovery_code_used", entityType: "User", entityId: pending.user.id, metadata: { remaining: left } },
  });
  return { ok: true };
}
