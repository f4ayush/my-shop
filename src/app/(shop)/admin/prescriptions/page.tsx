import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { firstParam, type RawSearchParams } from "@/lib/catalog";
import { formatPaise } from "@/lib/money";
import { formatOrderDate, ORDER_STATUS_LABEL } from "@/lib/orders";
import { retryRefundAction } from "./actions";
import { maskPhone } from "@/lib/phone";
import { OrderStatus, PaymentStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Prescription queue", robots: { index: false, follow: false } };

const DONE_MESSAGE: Record<string, string> = {
  approved: "Order approved and confirmed.",
  rejected: "Order rejected and stock released.",
  rejected_refunded: "Order rejected, stock released and a full refund started.",
  rejected_refund_failed: "The refund couldn't be started. It's listed below — please retry.",
  refund_retried: "Refund started.",
};

function waitingFor(since: Date): string {
  const mins = Math.max(0, Math.round((Date.now() - since.getTime()) / 60_000));
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  return hours < 24 ? `${hours} h ${mins % 60} min` : `${Math.floor(hours / 24)} d`;
}

export default async function PrescriptionQueuePage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  await requireStaff();
  const done = firstParam((await searchParams).done);

  // Money still held for orders that won't be fulfilled (refund call failed or not yet made).
  const refundsNeeded = await db.payment.findMany({
    where: {
      status: PaymentStatus.CAPTURED,
      gateway: { not: null },
      order: { status: { in: [OrderStatus.RX_REJECTED, OrderStatus.CANCELLED] } },
    },
    select: { id: true, amountPaise: true, order: { select: { orderNumber: true, status: true } } },
    take: 50,
  });

  const queue = await db.order.findMany({
    where: { status: OrderStatus.AWAITING_RX_REVIEW },
    orderBy: { createdAt: "asc" }, // oldest first
    take: 100,
    select: {
      orderNumber: true,
      createdAt: true,
      totalPaise: true,
      fulfilmentMode: true,
      user: { select: { phone: true } },
      items: { select: { product: { select: { requiresRx: true, schedule: true } } } },
    },
  });

  return (
    <section>
      <h1 className="mb-1 text-2xl font-bold">Prescription queue</h1>
      <p className="mb-4 text-sm text-slate-500">
        {queue.length} {queue.length === 1 ? "order" : "orders"} waiting · oldest first
      </p>

      {done && DONE_MESSAGE[done] && (
        <p
          role="status"
          className={`mb-4 rounded-md p-3 text-sm ${done === "rejected_refund_failed" ? "bg-red-50 text-red-900" : "bg-green-50 text-green-900"}`}
        >
          {DONE_MESSAGE[done]}
        </p>
      )}

      {refundsNeeded.length > 0 && (
        <div className="mb-6 rounded-xl border border-red-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-semibold text-red-800">Refunds needing attention</h2>
          <ul className="space-y-2 text-sm">
            {refundsNeeded.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {p.order.orderNumber} · {formatPaise(p.amountPaise)} · {ORDER_STATUS_LABEL[p.order.status]}
                </span>
                <form action={retryRefundAction}>
                  <input type="hidden" name="paymentId" value={p.id} />
                  <button className="rounded-md border border-red-300 px-3 py-1 text-red-800 hover:bg-red-50">
                    Retry refund
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      {queue.length === 0 ? (
        <p className="rounded-xl bg-white p-6 text-slate-600 shadow-sm">Nothing to review right now.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-xl bg-white shadow-sm">
          {queue.map((o) => {
            const rxCount = o.items.filter((i) => i.product.requiresRx).length;
            const hasH1 = o.items.some((i) => i.product.schedule === "H1");
            return (
              <li key={o.orderNumber}>
                <Link
                  href={`/admin/prescriptions/${o.orderNumber}`}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-slate-50"
                >
                  <div>
                    <div className="font-medium">{o.orderNumber}</div>
                    <div className="text-xs text-slate-500">
                      {formatOrderDate(o.createdAt)} · {maskPhone(o.user.phone)} ·{" "}
                      {o.fulfilmentMode === "PICKUP" ? "Pickup" : "Delivery"}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    {hasH1 && <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">H1</span>}
                    <span>{rxCount} Rx item{rxCount === 1 ? "" : "s"}</span>
                    <span className="font-semibold">{formatPaise(o.totalPaise)}</span>
                    <span className="text-slate-500">waiting {waitingFor(o.createdAt)}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
