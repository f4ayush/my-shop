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

const dateFormat = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

export function formatOrderDate(d: Date): string {
  return dateFormat.format(d);
}
