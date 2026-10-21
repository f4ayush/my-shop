import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";

// Encrypts staff TOTP secrets at rest (AES-256-GCM) and hashes recovery codes, with keys derived
// from MFA_ENCRYPTION_KEY. A database dump alone is then not enough to mint staff codes.

const VERSION = "v1";

/** Parses a base64/base64url key of exactly 32 bytes. */
export function parseMasterKey(raw: string | undefined): Buffer {
  const key = raw ? Buffer.from(raw.trim(), "base64url") : Buffer.alloc(0);
  if (key.length !== 32) throw new Error("MFA_ENCRYPTION_KEY must be 32 random bytes, base64url-encoded");
  return key;
}

function subkey(master: Buffer, purpose: string): Buffer {
  return Buffer.from(hkdfSync("sha256", master, Buffer.alloc(0), `my-pharmacy:${purpose}`, 32));
}

export function seal(master: Buffer, plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", subkey(master, "totp-secret"), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

export function open(master: Buffer, sealed: string): string {
  const [version, iv, tag, ct] = sealed.split(".");
  if (version !== VERSION || !iv || !tag || !ct) throw new Error("Unrecognised sealed value");
  const decipher = createDecipheriv("aes-256-gcm", subkey(master, "totp-secret"), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}

/** Keyed hash of a normalised recovery code, for storage and lookup. */
export function hashRecoveryCode(master: Buffer, normalizedCode: string): string {
  return createHmac("sha256", subkey(master, "recovery-code")).update(normalizedCode).digest("hex");
}

export function mfaMasterKey(): Buffer {
  return parseMasterKey(process.env.MFA_ENCRYPTION_KEY);
}
