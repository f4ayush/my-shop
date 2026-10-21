import { db } from "@/lib/db";
import { OrderStatus, PaymentMethod, PaymentStatus } from "@/generated/prisma/enums";
import { financialYear, formatInvoiceNumber } from "./invoice-math";

const NOT_INVOICEABLE: OrderStatus[] = [
  OrderStatus.PAYMENT_PENDING,
  OrderStatus.AWAITING_RX_REVIEW,
  OrderStatus.RX_REJECTED,
  OrderStatus.CANCELLED,
];

/** An order gets a tax invoice once it's going ahead: Rx verified (if any) and paid online, or COD. */
export function invoiceEligible(order: {
  status: OrderStatus;
  payments: { method: PaymentMethod; status: PaymentStatus }[];
}): boolean {
  if (NOT_INVOICEABLE.includes(order.status)) return false;
  return order.payments.some((p) => p.method === PaymentMethod.COD || p.status === PaymentStatus.CAPTURED);
}

/** Returns the order's invoice, issuing the next consecutive number for the financial year if needed. */
export async function ensureInvoice(orderId: string, now: Date = new Date()) {
  const existing = await db.invoice.findUnique({ where: { orderId } });
  if (existing) return existing;

  const fy = financialYear(now);
  try {
    return await db.$transaction(async (tx) => {
      // Atomic increment: concurrent issues get distinct numbers, and a rollback releases the number.
      const [{ lastNumber }] = await tx.$queryRaw<{ lastNumber: number }[]>`
        INSERT INTO "InvoiceCounter" ("financialYear", "lastNumber") VALUES (${fy}, 1)
        ON CONFLICT ("financialYear") DO UPDATE SET "lastNumber" = "InvoiceCounter"."lastNumber" + 1
        RETURNING "lastNumber"`;
      return tx.invoice.create({
        data: { orderId, financialYear: fy, number: formatInvoiceNumber(fy, lastNumber), issuedAt: now },
      });
    });
  } catch (e) {
    // Another request issued it first (unique orderId); use that one.
    const raced = await db.invoice.findUnique({ where: { orderId } });
    if (raced) return raced;
    throw e;
  }
}
