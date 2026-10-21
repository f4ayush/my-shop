import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { firstParam, type RawSearchParams } from "@/lib/catalog";
import { formatPaise } from "@/lib/money";
import { PayNowButton } from "@/components/PayNowButton";
import { invoiceEligible } from "@/lib/invoice";
import { progressSteps } from "@/lib/order-flow";
import { formatOrderDate, ORDER_STATUS_LABEL, paymentLabel } from "@/lib/orders";
import { expireUnpaidOrders, PAYMENT_HOLD_MINUTES } from "@/lib/payments/online";
import { formatSlot } from "@/lib/store";

type Props = { params: Promise<{ orderNumber: string }>; searchParams: Promise<RawSearchParams> };

export const metadata: Metadata = { title: "Order details", robots: { index: false } };

export default async function OrderPage({ params, searchParams }: Props) {
  const { orderNumber } = await params;
  const user = await requireUser(`/account/orders/${encodeURIComponent(orderNumber)}`);
  const sp = await searchParams;
  const autoPay = firstParam(sp.pay) === "1";

  await expireUnpaidOrders();
  // Scoped to the signed-in user: other people's order numbers simply 404.
  const order = await db.order.findFirst({
    where: { orderNumber, userId: user.id },
    include: {
      items: { orderBy: { id: "asc" } },
      address: true,
      payments: { orderBy: { createdAt: "desc" } },
      invoice: { select: { number: true } },
    },
  });
  if (!order) notFound();
  const payment = order.payments[0];
  const awaitingPayment = order.status === "PAYMENT_PENDING";
  const justPlaced = firstParam(sp.placed) === "1" && !awaitingPayment;
  const progress = progressSteps(order.status, order.fulfilmentMode, Boolean(order.prescriptionId));
  const payBy = new Date(order.createdAt.getTime() + PAYMENT_HOLD_MINUTES * 60_000);

  // Batches of the same product are separate order lines; show them combined.
  const lines = new Map<string, { name: string; quantity: number; totalPaise: number; unitPaise: number }>();
  for (const i of order.items) {
    const l = lines.get(i.productId) ?? { name: i.productName, quantity: 0, totalPaise: 0, unitPaise: i.unitPricePaise };
    l.quantity += i.quantity;
    l.totalPaise += i.lineTotalPaise;
    lines.set(i.productId, l);
  }

  return (
    <section className="space-y-6">
      {justPlaced && (
        <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-5 text-green-900">
          <h1 className="text-xl font-bold">Thank you! Your order is placed.</h1>
          <p className="mt-1 text-sm">
            We’ll confirm it shortly. Keep your order number <strong>{order.orderNumber}</strong> handy.
          </p>
        </div>
      )}

      {awaitingPayment && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <h1 className="text-lg font-bold">Complete your payment</h1>
          <p className="mb-3 mt-1 text-sm">
            Your items are held until {formatOrderDate(payBy)}. Pay {formatPaise(order.totalPaise)} to confirm order{" "}
            {order.orderNumber}.
            {payment?.failureReason && <> Last attempt: {payment.failureReason}</>}
          </p>
          <PayNowButton orderNumber={order.orderNumber} autoOpen={autoPay} />
        </div>
      )}
      {order.status === "CANCELLED" && (
        <div className="rounded-xl bg-slate-100 p-4 text-sm text-slate-700">
          <p className="font-medium">This order was cancelled.</p>
          {order.cancelReason && <p className="mt-1">Reason: {order.cancelReason}</p>}
        </div>
      )}

      {progress.current >= 0 && (
        <ol aria-label="Order progress" className="flex flex-wrap gap-x-2 gap-y-2 rounded-xl bg-white p-4 text-xs shadow-sm sm:text-sm">
          {progress.steps.map((s, i) => (
            <li key={s.key} className="flex items-center gap-2" aria-current={i === progress.current ? "step" : undefined}>
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  i < progress.current
                    ? "bg-brand text-white"
                    : i === progress.current
                      ? "bg-brand text-white ring-4 ring-brand/20"
                      : "bg-slate-200 text-slate-500"
                }`}
              >
                {i < progress.current ? "✓" : i + 1}
              </span>
              <span className={i <= progress.current ? "font-medium" : "text-slate-500"}>{s.label}</span>
              {i < progress.steps.length - 1 && <span aria-hidden className="text-slate-300">—</span>}
            </li>
          ))}
        </ol>
      )}

      {order.status === "AWAITING_RX_REVIEW" && (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          Our pharmacist is checking your prescription. We’ll confirm your order once it’s verified.
        </p>
      )}
      {order.status === "RX_REJECTED" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-medium">We couldn’t accept the prescription for this order, so it has been cancelled.</p>
          {order.rxReviewNotes && <p className="mt-1">Pharmacist’s note: {order.rxReviewNotes}</p>}
          <Link href="/account/prescriptions" className="mt-2 inline-block underline">
            Upload a new prescription
          </Link>
        </div>
      )}
      {order.status === "CONFIRMED" && order.prescriptionId && order.rxReviewNotes && (
        <p className="rounded-xl bg-green-50 p-4 text-sm text-green-900">Pharmacist’s note: {order.rxReviewNotes}</p>
      )}

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Order {order.orderNumber}</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm">{ORDER_STATUS_LABEL[order.status]}</span>
        </div>
        <p className="text-sm text-slate-500">Placed {formatOrderDate(order.createdAt)}</p>

        <div className="mt-4 text-sm">
          {order.fulfilmentMode === "PICKUP" ? (
            <p>
              <span className="font-medium">Store pickup</span>
              {order.pickupSlotStart && <> · {formatSlot(order.pickupSlotStart)}</>}
            </p>
          ) : (
            order.address && (
              <p>
                <span className="font-medium">Deliver to:</span> {order.address.line1}
                {order.address.line2 && `, ${order.address.line2}`}, {order.address.city}, {order.address.state}{" "}
                {order.address.pincode}
              </p>
            )
          )}
          <p className="mt-1">
            <span className="font-medium">Payment:</span>{" "}
            {paymentLabel(payment)}
          </p>
          {invoiceEligible(order) && (
            <p className="mt-3">
              <Link href={`/account/orders/${order.orderNumber}/invoice`} className="text-brand hover:underline">
                {order.invoice ? `Tax invoice ${order.invoice.number}` : "View tax invoice"} →
              </Link>
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="pb-2 font-normal">Item</th>
              <th className="pb-2 text-right font-normal">Qty</th>
              <th className="pb-2 text-right font-normal">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {[...lines].map(([productId, l]) => (
              <tr key={productId}>
                <td className="py-2">
                  {l.name}
                  <div className="text-xs text-slate-500">{formatPaise(l.unitPaise)} each</div>
                </td>
                <td className="py-2 text-right">{l.quantity}</td>
                <td className="py-2 text-right">{formatPaise(l.totalPaise)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="text-right">
            <tr>
              <td colSpan={2} className="pt-3 text-slate-500">
                Items (incl. GST {formatPaise(order.gstPaise)})
              </td>
              <td className="pt-3">{formatPaise(order.subtotalPaise)}</td>
            </tr>
            <tr>
              <td colSpan={2} className="text-slate-500">
                {order.fulfilmentMode === "PICKUP" ? "Pickup" : "Delivery"}
              </td>
              <td>{order.deliveryFeePaise === 0 ? "Free" : formatPaise(order.deliveryFeePaise)}</td>
            </tr>
            <tr className="text-base font-semibold">
              <td colSpan={2} className="pt-2">
                Total
              </td>
              <td className="pt-2">{formatPaise(order.totalPaise)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <Link href="/account/orders" className="text-sm text-brand hover:underline">
        ← All orders
      </Link>
    </section>
  );
}
