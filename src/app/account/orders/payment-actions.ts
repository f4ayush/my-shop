"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { PaymentError, settleGatewayPayment, startOnlinePayment, type CheckoutSession } from "@/lib/payments/online";
import { fetchPayment, verifyPaymentSignature } from "@/lib/payments/razorpay";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

export async function startPaymentAction(orderNumber: string): Promise<Result<CheckoutSession & { contact: string }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please log in again." };
  try {
    const session = await startOnlinePayment(String(orderNumber).slice(0, 40), user.id);
    return { ok: true, ...session, contact: user.phone };
  } catch (e) {
    if (e instanceof PaymentError) return { ok: false, error: e.message };
    console.error("startOnlinePayment failed", e);
    return { ok: false, error: "We couldn't start the payment. Please try again in a moment." };
  }
}

const confirmSchema = z.object({
  orderNumber: z.string().min(1).max(40),
  razorpay_order_id: z.string().min(1).max(64),
  razorpay_payment_id: z.string().min(1).max(64),
  razorpay_signature: z.string().regex(/^[0-9a-f]{64}$/),
});

/** Called by Checkout's success handler. The webhook does the same independently, so either can finish it. */
export async function confirmPaymentAction(input: unknown): Promise<Result<object>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please log in again." };
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid payment response." };
  const p = parsed.data;

  // The gateway order must belong to this customer's order.
  const owned = await db.payment.findFirst({
    where: { gatewayOrderId: p.razorpay_order_id, order: { orderNumber: p.orderNumber, userId: user.id } },
    select: { id: true },
  });
  if (!owned) return { ok: false, error: "Payment doesn't match this order." };

  if (!verifyPaymentSignature({ orderId: p.razorpay_order_id, paymentId: p.razorpay_payment_id, signature: p.razorpay_signature })) {
    return { ok: false, error: "We couldn't verify this payment. If money was taken, it will be confirmed or refunded automatically." };
  }

  try {
    // Re-read the payment from Razorpay rather than trusting the browser for amount/status.
    const payment = await fetchPayment(p.razorpay_payment_id);
    if (payment.order_id !== p.razorpay_order_id) return { ok: false, error: "Payment doesn't match this order." };
    await settleGatewayPayment(payment);
  } catch (e) {
    console.error("confirmPayment failed", e);
    return { ok: false, error: "Payment received; we're confirming it. This page will update shortly." };
  }

  revalidatePath(`/account/orders/${p.orderNumber}`);
  return { ok: true };
}
