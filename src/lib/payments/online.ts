import { db } from "@/lib/db";
import { OrderStatus, PaymentMethod, PaymentStatus } from "@/generated/prisma/enums";
import { releaseOrderStock } from "@/lib/inventory-db";
import { notifyOrder } from "@/lib/notify";
import {
  capturePayment,
  createRazorpayOrder,
  razorpayKeyId,
  refundPayment,
  type RazorpayPayment,
} from "./razorpay";

/** How long stock is held for an unpaid online order. */
export const PAYMENT_HOLD_MINUTES = 30;
const GATEWAY = "razorpay";

/** A payment problem the customer can act on (shown as-is). */
export class PaymentError extends Error {}

export function methodFromGateway(method: string | undefined): PaymentMethod {
  if (method === "upi") return PaymentMethod.UPI;
  if (method === "card") return PaymentMethod.CARD;
  if (method === "netbanking") return PaymentMethod.NETBANKING;
  return PaymentMethod.ONLINE;
}

export type CheckoutSession = { keyId: string; gatewayOrderId: string; amountPaise: number; orderNumber: string };

/** Gets (or creates) the Razorpay order the customer pays into for one of their unpaid orders. */
export async function startOnlinePayment(orderNumber: string, userId: string): Promise<CheckoutSession> {
  const order = await db.order.findFirst({
    where: { orderNumber, userId },
    select: {
      status: true,
      createdAt: true,
      payments: { where: { gateway: GATEWAY, status: PaymentStatus.PENDING }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!order) throw new PaymentError("Order not found.");
  if (order.status !== OrderStatus.PAYMENT_PENDING) throw new PaymentError("This order doesn't need payment.");
  if (order.createdAt.getTime() < Date.now() - PAYMENT_HOLD_MINUTES * 60_000) {
    throw new PaymentError("The time to pay for this order has run out. Please place it again.");
  }
  const payment = order.payments[0];
  if (!payment) throw new PaymentError("This order doesn't need payment.");

  let gatewayOrderId = payment.gatewayOrderId;
  if (!gatewayOrderId) {
    const rzp = await createRazorpayOrder({
      amountPaise: payment.amountPaise,
      receipt: orderNumber,
      notes: { orderNumber },
    });
    // Only set it if nobody else did meanwhile (double click), then use whichever won.
    await db.payment.updateMany({ where: { id: payment.id, gatewayOrderId: null }, data: { gatewayOrderId: rzp.id } });
    gatewayOrderId = (await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).gatewayOrderId!;
  }
  return { keyId: razorpayKeyId(), gatewayOrderId, amountPaise: payment.amountPaise, orderNumber };
}

/**
 * Applies a successful gateway payment: captures it if only authorized, marks our payment captured
 * and moves the order on. Idempotent — safe for the Checkout callback and webhook retries alike.
 */
export async function settleGatewayPayment(entity: RazorpayPayment): Promise<"settled" | "duplicate" | "ignored"> {
  const payment = await db.payment.findFirst({
    where: { gateway: GATEWAY, gatewayOrderId: entity.order_id },
    select: { id: true, amountPaise: true, status: true, gatewayPaymentId: true, orderId: true },
  });
  if (!payment) return "ignored"; // not one of ours
  if (payment.gatewayPaymentId === entity.id && payment.status !== PaymentStatus.PENDING) return "duplicate";

  if (entity.amount !== payment.amountPaise || entity.currency !== "INR") {
    await db.auditLog.create({
      data: {
        action: "payment.amount_mismatch",
        entityType: "Payment",
        entityId: payment.id,
        metadata: { expected: payment.amountPaise, received: entity.amount, currency: entity.currency, gatewayPaymentId: entity.id },
      },
    });
    return "ignored";
  }

  let captured = entity;
  if (entity.status === "authorized") captured = await capturePayment(entity.id, entity.amount);
  if (captured.status !== "captured") return "ignored";

  const needsRefund = await db.$transaction(async (tx) => {
    const marked = await tx.payment.updateMany({
      where: { id: payment.id, status: { in: [PaymentStatus.PENDING, PaymentStatus.FAILED, PaymentStatus.AUTHORIZED] } },
      data: {
        status: PaymentStatus.CAPTURED,
        gatewayPaymentId: captured.id,
        method: methodFromGateway(captured.method),
        failureReason: null,
      },
    });
    if (marked.count !== 1) return false; // already settled by a parallel delivery

    const order = await tx.order.findUniqueOrThrow({
      where: { id: payment.orderId },
      select: { status: true, prescriptionId: true },
    });
    const next = order.prescriptionId ? OrderStatus.AWAITING_RX_REVIEW : OrderStatus.PLACED;
    const moved = await tx.order.updateMany({
      where: { id: payment.orderId, status: OrderStatus.PAYMENT_PENDING },
      data: { status: next },
    });
    await tx.auditLog.create({
      data: {
        action: "payment.captured",
        entityType: "Payment",
        entityId: payment.id,
        metadata: { gatewayPaymentId: captured.id, orderId: payment.orderId, orderStatus: moved.count ? next : order.status },
      },
    });
    // Paid after the order expired or was cancelled: the money goes back.
    return moved.count === 0;
  });

  if (needsRefund) await refundOnlinePayment(payment.id, "Order was no longer active when payment arrived");
  else await notifyOrder(payment.orderId);
  return "settled";
}

/** Records a failed attempt. The order stays payable (customers often retry with another method). */
export async function recordFailedAttempt(gatewayOrderId: string, reason: string | null | undefined): Promise<void> {
  await db.payment.updateMany({
    where: { gateway: GATEWAY, gatewayOrderId, status: PaymentStatus.PENDING },
    data: { failureReason: reason?.slice(0, 300) ?? "Payment failed" },
  });
}

/** Starts a full refund of a captured online payment. Returns false if the gateway call failed. */
export async function refundOnlinePayment(paymentId: string, reason: string, actorId?: string): Promise<boolean> {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status !== PaymentStatus.CAPTURED || !payment.gatewayPaymentId) return false;

  try {
    const refund = await refundPayment(payment.gatewayPaymentId, payment.amountPaise, { reason: reason.slice(0, 200) });
    await db.payment.updateMany({
      where: { id: payment.id, status: PaymentStatus.CAPTURED },
      data: { status: PaymentStatus.REFUND_PENDING, gatewayRefundId: refund.id },
    });
    await db.auditLog.create({
      data: { actorId, action: "payment.refund_initiated", entityType: "Payment", entityId: payment.id, metadata: { reason, refundId: refund.id } },
    });
    return true;
  } catch (e) {
    console.error("Refund failed", payment.id, e);
    await db.auditLog.create({
      data: {
        actorId,
        action: "payment.refund_failed",
        entityType: "Payment",
        entityId: payment.id,
        metadata: { reason, error: e instanceof Error ? e.message : String(e) },
      },
    });
    return false;
  }
}

export async function recordRefundResult(gatewayPaymentId: string, ok: boolean): Promise<void> {
  await db.payment.updateMany({
    where: { gateway: GATEWAY, gatewayPaymentId, status: PaymentStatus.REFUND_PENDING },
    // A failed refund goes back to "captured" so it shows up for staff to retry.
    data: { status: ok ? PaymentStatus.REFUNDED : PaymentStatus.CAPTURED },
  });
}

/** Cancels unpaid online orders older than the hold time and releases their stock. */
export async function expireUnpaidOrders(): Promise<number> {
  const cutoff = new Date(Date.now() - PAYMENT_HOLD_MINUTES * 60_000);
  const stale = await db.order.findMany({
    where: { status: OrderStatus.PAYMENT_PENDING, createdAt: { lt: cutoff } },
    select: { id: true, items: { select: { batchId: true, quantity: true } } },
    take: 50,
  });
  let expired = 0;
  for (const order of stale) {
    await db.$transaction(async (tx) => {
      const moved = await tx.order.updateMany({
        where: { id: order.id, status: OrderStatus.PAYMENT_PENDING },
        data: { status: OrderStatus.CANCELLED },
      });
      if (moved.count !== 1) return;
      await releaseOrderStock(tx, order.items);
      await tx.payment.updateMany({
        where: { orderId: order.id, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.FAILED, failureReason: "Not paid in time" },
      });
      await tx.auditLog.create({
        data: { action: "order.payment_expired", entityType: "Order", entityId: order.id },
      });
      expired++;
    });
    await notifyOrder(order.id);
  }
  return expired;
}
