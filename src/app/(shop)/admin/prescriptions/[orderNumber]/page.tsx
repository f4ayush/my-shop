import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { formatPaise } from "@/lib/money";
import { formatOrderDate, ORDER_STATUS_LABEL } from "@/lib/orders";
import { RX_STATUS_LABEL, RX_STATUS_STYLE } from "@/lib/rx/labels";
import { todayIst } from "@/lib/store";
import { OrderStatus } from "@/generated/prisma/enums";
import { ReviewForms } from "../ReviewForms";

export const metadata: Metadata = { title: "Review prescription", robots: { index: false, follow: false } };

const isoDay = (d: Date | null | undefined) => d?.toISOString().slice(0, 10);

export default async function ReviewPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  await requireStaff();
  const { orderNumber } = await params;

  const order = await db.order.findUnique({
    where: { orderNumber },
    include: {
      user: { select: { phone: true, name: true } },
      items: { orderBy: { id: "asc" }, include: { product: { select: { schedule: true, composition: true, requiresRx: true } } } },
      prescription: { include: { reviewedBy: { select: { name: true, phone: true } } } },
    },
  });
  if (!order?.prescription) notFound();
  const rx = order.prescription;
  const fileUrl = `/api/prescriptions/${rx.id}/file`;
  const hasH1 = order.items.some((i) => i.product.schedule === "H1");
  const awaiting = order.status === OrderStatus.AWAITING_RX_REVIEW;

  return (
    <section className="space-y-6">
      <Link href="/admin/prescriptions" className="text-sm text-brand hover:underline">
        ← Back to queue
      </Link>

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">Order {order.orderNumber}</h1>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm">{ORDER_STATUS_LABEL[order.status]}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 text-sm">
            <span>
              Prescription · uploaded {formatOrderDate(rx.createdAt)}{" "}
              <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-medium ${RX_STATUS_STYLE[rx.status]}`}>
                {RX_STATUS_LABEL[rx.status]}
              </span>
            </span>
            <a href={fileUrl} target="_blank" rel="noopener" className="text-brand hover:underline">
              Open full size
            </a>
          </div>
          {rx.mimeType === "application/pdf" ? (
            <iframe src={fileUrl} title="Prescription" className="h-[70vh] w-full" />
          ) : (
            <img src={fileUrl} alt="Uploaded prescription" className="max-h-[70vh] w-full object-contain" />
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl bg-white p-4 text-sm shadow-sm">
            <h2 className="mb-2 font-semibold">Customer</h2>
            <p>
              {order.user.name ?? "—"} · {order.user.phone}
            </p>
            <p className="text-slate-500">
              {order.fulfilmentMode === "PICKUP" ? "Store pickup" : "Home delivery"} · placed {formatOrderDate(order.createdAt)}
            </p>
          </div>

          <div className="rounded-xl bg-white p-4 text-sm shadow-sm">
            <h2 className="mb-2 font-semibold">Items</h2>
            <ul className="space-y-2">
              {order.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-2">
                  <span>
                    {i.productName} × {i.quantity}
                    {i.product.composition && <span className="block text-xs text-slate-500">{i.product.composition}</span>}
                  </span>
                  <span className="shrink-0 text-xs font-medium">
                    {i.product.schedule === "OTC" ? "OTC" : `Sch. ${i.product.schedule}`}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-slate-200 pt-2 text-right font-semibold">{formatPaise(order.totalPaise)}</p>
          </div>

          {hasH1 && (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-900">
              Contains a Schedule H1 drug: record the sale in the H1 register (patient, prescriber, drug, quantity).
            </p>
          )}

          {rx.status === "APPROVED" && rx.reviewedAt && (
            <p className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
              Previously verified {formatOrderDate(rx.reviewedAt)}
              {rx.reviewedBy && ` by ${rx.reviewedBy.name ?? rx.reviewedBy.phone}`}. Check it covers these medicines.
            </p>
          )}
        </aside>
      </div>

      {awaiting ? (
        <ReviewForms
          orderId={order.id}
          today={todayIst()}
          defaults={{ doctorName: rx.doctorName ?? undefined, issuedOn: isoDay(rx.issuedOn), expiresAt: isoDay(rx.expiresAt) }}
        />
      ) : (
        <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-600">
          This order has already been reviewed{order.rxReviewNotes && <>: “{order.rxReviewNotes}”</>}.
        </p>
      )}
    </section>
  );
}
