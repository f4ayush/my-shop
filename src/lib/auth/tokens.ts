import { createHash, randomBytes } from "node:crypto";

/** 256-bit random token for cookies. Only its hash is ever stored in the database. */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const secureCookie = process.env.NODE_ENV === "production";
