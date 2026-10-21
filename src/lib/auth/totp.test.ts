import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { hashRecoveryCode, open, parseMasterKey, seal } from "./secret-box";
import {
  base32Decode,
  base32Encode,
  groupSecret,
  hotp,
  newRecoveryCodes,
  newTotpSecret,
  normalizeRecoveryCode,
  otpauthUri,
  totp,
  totpStep,
  verifyTotp,
} from "./totp";

// RFC 4226 Appendix D / RFC 6238 Appendix B use the ASCII secret "12345678901234567890".
const RFC_SECRET = Buffer.from("12345678901234567890");
const RFC_SECRET_B32 = base32Encode(RFC_SECRET);

describe("base32", () => {
  it("round-trips and matches RFC 4648 vectors", () => {
    expect(base32Encode(Buffer.from("foobar"))).toBe("MZXW6YTBOI");
    expect(base32Decode("MZXW6YTBOI").toString()).toBe("foobar");
    expect(base32Decode("mzxw 6ytb-oi======").toString()).toBe("foobar");
    const bytes = randomBytes(20);
    expect(base32Decode(base32Encode(bytes)).equals(bytes)).toBe(true);
  });

  it("rejects characters outside the alphabet", () => {
    expect(() => base32Decode("ABC1")).toThrow();
  });
});

describe("hotp / totp", () => {
  it("matches the RFC 4226 HOTP vectors", () => {
    const expected = ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"];
    expected.forEach((code, counter) => expect(hotp(RFC_SECRET, counter)).toBe(code));
  });

  it("matches the RFC 6238 SHA-1 vectors (last 6 digits)", () => {
    expect(totp(RFC_SECRET_B32, 59_000)).toBe("287082");
    expect(totp(RFC_SECRET_B32, 1111111109_000)).toBe("081804");
    expect(totp(RFC_SECRET_B32, 1234567890_000)).toBe("005924");
    expect(totp(RFC_SECRET_B32, 20000000000_000)).toBe("353130");
  });

  it("new secrets are 160-bit base32", () => {
    const s = newTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Decode(s)).toHaveLength(20);
  });
});

describe("verifyTotp", () => {
  const secret = newTotpSecret();
  const now = 1_800_000_000_000;

  it("accepts the current code and returns its step", () => {
    expect(verifyTotp(secret, totp(secret, now), now)).toBe(totpStep(now));
  });

  it("allows one step of clock drift either way, but not two", () => {
    expect(verifyTotp(secret, totp(secret, now - 30_000), now)).toBe(totpStep(now) - 1);
    expect(verifyTotp(secret, totp(secret, now + 30_000), now)).toBe(totpStep(now) + 1);
    expect(verifyTotp(secret, totp(secret, now - 61_000), now)).toBeNull();
    expect(verifyTotp(secret, totp(secret, now + 61_000), now)).toBeNull();
  });

  it("refuses a code from a step that was already used (replay)", () => {
    const code = totp(secret, now);
    const step = verifyTotp(secret, code, now)!;
    expect(verifyTotp(secret, code, now, step)).toBeNull();
    expect(verifyTotp(secret, totp(secret, now - 30_000), now, step)).toBeNull();
    expect(verifyTotp(secret, totp(secret, now + 30_000), now, step)).toBe(step + 1);
  });

  it("rejects malformed input and wrong codes", () => {
    const code = totp(secret, now);
    const wrong = ((Number(code) + 1) % 1_000_000).toString().padStart(6, "0");
    expect(verifyTotp(secret, wrong, now)).toBeNull();
    expect(verifyTotp(secret, "12345", now)).toBeNull();
    expect(verifyTotp(secret, " 123456", now)).toBeNull();
    expect(verifyTotp(secret, "abcdef", now)).toBeNull();
  });
});

describe("otpauthUri / groupSecret", () => {
  it("builds an importable URI with issuer and account", () => {
    const uri = otpauthUri("JBSWY3DPEHPK3PXP", "+91******8888", "My Pharmacy");
    expect(uri.startsWith("otpauth://totp/My%20Pharmacy%3A%2B91******8888?")).toBe(true);
    const params = new URL(uri).searchParams;
    expect(params.get("secret")).toBe("JBSWY3DPEHPK3PXP");
    expect(params.get("issuer")).toBe("My Pharmacy");
    expect(params.get("digits")).toBe("6");
    expect(params.get("period")).toBe("30");
  });

  it("groups the secret in fours", () => {
    expect(groupSecret("JBSWY3DPEHPK3PXP")).toBe("JBSW Y3DP EHPK 3PXP");
  });
});

describe("recovery codes", () => {
  it("generates distinct, well-formed codes", () => {
    const codes = newRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) {
      expect(c).toMatch(/^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
      expect(normalizeRecoveryCode(c)).toBe(c.replace(/-/g, ""));
    }
  });

  it("normalises user input and rejects junk", () => {
    expect(normalizeRecoveryCode(" 7kq4 m2xd-9pta ")).toBe("7KQ4M2XD9PTA");
    expect(normalizeRecoveryCode("7KQ4-M2XD-9PT")).toBeNull();
    expect(normalizeRecoveryCode("0KQ4-M2XD-9PTA")).toBeNull(); // 0 isn't in the alphabet
    expect(normalizeRecoveryCode("123456")).toBeNull();
  });
});

describe("secret-box", () => {
  const key = randomBytes(32);

  it("parses only 32-byte keys", () => {
    expect(parseMasterKey(key.toString("base64url")).equals(key)).toBe(true);
    expect(parseMasterKey(key.toString("base64")).equals(key)).toBe(true);
    expect(() => parseMasterKey(undefined)).toThrow();
    expect(() => parseMasterKey(randomBytes(16).toString("base64url"))).toThrow();
  });

  it("seals and opens, with a fresh IV each time", () => {
    const a = seal(key, "JBSWY3DPEHPK3PXP");
    const b = seal(key, "JBSWY3DPEHPK3PXP");
    expect(a).not.toBe(b);
    expect(a).not.toContain("JBSWY3DPEHPK3PXP");
    expect(open(key, a)).toBe("JBSWY3DPEHPK3PXP");
  });

  it("fails on tampering or the wrong key", () => {
    const sealed = seal(key, "JBSWY3DPEHPK3PXP");
    const parts = sealed.split(".");
    const flipped = Buffer.from(parts[3], "base64url");
    flipped[0] ^= 1;
    expect(() => open(key, [...parts.slice(0, 3), flipped.toString("base64url")].join("."))).toThrow();
    expect(() => open(randomBytes(32), sealed)).toThrow();
    expect(() => open(key, "v0.x.y.z")).toThrow();
  });

  it("hashes recovery codes deterministically per key", () => {
    expect(hashRecoveryCode(key, "7KQ4M2XD9PTA")).toBe(hashRecoveryCode(key, "7KQ4M2XD9PTA"));
    expect(hashRecoveryCode(key, "7KQ4M2XD9PTA")).not.toBe(hashRecoveryCode(randomBytes(32), "7KQ4M2XD9PTA"));
  });
});
