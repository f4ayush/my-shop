import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { firstParam, type RawSearchParams } from "@/lib/catalog";
import { formatPaise } from "@/lib/money";
import { staffActions } from "@/lib/order-flow";
import { formatOrderDate, ORDER_STATUS_LABEL, paymentLabel } from "@/lib/orders";
import { expireUnpaidOrders } from "@/lib/payments/online";
import { formatSlot } from "@/lib/store";
import { OrderStatus } from "@/generated/prisma/enums";
import { transitionAction } from "./actions";

export const metadata: Metadata = { title: "Orders", robots: { index: false, follow: false } };

const TABS = {
  new: { label: "To confirm", statuses: [OrderStatus.PLACED] },
  preparing: { label: "Preparing", statuses: [OrderStatus.CONFIRMED, OrderStatus.PACKED] },
  handover: { label: "Pickup / delivery", statuses: [OrderStatus.READY_FOR_PICKUP, OrderStatus.OUT_FOR_DELIVERY] },
  done: { label: "Completed", statuses: [OrderStatus.COMPLETED] },
  cancelled: { label: "Cancelled", statuses: [OrderStatus.CANCELLED, OrderStatus.RX_REJECTED] },
} as const;
type TabKey = keyof typeof TABS;
const ACTIVE: TabKey[] = ["new", "preparing", "handover"];

export default async function OrdersBoardPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  await requireStaff();
  await expireUnpaidOrders();
  const sp = await searchParams;
  const tabParam = firstParam(sp.tab);
  const tab: TabKey = tabParam && tabParam in TABS ? (tabParam as TabKey) : "new";
  const done = firstParam(sp.done);
  const error = firstParam(sp.error);
  const finished = tab === "done" || tab === "cancelled";

  const [counts, orders] = await Promise.all([
    db.order.groupBy({ by: ["status"], _count: true, where: { status: { in: ACTIVE.flatMap((t) => [...TABS[t].statuses]) } } }),
    db.order.findMany({
      where: { status: { in: [...TABS[tab].statuses] } },
      // Active work oldest-first (pickups by slot); history newest-first.
      orderBy: finished ? [{ updatedAt: "desc" }] : [{ pickupSlotStart: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      take: finished ? 50 : 200,
      include: {
        user: { select: { phone: true, name: true } },
        address: { select: { line1: true, line2: true, city: true, pincode: true } },
        items: { select: { productName: true, quantity: true, productId: true } },
        payments: { orderBy: { createdAt: "desc" }, take: 1, select: { method: true, status: true } },
      },
    }),
  ]);
  const countFor = (t: TabKey) =>
    counts.filter((c) => (TABS[t].statuses as readonly string[]).includes(c.status)).reduce((n, c) => n + c._count, 0);

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">Orders</h1>
        <Link href="/admin/prescriptions" className="text-sm text-brand hover:underline">
          Prescription queue →
        </Link>
      </div>

      <nav aria-label="Order stages" className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(TABS) as TabKey[]).map((t) => (
          <Link
            key={t}
            href={`/admin/orders?tab=${t}`}
            aria-current={t === tab ? "page" : undefined}
            className={`rounded-full border px-3 py-1 text-sm ${t === tab ? "border-brand bg-brand text-white" : "border-slate-300 bg-white hover:border-brand"}`}
          >
            {TABS[t].label}
            {ACTIVE.includes(t) && countFor(t) > 0 && ` (${countFor(t)})`}
          </Link>
        ))}
      </nav>

      {done && <p role="status" className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-900">{done}</p>}
      {error && <p role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-900">{error}</p>}

      {orders.length === 0 ? (
        <p className="rounded-xl bg-white p-6 text-slate-600 shadow-sm">No orders here.</p>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const actions = staffActions(o.status, o.fulfilmentMode);
            return (
              <li key={o.id} className="rounded-xl bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">
                      {o.orderNumber}{" "}
                      <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal">
                        {ORDER_STATUS_LABEL[o.status]}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      Placed {formatOrderDate(o.createdAt)} · {o.user.name ?? "Customer"} · {o.user.phone}
                    </div>
                    <div className="mt-1 text-sm">
                      {o.fulfilmentMode === "PICKUP" ? (
                        <>
                          <span className="font-medium">Pickup</span>
                          {o.pickupSlotStart && <> · {formatSlot(o.pickupSlotStart)}</>}
                        </>
                      ) : (
                        <>
                          <span className="font-medium">Delivery</span>
                          {o.address && (
                            <>
                              {" "}
                              · {o.address.line1}
                              {o.address.line2 && `, ${o.address.line2}`}, {o.address.city} {o.address.pincode}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-semibold">{formatPaise(o.totalPaise)}</div>
                    <div className="text-xs text-slate-600">{paymentLabel(o.payments[0])}</div>
                  </div>
                </div>

                <ul className="mt-2 text-sm text-slate-700">
                  {Object.values(
                    o.items.reduce<Record<string, { name: string; qty: number }>>((acc, i) => {
                      (acc[i.productId] ??= { name: i.productName, qty: 0 }).qty += i.quantity;
                      return acc;
                    }, {}),
                  ).map((i) => (
                    <li key={i.name}>
                      {i.qty} × {i.name}
                    </li>
                  ))}
                </ul>
                {o.cancelReason && <p className="mt-2 text-sm text-red-800">Cancelled: {o.cancelReason}</p>}

                {actions.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-start gap-2 border-t border-slate-100 pt-3">
                    {actions
                      .filter((a) => !a.danger)
                      .map((a) => (
                        <form key={a.to} action={transitionAction}>
                          <input type="hidden" name="orderId" value={o.id} />
                          <input type="hidden" name="to" value={a.to} />
                          <input type="hidden" name="tab" value={tab} />
                          <button className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark">
                            {a.label}
                          </button>
                        </form>
                      ))}
                    {actions
                      .filter((a) => a.danger)
                      .map((a) => (
                        <details key={a.to} className="text-sm">
                          <summary className="cursor-pointer rounded-md border border-red-200 px-3 py-1.5 text-red-800 hover:bg-red-50">
                            {a.label}
                          </summary>
                          <form action={transitionAction} className="mt-2 flex flex-wrap gap-2">
                            <input type="hidden" name="orderId" value={o.id} />
                            <input type="hidden" name="to" value={a.to} />
                            <input type="hidden" name="tab" value={tab} />
                            <label htmlFor={`reason-${o.id}`} className="sr-only">
                              Reason for cancelling
                            </label>
                            <input
                              id={`reason-${o.id}`}
                              name="reason"
                              required
                              minLength={3}
                              maxLength={300}
                              placeholder="Reason (shown to the customer)"
                              className="w-64 rounded-md border border-slate-300 px-2 py-1"
                            />
                            <button className="rounded-md bg-red-700 px-3 py-1 font-medium text-white hover:bg-red-800">
                              Confirm cancel
                            </button>
                          </form>
                        </details>
                      ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
