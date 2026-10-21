import { describe, expect, it } from "vitest";
import { maskPhone, normalizeIndianMobile } from "./phone";
import { safeNextPath } from "./safe-redirect";

describe("normalizeIndianMobile", () => {
  it.each(["9876543210", "+919876543210", "919876543210", "09876543210", "98765 43210", "+91-98765-43210"])(
    "accepts %s",
    (input) => expect(normalizeIndianMobile(input)).toBe("+919876543210"),
  );

  it.each(["", "12345", "5876543210", "98765432101", "+449876543210", "98765abcde"])("rejects %s", (input) =>
    expect(normalizeIndianMobile(input)).toBeNull(),
  );
});

describe("maskPhone", () => {
  it("keeps only the country code and last four digits", () => {
    expect(maskPhone("+919876543210")).toBe("+91******3210");
  });
});

describe("safeNextPath", () => {
  it("allows same-site paths", () => {
    expect(safeNextPath("/checkout")).toBe("/checkout");
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "checkout", null, undefined])(
    "rejects %s",
    (input) => expect(safeNextPath(input)).toBe("/"),
  );
});
