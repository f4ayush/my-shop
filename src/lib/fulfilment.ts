import { db } from "@/lib/db";
import { DeliveryStatus, OrderStatus, PaymentMethod, PaymentStatus } from "@/generated/prisma/enums";
import { releaseOrderStock } from "@/lib/inventory-db";
import { notifyOrder } from "@/lib/notify";
import { canTransition, type Status } from "@/lib/order-flow";
import { refundOnlinePayment } from "@/lib/payments/online";

/** A problem staff can act on (shown as-is). */
export class FulfilmentError extends Error {}

export type TransitionInput = { orderId: string; to: Status; actorId: string; reason?: string };
export type TransitionResult = { refund: "none" | "started" | "failed"; invoiceToReverse: string | null };

/** Moves an order one step along the pickup/delivery flow and applies the stock and payment effects. */
export async function transitionOrder(input: TransitionInput): Promise<TransitionResult> {
  const { orderId, to, actorId } = input;
  const reason = input.reason?.trim();
  if (to === OrderStatus.CANCELLED && (!reason || reason.length < 3)) {
    throw new FulfilmentError("Give a reason for cancelling (it's shown to the customer).");
  }

  const result = await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        status: true,
        fulfilmentMode: true,
        items: { select: { batchId: true, quantity: true } },
        payments: { select: { id: true, method: true, status: true, gateway: true } },
        invoice: { select: { number: true } },
      },
    });
    if (!order) throw new FulfilmentError("Order not found.");
    if (!canTransition(order.status, to, order.fulfilmentMode)) {
      throw new FulfilmentError("This order has moved on since you loaded the page. Refresh and try again.");
    }

    // Guarded: only applies if nobody else changed the status meanwhile.
    const moved = await tx.order.updateMany({
      where: { id: orderId, status: order.status },
      data: { status: to, ...(to === OrderStatus.CANCELLED ? { cancelReason: reason } : {}) },
    });
    if (moved.count !== 1) throw new FulfilmentError("This order was just updated by someone else. Refresh and try again.");

    let refundPaymentId: string | null = null;

    if (to === OrderStatus.OUT_FOR_DELIVERY) {
      await tx.delivery.updateMany({ where: { orderId }, data: { status: DeliveryStatus.OUT_FOR_DELIVERY } });
    }

    if (to === OrderStatus.COMPLETED) {
      // Goods have left the shop: take them out of stock and out of the reservation.
      for (const item of order.items) {
        if (!item.batchId) continue;
        await tx.$executeRaw`
          UPDATE "InventoryBatch"
          SET quantity = GREATEST(quantity - ${item.quantity}, 0), reserved = GREATEST(reserved - ${item.quantity}, 0)
          WHERE id = ${item.batchId}`;
      }
      await tx.payment.updateMany({
        where: { orderId, method: PaymentMethod.COD, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.CAPTURED }, // cash/UPI collected at the door or counter
      });
      await tx.delivery.updateMany({ where: { orderId }, data: { status: DeliveryStatus.DELIVERED, deliveredAt: new Date() } });
    }

    if (to === OrderStatus.CANCELLED) {
      await releaseOrderStock(tx, order.items);
      await tx.payment.updateMany({
        where: { orderId, method: PaymentMethod.COD, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.FAILED, failureReason: "Order cancelled" },
      });
      if (order.fulfilmentMode === "DELIVERY") {
        await tx.delivery.updateMany({ where: { orderId }, data: { status: DeliveryStatus.FAILED } });
      }
      refundPaymentId = order.payments.find((p) => p.gateway && p.status === PaymentStatus.CAPTURED)?.id ?? null;
    }

    await tx.auditLog.create({
      data: {
        actorId,
        action: "order.status_change",
        entityType: "Order",
        entityId: orderId,
        metadata: { from: order.status, to, ...(reason ? { reason } : {}) },
      },
    });
    return { refundPaymentId, invoiceNumber: order.invoice?.number ?? null };
  });

  let refund: TransitionResult["refund"] = "none";
  if (result.refundPaymentId) {
    refund = (await refundOnlinePayment(result.refundPaymentId, `Order cancelled: ${reason}`, actorId)) ? "started" : "failed";
  }
  await notifyOrder(orderId);
  return { refund, invoiceToReverse: to === OrderStatus.CANCELLED ? result.invoiceNumber : null };
}
