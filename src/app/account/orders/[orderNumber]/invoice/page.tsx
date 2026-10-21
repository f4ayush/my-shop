import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { db } from "@/lib/db";
import { isStaff, requireUser } from "@/lib/auth/session";
import { BUSINESS, missingInvoiceDetails } from "@/lib/business";
import { ensureInvoice, invoiceEligible } from "@/lib/invoice";
import { splitInclusiveGst } from "@/lib/invoice-math";
import { formatPaise } from "@/lib/money";
import { formatOrderDate, paymentLabel } from "@/lib/orders";
import { maskPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Tax invoice", robots: { index: false } };

const rupees = (paise: number) => formatPaise(paise).replace("₹", "");

export default async function InvoicePage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const user = await requireUser(`/account/orders/${encodeURIComponent(orderNumber)}/invoice`);

  const order = await db.order.findFirst({
    // Customers see their own invoices; staff can open any.
    where: isStaff(user) ? { orderNumber } : { orderNumber, userId: user.id },
    include: {
      items: { orderBy: { id: "asc" } },
      address: true,
      payments: { orderBy: { createdAt: "desc" } },
      user: { select: { name: true, phone: true } },
    },
  });
  if (!order || !invoiceEligible(order)) notFound();
  const invoice = await ensureInvoice(order.id);

  const rows = order.items.map((i) => ({ ...i, rate: Number(i.gstRate), ...splitInclusiveGst(i.lineTotalPaise, Number(i.gstRate)) }));
  const sum = (k: "taxablePaise" | "cgstPaise" | "sgstPaise") => rows.reduce((n, r) => n + r[k], 0);

  return (
    <article className="mx-auto max-w-3xl space-y-6 rounded-xl bg-white p-6 text-sm shadow-sm print:max-w-none print:p-0 print:shadow-none">
      {missingInvoiceDetails.length > 0 && (
        <p className="rounded-md bg-red-50 p-3 text-red-900 print:hidden">
          Business details missing ({missingInvoiceDetails.join(", ")}). Set them in the environment before issuing
          real invoices.
        </p>
      )}

      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold">Tax Invoice</h1>
          <p className="font-semibold">{BUSINESS.legalName}</p>
          {BUSINESS.address && <p className="whitespace-pre-line text-slate-600">{BUSINESS.address}</p>}
          <p className="text-slate-600">GSTIN: {BUSINESS.gstin ?? "—"}</p>
          <p className="text-slate-600">Drug licence: {BUSINESS.drugLicence ?? "—"}</p>
        </div>
        <dl className="grid grid-cols-[auto_auto] gap-x-3 text-right">
          <dt className="text-slate-500">Invoice no.</dt>
          <dd className="font-semibold">{invoice.number}</dd>
          <dt className="text-slate-500">Date</dt>
          <dd>{formatOrderDate(invoice.issuedAt)}</dd>
          <dt className="text-slate-500">Order</dt>
          <dd>{order.orderNumber}</dd>
          <dt className="text-slate-500">Place of supply</dt>
          <dd>{BUSINESS.state ?? "—"}</dd>
        </dl>
      </header>

      <section>
        <h2 className="mb-1 font-semibold">Billed to</h2>
        <p>{order.user.name ?? "Customer"} · {maskPhone(order.user.phone)}</p>
        {order.address && (
          <p className="text-slate-600">
            {order.address.line1}
            {order.address.line2 && `, ${order.address.line2}`}, {order.address.city}, {order.address.state}{" "}
            {order.address.pincode}
          </p>
        )}
      </section>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-y border-slate-300 text-left">
            <th className="py-2 pr-2">Item</th>
            <th className="py-2 pr-2">HSN</th>
            <th className="py-2 pr-2 text-right">Qty</th>
            <th className="py-2 pr-2 text-right">Taxable (₹)</th>
            <th className="py-2 pr-2 text-right">CGST</th>
            <th className="py-2 pr-2 text-right">SGST</th>
            <th className="py-2 text-right">Total (₹)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-slate-100">
              <td className="py-2 pr-2">{r.productName}</td>
              <td className="py-2 pr-2">{r.hsnCode ?? "—"}</td>
              <td className="py-2 pr-2 text-right">{r.quantity}</td>
              <td className="py-2 pr-2 text-right">{rupees(r.taxablePaise)}</td>
              <td className="py-2 pr-2 text-right">
                {rupees(r.cgstPaise)} <span className="text-slate-400">@{r.rate / 2}%</span>
              </td>
              <td className="py-2 pr-2 text-right">
                {rupees(r.sgstPaise)} <span className="text-slate-400">@{r.rate / 2}%</span>
              </td>
              <td className="py-2 text-right">{rupees(r.lineTotalPaise)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="text-right">
          <tr className="border-t border-slate-300 font-medium">
            <td colSpan={3} className="py-2 pr-2 text-left">
              Items total
            </td>
            <td className="py-2 pr-2">{rupees(sum("taxablePaise"))}</td>
            <td className="py-2 pr-2">{rupees(sum("cgstPaise"))}</td>
            <td className="py-2 pr-2">{rupees(sum("sgstPaise"))}</td>
            <td className="py-2">{rupees(order.subtotalPaise)}</td>
          </tr>
          {order.deliveryFeePaise > 0 && (
            <tr>
              <td colSpan={6} className="py-1 pr-2 text-left">
                Delivery charge
              </td>
              <td className="py-1">{rupees(order.deliveryFeePaise)}</td>
            </tr>
          )}
          <tr className="text-sm font-bold">
            <td colSpan={6} className="py-2 pr-2 text-left">
              Amount
            </td>
            <td className="py-2">{formatPaise(order.totalPaise)}</td>
          </tr>
        </tfoot>
      </table>

      <footer className="space-y-1 border-t border-slate-200 pt-4 text-xs text-slate-600">
        <p>Payment: {paymentLabel(order.payments[0])}</p>
        {BUSINESS.pharmacist && <p>Registered pharmacist: {BUSINESS.pharmacist}</p>}
        <p>This is a computer-generated invoice.</p>
      </footer>

      <div className="flex gap-4 print:hidden">
        <PrintButton />
        <Link href={`/account/orders/${order.orderNumber}`} className="self-center text-brand hover:underline">
          Back to order
        </Link>
      </div>
    </article>
  );
}
