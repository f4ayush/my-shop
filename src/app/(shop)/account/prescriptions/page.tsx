import type { Metadata } from "next";
import Link from "next/link";
import { FileIcon } from "@/components/icons";
import { PrescriptionUploadForm } from "@/components/PrescriptionUploadForm";
import { card, pageTitle } from "@/components/ui";
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
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className={pageTitle}>My prescriptions</h1>
        <Link href="/account/orders" className="text-sm font-bold text-brand hover:text-brand-dark">
          My orders →
        </Link>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <div className={`${card} flex min-w-0 flex-[1_1_380px] flex-col gap-4 p-5 sm:p-6`}>
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-bold">Upload a prescription</h2>
            <p className="text-sm text-muted">It stays on file — choose it at checkout for any order that needs it.</p>
          </div>
          <PrescriptionUploadForm />
        </div>

        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-3">
          <h2 className="text-lg font-bold">On file</h2>
          {prescriptions.length > 0 ? (
            <ul className={`${card} px-4 sm:px-5`}>
              {prescriptions.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 border-t border-line py-4 text-sm first:border-t-0">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-tint text-amber-ink">
                    <FileIcon />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">Uploaded {formatOrderDate(p.createdAt)}</div>
                    {p.doctorName && <div className="text-muted">Dr. {p.doctorName}</div>}
                    {p.expiresAt && (
                      <div className="text-xs text-muted">
                        Valid until {p.expiresAt.toLocaleDateString("en-IN", { timeZone: "UTC" })}
                      </div>
                    )}
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${RX_STATUS_STYLE[p.status]}`}>
                    {RX_STATUS_LABEL[p.status]}
                  </span>
                  <a
                    href={`/api/prescriptions/${p.id}/file`}
                    target="_blank"
                    rel="noopener"
                    className="font-bold text-brand hover:underline"
                  >
                    View
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className={`${card} p-5 text-sm text-muted`}>No prescriptions uploaded yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}
