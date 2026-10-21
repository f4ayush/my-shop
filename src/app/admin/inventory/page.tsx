import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { firstParam, type RawSearchParams } from "@/lib/catalog";
import { HEADER_ALIASES, REQUIRED, type Field } from "@/lib/inventory-import";
import type { ImportSummary } from "@/lib/inventory-sync";
import { formatPaise } from "@/lib/money";
import { formatOrderDate } from "@/lib/orders";
import { maskPhone } from "@/lib/phone";
import { applyImportAction, discardImportAction, uploadStockFileAction } from "./actions";

export const metadata: Metadata = { title: "Inventory", robots: { index: false, follow: false } };

const FIELD_LABEL: Record<Field, string> = {
  sku: "Item code",
  name: "Item name",
  batch: "Batch",
  expiry: "Expiry",
  quantity: "Quantity",
  mrp: "MRP",
  price: "Selling rate",
  hsn: "HSN",
  gst: "GST %",
  manufacturer: "Manufacturer",
  pack: "Pack",
};

function Issues({ title, items, total, tone }: { title: string; items: { line: number; message: string }[]; total: number; tone: "red" | "amber" }) {
  if (total === 0) return null;
  return (
    <details open={tone === "red"} className={`rounded-md p-3 text-sm ${tone === "red" ? "bg-red-50 text-red-900" : "bg-amber-50 text-amber-900"}`}>
      <summary className="cursor-pointer font-medium">
        {title} ({total})
      </summary>
      <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto">
        {items.map((i) => (
          <li key={`${i.line}-${i.message}`}>
            Line {i.line}: {i.message}
          </li>
        ))}
        {total > items.length && <li>…and {total - items.length} more</li>}
      </ul>
    </details>
  );
}

