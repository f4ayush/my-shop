import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { formatPaise } from "@/lib/money";
import { formatOrderDate, ORDER_STATUS_LABEL } from "@/lib/orders";

export const metadata: Metadata = { title: "My orders", robots: { index: false } };

export default async function OrdersPage() {
  const user = await requireUser("/account/orders");
  const orders = await db.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      orderNumber: true,
      status: true,
      totalPaise: true,
      createdAt: true,
      fulfilmentMode: true,
      _count: { select: { items: true } },
    },
  });

  return (
    <section>
      <h1 className="mb-4 text-2xl font-bold">My orders</h1>
      {orders.length === 0 ? (
        <p className="text-slate-600">
          No orders yet.{" "}
          <Link href="/search" className="text-brand hover:underline">
            Start shopping
          </Link>
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-xl bg-white shadow-sm">
          {orders.map((o) => (
            <li key={o.orderNumber}>
              <Link
                href={`/account/orders/${o.orderNumber}`}
                className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-slate-50"
              >
                <div>
                  <div className="font-medium">{o.orderNumber}</div>
                  <div className="text-xs text-slate-500">
                    {formatOrderDate(o.createdAt)} · {o.fulfilmentMode === "PICKUP" ? "Store pickup" : "Delivery"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatPaise(o.totalPaise)}</div>
                  <div className="text-xs text-slate-600">{ORDER_STATUS_LABEL[o.status]}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
