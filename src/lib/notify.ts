import { db } from "@/lib/db";
import { sendSms } from "@/lib/auth/sms";
import type { Status } from "@/lib/order-flow";

// Fixed SMS templates (Indian SMS needs DLT-registered templates, so keep these exact once registered).
// For privacy they mention only the order number and status — never medicines or prescriptions' contents.
const TEMPLATES: Partial<Record<Status, { key: string; text: (n: string) => string }>> = {
  PLACED: { key: "order.placed", text: (n) => `My Pharmacy: we've received order ${n}. We'll message you when it's confirmed.` },
  AWAITING_RX_REVIEW: {
    key: "order.rx_review",
    text: (n) => `My Pharmacy: we've received order ${n}. Our pharmacist is checking your prescription.`,
  },
  CONFIRMED: { key: "order.confirmed", text: (n) => `My Pharmacy: order ${n} is confirmed and being prepared.` },
  READY_FOR_PICKUP: {
    key: "order.ready_for_pickup",
    text: (n) => `My Pharmacy: order ${n} is ready for pickup at the counter. Please quote your order number.`,
  },
  OUT_FOR_DELIVERY: { key: "order.out_for_delivery", text: (n) => `My Pharmacy: order ${n} is out for delivery.` },
  COMPLETED: { key: "order.completed", text: (n) => `My Pharmacy: order ${n} is complete. Thank you!` },
  RX_REJECTED: {
    key: "order.rx_rejected",
    text: (n) => `My Pharmacy: we couldn't accept the prescription for order ${n}. Please check your account for details.`,
  },
  CANCELLED: {
    key: "order.cancelled",
    text: (n) => `My Pharmacy: order ${n} has been cancelled. Any online payment will be refunded. Details in your account.`,
  },
};

/**
 * Sends the customer the message for the order's current status, at most once per status.
 * Never throws: a failed message must not undo or block the order change that triggered it.
 */
export async function notifyOrder(orderId: string): Promise<void> {
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { orderNumber: true, status: true, user: { select: { phone: true } } },
    });
    const template = order && TEMPLATES[order.status];
    if (!order || !template) return;

    // Claim the (order, template) slot first; a duplicate trigger finds it taken and stops.
    const claimed = await db.notification
      .create({ data: { orderId, template: template.key, channel: "sms", status: "sending" }, select: { id: true } })
      .catch(() => null);
    if (!claimed) return;

    try {
      await sendSms(order.user.phone, template.text(order.orderNumber));
      await db.notification.update({ where: { id: claimed.id }, data: { status: "sent" } });
    } catch (e) {
      await db.notification.update({
        where: { id: claimed.id },
        data: { status: "failed", error: (e instanceof Error ? e.message : String(e)).slice(0, 300) },
      });
    }
  } catch (e) {
    console.error("notifyOrder failed", orderId, e);
  }
}
