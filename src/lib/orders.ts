import { db } from "@/lib/db";
import { OrderStatus, PaymentMethod, PaymentStatus } from "@/generated/prisma/enums";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PAYMENT_PENDING: "Awaiting payment",
  PLACED: "Order placed",
  AWAITING_RX_REVIEW: "Awaiting prescription check",
  RX_REJECTED: "Prescription not accepted",
  CONFIRMED: "Confirmed",
  PACKED: "Packed",
  READY_FOR_PICKUP: "Ready for pickup",
  OUT_FOR_DELIVERY: "Out for delivery",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

type PaymentSummary = { method: PaymentMethod; status: PaymentStatus };

const METHOD_LABEL: Record<PaymentMethod, string> = {
  UPI: "UPI",
  CARD: "card",
  NETBANKING: "netbanking",
  ONLINE: "online",
  COD: "cash on delivery",
};

/** One line describing how an order is (or will be) paid, from its latest payment. */
export function paymentLabel(p: PaymentSummary | undefined): string {
  if (!p) return "—";
  if (p.method === PaymentMethod.COD) return "Cash on delivery / pay at pickup";
  switch (p.status) {
    case PaymentStatus.CAPTURED:
      return `Paid by ${METHOD_LABEL[p.method]}`;
    case PaymentStatus.REFUND_PENDING:
      return "Refund in progress (usually 5–7 working days)";
    case PaymentStatus.REFUNDED:
      return "Refunded";
    case PaymentStatus.FAILED:
      return "Not paid";
    default:
      return "Online payment pending";
  }
}

/** Paid (or pay-later) orders still on their way to the customer. */
const IN_PROGRESS: OrderStatus[] = [
  OrderStatus.PLACED,
  OrderStatus.AWAITING_RX_REVIEW,
  OrderStatus.CONFIRMED,
  OrderStatus.PACKED,
  OrderStatus.READY_FOR_PICKUP,
  OrderStatus.OUT_FOR_DELIVERY,
];

/** The customer's newest in-progress order with its first two products, or null. */
export async function getActiveOrder(userId: string) {
  const order = await db.order.findFirst({
    where: { userId, status: { in: IN_PROGRESS } },
    orderBy: { createdAt: "desc" },
    select: {
      orderNumber: true,
      status: true,
      fulfilmentMode: true,
      prescriptionId: true,
      items: { orderBy: { id: "asc" }, select: { productId: true, productName: true, quantity: true } },
    },
  });
  if (!order) return null;
  // Batches of the same product are separate order lines; show them combined.
  const lines = new Map<string, { productId: string; name: string; quantity: number }>();
  for (const i of order.items) {
    const l = lines.get(i.productId) ?? { productId: i.productId, name: i.productName, quantity: 0 };
    l.quantity += i.quantity;
    lines.set(i.productId, l);
  }
  return { ...order, items: [...lines.values()].slice(0, 2), itemCount: lines.size };
}

const dateFormat = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

export function formatOrderDate(d: Date): string {
  return dateFormat.format(d);
}
