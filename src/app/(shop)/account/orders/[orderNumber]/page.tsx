import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckIcon, PhoneIcon } from "@/components/icons";
import { OrderAgainButton } from "@/components/OrderAgainButton";
import { PayNowButton } from "@/components/PayNowButton";
import { ProductThumb } from "@/components/ProductArt";
import { btn, card } from "@/components/ui";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { BUSINESS } from "@/lib/business";
import { firstParam, type RawSearchParams } from "@/lib/catalog";
import { formatPrice } from "@/lib/money";
import { invoiceEligible } from "@/lib/invoice";
import { progressSteps, type Status } from "@/lib/order-flow";
import { formatOrderDate, ORDER_STATUS_LABEL, paymentLabel } from "@/lib/orders";
import { expireUnpaidOrders, PAYMENT_HOLD_MINUTES } from "@/lib/payments/online";
import { formatSlot } from "@/lib/store";

type Props = { params: Promise<{ orderNumber: string }>; searchParams: Promise<RawSearchParams> };

export const metadata: Metadata = { title: "Order details", robots: { index: false } };

/** A line under the step the order is at now. */
const NOW: Partial<Record<Status, string>> = {
  PLACED: "We’ll confirm it shortly",
  AWAITING_RX_REVIEW: "Our pharmacist is checking your prescription",
  CONFIRMED: "Being prepared",
  PACKED: "Sealed and packed",
  READY_FOR_PICKUP: "Collect it at the counter — quote your order number",
  OUT_FOR_DELIVERY: "On its way to you",
  COMPLETED: "Thank you for your order",
};

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

  const fulfilment =
    order.fulfilmentMode === "PICKUP"
      ? `Store pickup${order.pickupSlotStart ? ` · ${formatSlot(order.pickupSlotStart)}` : ""}`
      : order.address
        ? `Delivery to ${order.address.city} ${order.address.pincode}`
        : "Delivery";

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted">
            Order {order.orderNumber} · placed {formatOrderDate(order.createdAt)}
          </span>
          <h1 className="text-[clamp(30px,4vw,48px)] leading-[1.05] font-extrabold tracking-[-0.03em]">
            {ORDER_STATUS_LABEL[order.status]}
          </h1>
          <span className="text-[17px] text-ink-2">{fulfilment}</span>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {invoiceEligible(order) && (
            <Link href={`/account/orders/${order.orderNumber}/invoice`} className={btn("outline")}>
              {order.invoice ? `Invoice ${order.invoice.number}` : "Download invoice"}
            </Link>
          )}
          <OrderAgainButton orderNumber={order.orderNumber} className={btn("outline")} />
          <Link href="/grievance" className={btn("primary")}>
            Get help
          </Link>
        </div>
      </div>

      {justPlaced && (
        <div role="status" className="rounded-3xl border border-green-200 bg-green-50 p-5 text-green-900">
          <strong className="text-lg">Thank you! Your order is placed.</strong>
          <p className="mt-1 text-sm">
            We’ll confirm it shortly. Keep your order number <strong>{order.orderNumber}</strong> handy.
          </p>
        </div>
      )}

      {awaitingPayment && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <strong className="text-lg">Complete your payment</strong>
          <p className="mt-1 mb-3 text-sm">
            Your items are held until {formatOrderDate(payBy)}. Pay {formatPrice(order.totalPaise)} to confirm order{" "}
            {order.orderNumber}.
            {payment?.failureReason && <> Last attempt: {payment.failureReason}</>}
          </p>
          <PayNowButton orderNumber={order.orderNumber} autoOpen={autoPay} />
        </div>
      )}
      {order.status === "CANCELLED" && (
        <div className="rounded-3xl bg-field p-5 text-sm text-ink-2">
          <p className="font-semibold text-ink">This order was cancelled.</p>
          {order.cancelReason && <p className="mt-1">Reason: {order.cancelReason}</p>}
        </div>
      )}
      {order.status === "RX_REJECTED" && (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
          <p className="font-semibold">We couldn’t accept the prescription for this order, so it has been cancelled.</p>
          {order.rxReviewNotes && <p className="mt-1">Pharmacist’s note: {order.rxReviewNotes}</p>}
          <Link href="/account/prescriptions" className="mt-2 inline-block font-bold underline">
            Upload a new prescription
          </Link>
        </div>
      )}
      {order.status === "CONFIRMED" && order.prescriptionId && order.rxReviewNotes && (
        <p className="rounded-3xl bg-mint p-5 text-sm text-forest">Pharmacist’s note: {order.rxReviewNotes}</p>
      )}

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
          {progress.current >= 0 && (
            <section className={`${card} p-6 sm:p-7`}>
              <h2 className="mb-5 text-xl font-bold tracking-[-0.01em]">Order status</h2>
              <ol aria-label="Order progress" className="flex flex-col">
                {progress.steps.map((s, i) => {
                  const done = i < progress.current;
                  const now = i === progress.current;
                  const last = i === progress.steps.length - 1;
                  return (
                    <li key={s.key} className="flex gap-4" aria-current={now ? "step" : undefined}>
                      <div className="flex flex-col items-center">
                        {done ? (
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-white">
                            <CheckIcon size={14} strokeWidth={3} />
                          </span>
                        ) : (
                          <span
                            className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 ${now ? "border-brand" : "border-[#C9D8D5]"}`}
                          >
                            {now && <span className="size-2.5 rounded-full bg-brand" />}
                          </span>
                        )}
                        {!last && <span className={`min-h-7 w-0.5 flex-1 ${done ? "bg-brand" : "bg-line-strong"}`} />}
                      </div>
                      <div className={`flex flex-col gap-0.5 ${last ? "" : "pb-[22px]"}`}>
                        <strong className={`text-base ${now ? "text-brand-dark" : done ? "" : "text-muted"}`}>{s.label}</strong>
                        {i === 0 && <span className="text-sm text-muted">{formatOrderDate(order.createdAt)}</span>}
                        {now && i !== 0 && NOW[order.status] && <span className="text-sm text-muted">{NOW[order.status]}</span>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          <section className={`${card} flex flex-col gap-2 p-6 text-[15px]`}>
            <h2 className="mb-1 text-lg font-bold">Details</h2>
            {order.fulfilmentMode === "PICKUP" ? (
              <p>
                <span className="font-semibold">Store pickup</span>
                {order.pickupSlotStart && <> · {formatSlot(order.pickupSlotStart)}</>}
              </p>
            ) : (
              order.address && (
                <p>
                  <span className="font-semibold">Deliver to:</span> {order.address.line1}
                  {order.address.line2 && `, ${order.address.line2}`}, {order.address.city}, {order.address.state}{" "}
                  {order.address.pincode}
                </p>
              )
            )}
            <p>
              <span className="font-semibold">Payment:</span> {paymentLabel(payment)}
            </p>
          </section>
        </div>

        <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-5">
          <section className={`${card} flex flex-col gap-3.5 p-[22px]`}>
            <h2 className="text-lg font-bold">Items in this order</h2>
            <ul className="flex flex-col gap-3.5">
              {[...lines].map(([productId, l]) => (
                <li key={productId} className="flex items-center gap-3">
                  <ProductThumb id={productId} className="size-11 rounded-xl" />
                  <span className="flex min-w-0 flex-1 flex-col gap-px">
                    <strong className="text-sm">{l.name}</strong>
                    <span className="text-[13px] text-muted">
                      {l.quantity} × {formatPrice(l.unitPaise)}
                    </span>
                  </span>
                  <strong className="text-[15px]">{formatPrice(l.totalPaise)}</strong>
                </li>
              ))}
            </ul>
            <div className="h-px bg-line" />
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2">Items (incl. GST {formatPrice(order.gstPaise)})</dt>
                <dd>{formatPrice(order.subtotalPaise)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2">{order.fulfilmentMode === "PICKUP" ? "Pickup" : "Delivery"}</dt>
                <dd>{order.deliveryFeePaise === 0 ? "Free" : formatPrice(order.deliveryFeePaise)}</dd>
              </div>
            </dl>
            <div className="flex justify-between gap-3 text-base font-bold">
              <span>Total</span>
              <span>{formatPrice(order.totalPaise)}</span>
            </div>
          </section>

          <section className="flex flex-col gap-3 rounded-3xl bg-forest p-[22px] text-white">
            <strong className="text-[17px]">Questions about your medicines?</strong>
            <span className="text-sm leading-relaxed text-mist">
              Ask our pharmacist about dosage, timing or interactions.
            </span>
            {BUSINESS.phone ? (
              <a href={`tel:${BUSINESS.phone.replace(/[^\d+]/g, "")}`} className={`${btn("light", "sm")} self-start`}>
                <PhoneIcon size={18} />
                Call the pharmacy
              </a>
            ) : (
              <Link href="/grievance" className={`${btn("light", "sm")} self-start`}>
                Contact us
              </Link>
            )}
          </section>
        </aside>
      </div>

      <Link href="/account/orders" className="text-sm font-bold text-brand hover:text-brand-dark">
        ← All orders
      </Link>
    </section>
  );
}
