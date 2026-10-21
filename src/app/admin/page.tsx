import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { formatPaise } from "@/lib/money";
import { formatOrderDate } from "@/lib/orders";
import { expireUnpaidOrders } from "@/lib/payments/online";
import { todayIst } from "@/lib/store";
import { OrderStatus, PaymentStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false } };

const LOW_STOCK_UNITS = 10;
const NEAR_EXPIRY_DAYS = 90;
const NOT_SALES: OrderStatus[] = [OrderStatus.PAYMENT_PENDING, OrderStatus.CANCELLED, OrderStatus.RX_REJECTED];

type LowStockRow = { id: string; name: string; sku: string; available: number };

function Stat({ label, value, href, tone = "slate" }: { label: string; value: string | number; href?: string; tone?: "slate" | "amber" | "red" }) {
  const colours = { slate: "bg-white", amber: "bg-amber-50 text-amber-950", red: "bg-red-50 text-red-950" };
  const body = (
    <>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm">{label}</div>
    </>
  );
  const cls = `block rounded-xl p-4 shadow-sm ${colours[tone]}`;
  return href ? (
    <Link href={href} className={`${cls} hover:ring-2 hover:ring-brand/30`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export default async function DashboardPage() {
  await expireUnpaidOrders();
  const now = new Date();
  const dayStart = new Date(`${todayIst(now)}T00:00:00+05:30`);
  const expirySoon = new Date(now.getTime() + NEAR_EXPIRY_DAYS * 24 * 60 * 60_000);

  const [todayOrders, toConfirm, awaitingRx, inProgress, refunds, failedMessages, drafts, lowStock, nearExpiry, expiredOnShelf, lastImport] =
    await Promise.all([
      db.order.aggregate({
        where: { createdAt: { gte: dayStart }, status: { notIn: NOT_SALES } },
        _count: true,
        _sum: { totalPaise: true },
      }),
      db.order.count({ where: { status: OrderStatus.PLACED } }),
      db.order.count({ where: { status: OrderStatus.AWAITING_RX_REVIEW } }),
      db.order.count({
        where: { status: { in: [OrderStatus.CONFIRMED, OrderStatus.PACKED, OrderStatus.READY_FOR_PICKUP, OrderStatus.OUT_FOR_DELIVERY] } },
      }),
      db.payment.count({
        where: {
          status: PaymentStatus.CAPTURED,
          gateway: { not: null },
          order: { status: { in: [OrderStatus.CANCELLED, OrderStatus.RX_REJECTED] } },
        },
      }),
      db.notification.count({ where: { status: "failed", createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60_000) } } }),
      db.product.count({ where: { isActive: false, category: { slug: "uncategorised" } } }),
      // Sellable stock = unexpired quantity minus units held for open orders.
      db.$queryRaw<LowStockRow[]>`
        SELECT p.id, p.name, p.sku,
          COALESCE(SUM(GREATEST(b.quantity - b.reserved, 0)) FILTER (WHERE b."expiryDate" > ${now}), 0)::int AS available
        FROM "Product" p LEFT JOIN "InventoryBatch" b ON b."productId" = p.id
        WHERE p."isActive" = true AND p.schedule <> 'X'
        GROUP BY p.id
        HAVING COALESCE(SUM(GREATEST(b.quantity - b.reserved, 0)) FILTER (WHERE b."expiryDate" > ${now}), 0) < ${LOW_STOCK_UNITS}
        ORDER BY available ASC, p.name ASC
        LIMIT 20`,
      db.inventoryBatch.findMany({
        where: { quantity: { gt: 0 }, expiryDate: { gt: now, lte: expirySoon } },
        orderBy: { expiryDate: "asc" },
        take: 20,
        select: { id: true, batchNo: true, expiryDate: true, quantity: true, product: { select: { id: true, name: true } } },
      }),
      db.inventoryBatch.aggregate({ where: { quantity: { gt: 0 }, expiryDate: { lte: now } }, _count: true, _sum: { quantity: true } }),
      db.inventoryImport.findFirst({ where: { status: "APPLIED" }, orderBy: { appliedAt: "desc" }, select: { appliedAt: true } }),
    ]);

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-slate-500">
          Stock last synced: {lastImport?.appliedAt ? formatOrderDate(lastImport.appliedAt) : "never"} ·{" "}
          <Link href="/admin/inventory" className="text-brand hover:underline">
            Sync now
          </Link>
        </p>
      </div>

      <div>
        <h2 className="mb-3 font-semibold">Today</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="orders today" value={todayOrders._count} />
          <Stat label="order value today" value={formatPaise(todayOrders._sum.totalPaise ?? 0)} />
          <Stat label="being prepared or on the way" value={inProgress} href="/admin/orders?tab=preparing" />
        </div>
      </div>

      <div>
        <h2 className="mb-3 font-semibold">Needs action</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="orders to confirm" value={toConfirm} href="/admin/orders?tab=new" tone={toConfirm ? "amber" : "slate"} />
          <Stat label="prescriptions to check" value={awaitingRx} href="/admin/prescriptions" tone={awaitingRx ? "amber" : "slate"} />
          <Stat label="refunds needing attention" value={refunds} href="/admin/prescriptions" tone={refunds ? "red" : "slate"} />
          <Stat label="draft items to review" value={drafts} href="/admin/products?status=drafts" tone={drafts ? "amber" : "slate"} />
          {failedMessages > 0 && <Stat label="SMS failed (7 days)" value={failedMessages} tone="red" />}
        </div>
      </div>

      {(expiredOnShelf._count ?? 0) > 0 && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-900">
          {expiredOnShelf._count} expired batch{expiredOnShelf._count === 1 ? "" : "es"} ({expiredOnShelf._sum.quantity} units) still {expiredOnShelf._count === 1 ? "shows" : "show"} stock.
          They aren’t sold online — remove them from the shelf and update the billing software.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-semibold">Low stock (under {LOW_STOCK_UNITS} sellable units)</h2>
          {lowStock.length === 0 ? (
            <p className="text-sm text-slate-500">All active items are well stocked.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {lowStock.map((p) => (
                <li key={p.id} className="flex justify-between gap-2 py-1.5">
                  <Link href={`/admin/products/${p.id}`} className="hover:text-brand">
                    {p.name} <span className="text-xs text-slate-500">{p.sku}</span>
                  </Link>
                  <span className={p.available === 0 ? "font-semibold text-red-700" : "font-medium"}>{p.available}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-semibold">Expiring within {NEAR_EXPIRY_DAYS} days</h2>
          {nearExpiry.length === 0 ? (
            <p className="text-sm text-slate-500">No stocked batches expire soon.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {nearExpiry.map((b) => (
                <li key={b.id} className="flex justify-between gap-2 py-1.5">
                  <Link href={`/admin/products/${b.product.id}`} className="hover:text-brand">
                    {b.product.name} <span className="text-xs text-slate-500">batch {b.batchNo}</span>
                  </Link>
                  <span className="shrink-0">
                    {b.quantity} · {b.expiryDate.toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
