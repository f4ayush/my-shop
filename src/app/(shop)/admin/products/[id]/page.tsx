import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { firstParam, type RawSearchParams } from "@/lib/catalog";
import { formatOrderDate } from "@/lib/orders";
import { maskPhone } from "@/lib/phone";
import { ProductForm } from "../ProductForm";

export const metadata: Metadata = { title: "Edit product", robots: { index: false, follow: false } };

const rupees = (paise: number) => (paise / 100).toFixed(2);

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { id } = await params;
  const saved = firstParam((await searchParams).saved) === "1";
  const [product, categories, history] = await Promise.all([
    db.product.findUnique({
      where: { id },
      include: { category: { select: { slug: true } }, batches: { orderBy: { expiryDate: "asc" } } },
    }),
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.auditLog.findMany({
      where: { entityType: "Product", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, action: true, createdAt: true, metadata: true, actor: { select: { name: true, phone: true } } },
    }),
  ]);
  if (!product) notFound();
  const now = new Date();

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">{product.name}</h1>
        <div className="flex gap-4 text-sm">
          {product.isActive && (
            <Link href={`/product/${product.slug}`} className="text-brand hover:underline">
              View in shop
            </Link>
          )}
          <Link href="/admin/products" className="text-brand hover:underline">
            ← All products
          </Link>
        </div>
      </div>

      {saved && <p role="status" className="rounded-md bg-green-50 p-3 text-sm text-green-900">Saved.</p>}
      {!product.isActive && product.category.slug === "uncategorised" && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          Imported draft. Check the name, schedule, category and GST (drafts default to Schedule H and 12%), then tick “On
          sale”.
        </p>
      )}

      <ProductForm
        categories={categories}
        values={{
          id: product.id,
          sku: product.sku,
          name: product.name,
          slug: product.slug,
          composition: product.composition ?? "",
          manufacturer: product.manufacturer ?? "",
          packSize: product.packSize ?? "",
          description: product.description ?? "",
          categoryId: product.categoryId,
          schedule: product.schedule,
          mrp: rupees(product.mrpPaise),
          price: rupees(product.pricePaise),
          hsnCode: product.hsnCode ?? "",
          gstRate: String(Number(product.gstRate)),
          isActive: product.isActive,
        }}
      />

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-2 font-semibold">Stock by batch</h2>
        <p className="mb-2 text-xs text-slate-500">Stock comes from the billing software via Stock sync.</p>
        {product.batches.length === 0 ? (
          <p className="text-sm text-slate-500">No batches yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-1 font-normal">Batch</th>
                <th className="py-1 font-normal">Expiry</th>
                <th className="py-1 text-right font-normal">Quantity</th>
                <th className="py-1 text-right font-normal">Held for orders</th>
                <th className="py-1 text-right font-normal">Last synced</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {product.batches.map((b) => (
                <tr key={b.id} className={b.expiryDate <= now ? "text-red-700" : ""}>
                  <td className="py-1">{b.batchNo}</td>
                  <td className="py-1">
                    {b.expiryDate.toLocaleDateString("en-IN", { timeZone: "UTC" })}
                    {b.expiryDate <= now && " (expired)"}
                  </td>
                  <td className="py-1 text-right">{b.quantity}</td>
                  <td className="py-1 text-right">{b.reserved}</td>
                  <td className="py-1 text-right text-xs text-slate-500">{formatOrderDate(b.syncedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {history.length > 0 && (
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-2 font-semibold">Change history</h2>
          <ul className="space-y-2 text-sm">
            {history.map((h) => (
              <li key={h.id}>
                <span className="text-slate-500">{formatOrderDate(h.createdAt)}</span> ·{" "}
                {h.actor ? (h.actor.name ?? maskPhone(h.actor.phone)) : "system"} ·{" "}
                {h.action === "product.create"
                  ? "created"
                  : Object.keys((h.metadata as Record<string, unknown>) ?? {}).join(", ") || "updated"}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
