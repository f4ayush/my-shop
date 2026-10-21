import type { Metadata } from "next";
import Link from "next/link";
import { PrescriptionUploadForm } from "@/components/PrescriptionUploadForm";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { formatOrderDate } from "@/lib/orders";
import { RX_STATUS_LABEL, RX_STATUS_STYLE } from "@/lib/rx/labels";

export const metadata: Metadata = { title: "My prescriptions", robots: { index: false } };

export default async function PrescriptionsPage() {
  const user = await requireUser("/account/prescriptions");
  const prescriptions = await db.prescription.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, status: true, createdAt: true, doctorName: true, expiresAt: true },
  });

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">My prescriptions</h1>
        <Link href="/account/orders" className="text-sm text-brand hover:underline">
          My orders →
        </Link>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Upload a prescription</h2>
        <PrescriptionUploadForm />
      </div>

      {prescriptions.length > 0 && (
        <ul className="divide-y divide-slate-200 rounded-xl bg-white shadow-sm">
          {prescriptions.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
              <div>
                <div className="font-medium">Uploaded {formatOrderDate(p.createdAt)}</div>
                {p.doctorName && <div className="text-slate-500">Dr. {p.doctorName}</div>}
                {p.expiresAt && (
                  <div className="text-xs text-slate-500">Valid until {p.expiresAt.toLocaleDateString("en-IN", { timeZone: "UTC" })}</div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RX_STATUS_STYLE[p.status]}`}>
                  {RX_STATUS_LABEL[p.status]}
                </span>
                <a href={`/api/prescriptions/${p.id}/file`} target="_blank" rel="noopener" className="text-brand hover:underline">
                  View
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
