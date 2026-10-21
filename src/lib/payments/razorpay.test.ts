import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyPaymentSignature, verifyWebhookSignature } from "./razorpay";

const sign = (secret: string, data: string) => createHmac("sha256", secret).update(data).digest("hex");

describe("verifyPaymentSignature", () => {
  const secret = "test_key_secret";
  const p = { orderId: "order_ABC", paymentId: "pay_XYZ" };

  it("accepts Razorpay's order|payment HMAC", () => {
    expect(verifyPaymentSignature({ ...p, signature: sign(secret, "order_ABC|pay_XYZ") }, secret)).toBe(true);
  });

  it("rejects a signature for another payment, secret or format", () => {
    expect(verifyPaymentSignature({ ...p, signature: sign(secret, "order_ABC|pay_OTHER") }, secret)).toBe(false);
    expect(verifyPaymentSignature({ ...p, signature: sign("wrong", "order_ABC|pay_XYZ") }, secret)).toBe(false);
    expect(verifyPaymentSignature({ ...p, signature: "short" }, secret)).toBe(false);
  });
});

describe("verifyWebhookSignature", () => {
  const secret = "whsec_test";
  const body = '{"event":"payment.captured"}';

  it("accepts an HMAC of the exact raw body", () => {
    expect(verifyWebhookSignature(body, sign(secret, body), secret)).toBe(true);
  });

  it("rejects tampered bodies, missing signatures and a missing secret", () => {
    expect(verifyWebhookSignature(body.replace("captured", "failed"), sign(secret, body), secret)).toBe(false);
    expect(verifyWebhookSignature(body, null, secret)).toBe(false);
    expect(verifyWebhookSignature(body, sign(secret, body), undefined)).toBe(false);
  });
});
