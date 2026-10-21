import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

// TOTP (RFC 6238: HMAC-SHA1, 6 digits, 30-second steps) — what Google Authenticator, Microsoft
// Authenticator, Authy etc. expect by default. Pure functions, no database access.

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_STEP_SECONDS = 30;
const DIGITS = 6;
/** Accept the previous and next step too, to allow for phone clock drift. */
const DRIFT_STEPS = 1;

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error("Invalid base32 character");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new 160-bit secret, base32-encoded (the form authenticator apps take). */
export function newTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function hotp(secret: Buffer, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", secret).update(msg).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const bin = mac.readUInt32BE(offset) & 0x7fffffff;
  return (bin % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

export function totpStep(nowMs: number): number {
  return Math.floor(nowMs / 1000 / TOTP_STEP_SECONDS);
}

export function totp(secretBase32: string, nowMs: number): string {
  return hotp(base32Decode(secretBase32), totpStep(nowMs));
}

/**
 * Checks a 6-digit code. Returns the matching time step (store it and pass it back as
 * `lastUsedStep` so a code can't be replayed), or null if it doesn't match.
 */
export function verifyTotp(secretBase32: string, code: string, nowMs: number, lastUsedStep: number | null = null): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const secret = base32Decode(secretBase32);
  const current = totpStep(nowMs);
  for (let step = current - DRIFT_STEPS; step <= current + DRIFT_STEPS; step++) {
    if (lastUsedStep !== null && step <= lastUsedStep) continue;
    if (timingSafeEqual(Buffer.from(hotp(secret, step)), Buffer.from(code))) return step;
  }
  return null;
}

/** otpauth:// URI that authenticator apps import (as a QR code or a link). */
export function otpauthUri(secretBase32: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret: secretBase32, issuer, algorithm: "SHA1", digits: String(DIGITS), period: String(TOTP_STEP_SECONDS) });
  return `otpauth://totp/${label}?${params}`;
}

/** "JBSWY3DPEHPK3PXP…" → "JBSW Y3DP EHPK 3PXP …" for typing into an app by hand. */
export function groupSecret(secretBase32: string): string {
  return secretBase32.replace(/(.{4})/g, "$1 ").trim();
}

// ─── Recovery codes ──────────────────────────────────────

const RECOVERY_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0/O, 1/I
export const RECOVERY_CODE_COUNT = 10;

/** One-time recovery codes like "7KQ4-M2XD-9PTA" (60 bits each). */
export function newRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => {
    let raw = "";
    for (let i = 0; i < 12; i++) raw += RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)];
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
  });
}

/** Canonical form for hashing and comparing: upper case, no spaces or dashes. Null if it can't be one. */
export function normalizeRecoveryCode(input: string): string | null {
  const clean = input.toUpperCase().replace(/[\s-]/g, "");
  return /^[23456789A-HJ-NP-Z]{12}$/.test(clean) ? clean : null;
}
