import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRightIcon } from "@/components/icons";
import { OrderAgainButton } from "@/components/OrderAgainButton";
import { btn, card, pageTitle } from "@/components/ui";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { formatPrice } from "@/lib/money";
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
    <section className="flex flex-col gap-6">
      <h1 className={pageTitle}>My orders</h1>
      {orders.length === 0 ? (
        <div className={`${card} flex flex-col items-start gap-3 p-6`}>
          <p className="text-muted">No orders yet.</p>
          <Link href="/search" className={btn("primary")}>
            Start shopping
          </Link>
        </div>
      ) : (
        <ul className={`${card} px-4 sm:px-6`}>
          {orders.map((o) => (
            <li key={o.orderNumber} className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-line py-4 first:border-t-0">
              <Link
                href={`/account/orders/${o.orderNumber}`}
                className="flex min-w-0 flex-[1_1_260px] items-center justify-between gap-3 text-ink hover:text-ink"
              >
                <span className="flex flex-col gap-0.5">
                  <strong className="text-base">{o.orderNumber}</strong>
                  <span className="text-[13px] text-muted">
                    {formatOrderDate(o.createdAt)} · {o.fulfilmentMode === "PICKUP" ? "Store pickup" : "Delivery"}
                  </span>
                </span>
                <span className="flex items-center gap-2 text-right">
                  <span className="flex flex-col gap-0.5">
                    <strong>{formatPrice(o.totalPaise)}</strong>
                    <span className="text-[13px] text-ink-2">{ORDER_STATUS_LABEL[o.status]}</span>
                  </span>
                  <ChevronRightIcon size={18} className="text-muted" />
                </span>
              </Link>
              <OrderAgainButton orderNumber={o.orderNumber} className={`${btn("outline", "sm")} max-sm:w-full`} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
