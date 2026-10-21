import { createHmac, timingSafeEqual } from "node:crypto";

// Minimal Razorpay REST client (https://razorpay.com/docs/api/). The key secret never leaves the server.

const API = "https://api.razorpay.com/v1";

export function onlinePaymentsEnabled(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function razorpayKeyId(): string {
  const id = process.env.RAZORPAY_KEY_ID;
  if (!id) throw new Error("RAZORPAY_KEY_ID is not configured");
  return id;
}

function keySecret(): string {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) throw new Error("RAZORPAY_KEY_SECRET is not configured");
  return secret;
}

function hmacHex(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Checks the signature Checkout returns: HMAC-SHA256("<order_id>|<payment_id>", key secret). */
export function verifyPaymentSignature(
  p: { orderId: string; paymentId: string; signature: string },
  secret: string = keySecret(),
): boolean {
  return safeEqual(hmacHex(secret, `${p.orderId}|${p.paymentId}`), p.signature);
}

/** Checks the X-Razorpay-Signature header: HMAC-SHA256(raw body, webhook secret). */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string | undefined = process.env.RAZORPAY_WEBHOOK_SECRET,
): boolean {
  if (!secret || !signature) return false;
  return safeEqual(hmacHex(secret, rawBody), signature);
}

export class RazorpayError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const auth = Buffer.from(`${razorpayKeyId()}:${keySecret()}`).toString("base64");
  const res = await fetch(`${API}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { error?: { description?: string } };
  if (!res.ok) throw new RazorpayError(json.error?.description ?? `Razorpay request failed (${res.status})`, res.status);
  return json as T;
}

export type RazorpayPayment = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  method: string;
  error_description?: string | null;
};

export function createRazorpayOrder(p: { amountPaise: number; receipt: string; notes: Record<string, string> }) {
  return call<{ id: string; status: string }>("/orders", {
    amount: p.amountPaise,
    currency: "INR",
    receipt: p.receipt,
    notes: p.notes,
  });
}

export function fetchPayment(paymentId: string) {
  return call<RazorpayPayment>(`/payments/${encodeURIComponent(paymentId)}`);
}

export function capturePayment(paymentId: string, amountPaise: number) {
  return call<RazorpayPayment>(`/payments/${encodeURIComponent(paymentId)}/capture`, {
    amount: amountPaise,
    currency: "INR",
  });
}

export function refundPayment(paymentId: string, amountPaise: number, notes: Record<string, string>) {
  return call<{ id: string; status: string }>(`/payments/${encodeURIComponent(paymentId)}/refund`, {
    amount: amountPaise,
    notes,
  });
}