export default async function InventoryPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  await requireStaff();
  const sp = await searchParams;
  const previewId = firstParam(sp.preview);
  const appliedId = firstParam(sp.applied);
  const error = firstParam(sp.error);

  const [preview, applied, history, draftCount] = await Promise.all([
    previewId ? db.inventoryImport.findFirst({ where: { id: previewId, status: "PREVIEW" } }) : null,
    appliedId ? db.inventoryImport.findFirst({ where: { id: appliedId, status: "APPLIED" } }) : null,
    db.inventoryImport.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, fileName: true, status: true, createdAt: true, appliedAt: true, createdById: true, summary: true, fullSnapshot: true },
    }),
    db.product.count({ where: { isActive: false, category: { slug: "uncategorised" } } }),
  ]);
  const people = new Map(
    (await db.user.findMany({ where: { id: { in: history.map((h) => h.createdById) } }, select: { id: true, name: true, phone: true } })).map(
      (u) => [u.id, u.name ?? maskPhone(u.phone)],
    ),
  );
  const ps = preview?.summary as ImportSummary | undefined;
  const as = applied?.summary as ImportSummary | undefined;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">Inventory sync</h1>
        <Link href="/admin/orders" className="text-sm text-brand hover:underline">
          Orders →
        </Link>
      </div>

      {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-900">{error}</p>}

      {as?.applied && (
        <div role="status" className="rounded-md bg-green-50 p-4 text-sm text-green-900">
          <p className="font-medium">Import applied.</p>
          <p>
            {as.applied.batchesUpserted} batches updated · {as.applied.productsUpdated} items updated ·{" "}
            {as.applied.productsCreated} new draft item{as.applied.productsCreated === 1 ? "" : "s"}
            {applied?.fullSnapshot && ` · ${as.applied.batchesZeroed} batches set to zero`}
            {as.applied.pricesCappedToMrp > 0 && ` · ${as.applied.pricesCappedToMrp} prices lowered to the new MRP`}
          </p>
        </div>
      )}

      {preview && ps ? (
        <div className="space-y-4 rounded-xl bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold">Preview: {preview.fileName}</h2>
            <p className="text-sm text-slate-600">
              {ps.validRows} of {ps.totalLines} rows are ready to import. Nothing has changed yet.
            </p>
          </div>
          <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <li className="rounded-md bg-slate-50 p-3">
              <div className="text-2xl font-bold">{ps.validRows}</div>
              batches to update
            </li>
            <li className="rounded-md bg-slate-50 p-3">
              <div className="text-2xl font-bold">{ps.newSkuCount}</div>
              new items (added hidden, for review)
            </li>
            <li className="rounded-md bg-slate-50 p-3">
              <div className="text-2xl font-bold">{ps.priceChangeCount}</div>
              price changes
            </li>
            <li className="rounded-md bg-slate-50 p-3">
              <div className="text-2xl font-bold">{preview.fullSnapshot ? ps.batchesToZero : "—"}</div>
              {preview.fullSnapshot ? "batches not in file → set to 0" : "other batches left unchanged"}
            </li>
          </ul>

          <Issues title="Rows that will be skipped" items={ps.errors} total={ps.errorCount} tone="red" />
          <Issues title="Warnings" items={ps.warnings} total={ps.warningCount} tone="amber" />

          {ps.priceChangeCount > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium">Price changes ({ps.priceChangeCount})</summary>
              <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto">
                {ps.priceChanges.map((c) => (
                  <li key={c.sku}>
                    {c.sku}: {formatPaise(c.fromPaise)} → {formatPaise(c.toPaise)}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {ps.newSkuCount > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium">New items ({ps.newSkuCount})</summary>
              <p className="mt-1 text-slate-600">
                Added as hidden, prescription-only drafts. Check their schedule, category and GST before putting them on sale.
              </p>
              <p className="mt-1 break-words">{ps.newSkus.join(", ")}</p>
            </details>
          )}

          <div className="flex flex-wrap gap-3">
            <form action={applyImportAction}>
              <input type="hidden" name="importId" value={preview.id} />
              <button className="rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark">
                Apply {ps.validRows} rows
              </button>
            </form>
            <form action={discardImportAction}>
              <input type="hidden" name="importId" value={preview.id} />
              <button className="rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50">Discard</button>
            </form>
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-1 text-lg font-semibold">Upload a stock file</h2>
          <p className="mb-4 text-sm text-slate-600">
            Export the stock / batch-wise closing stock report from your billing software as CSV and upload it here.
            You’ll see a preview before anything changes.{" "}
            <a href="/admin/inventory/template" className="text-brand hover:underline">
              Download template
            </a>
          </p>
          <form action={uploadStockFileAction} className="space-y-3">
            <input
              name="file"
              type="file"
              required
              accept=".csv,text/csv"
              aria-label="Stock CSV file"
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2"
            />
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="fullSnapshot" className="mt-0.5" />
              <span>
                This file is the <strong>complete</strong> stock list — set any batch not in it to zero.
                <span className="block text-xs text-slate-500">Leave unticked for partial files (e.g. one supplier).</span>
              </span>
            </label>
            <button className="rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark">Upload and preview</button>
          </form>

          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-slate-700">Recognised column names</summary>
            <table className="mt-2 w-full text-xs">
              <tbody>
                {(Object.keys(HEADER_ALIASES) as Field[]).map((f) => (
                  <tr key={f} className="border-b border-slate-100">
                    <td className="py-1 pr-3 font-medium">
                      {FIELD_LABEL[f]}
                      {REQUIRED.includes(f) && " *"}
                    </td>
                    <td className="py-1 text-slate-600">{HEADER_ALIASES[f].join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-xs text-slate-500">
              * required. Expiry can be DD/MM/YYYY, YYYY-MM-DD or MM/YYYY. Prices in rupees, including GST.
            </p>
          </details>
        </div>
      )}

      {draftCount > 0 && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          {draftCount} imported item{draftCount === 1 ? " is" : "s are"} hidden as {draftCount === 1 ? "a draft" : "drafts"}{" "}
          awaiting review (schedule, category, GST). Product editing arrives with the admin dashboard.
        </p>
      )}

      <div>
        <h2 className="mb-2 text-lg font-semibold">Import history</h2>
        {history.length === 0 ? (
          <p className="text-sm text-slate-600">No imports yet.</p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-xl bg-white text-sm shadow-sm">
            {history.map((h) => {
              const s = h.summary as unknown as ImportSummary;
              return (
                <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <span>
                    <span className="font-medium">{h.fileName}</span>
                    <span className="block text-xs text-slate-500">
                      {formatOrderDate(h.createdAt)} · {people.get(h.createdById) ?? "staff"}
                      {h.fullSnapshot && " · full stock list"}
                    </span>
                  </span>
                  <span className="text-xs">
                    {s.validRows} rows{s.errorCount > 0 && `, ${s.errorCount} skipped`} ·{" "}
                    <span className={h.status === "APPLIED" ? "font-medium text-green-700" : "text-slate-500"}>
                      {h.status === "APPLIED" ? "Applied" : h.status === "PREVIEW" ? "Not applied" : h.status === "DISCARDED" ? "Discarded" : h.status}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
