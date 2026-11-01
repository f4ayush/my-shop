import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { availableQty, firstParam, liveBatches, type RawSearchParams } from "@/lib/catalog";
import { formatPaise } from "@/lib/money";
import type { Prisma } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Products", robots: { index: false, follow: false } };

const FILTERS = {
  all: { label: "All", where: {} },
  active: { label: "On sale", where: { isActive: true } },
  drafts: { label: "Imported drafts", where: { isActive: false, category: { slug: "uncategorised" } } },
  hidden: { label: "Hidden", where: { isActive: false } },
} satisfies Record<string, { label: string; where: Prisma.ProductWhereInput }>;
type FilterKey = keyof typeof FILTERS;

export default async function ProductsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const q = (firstParam(sp.q) ?? "").trim().slice(0, 100);
  const statusParam = firstParam(sp.status);
  const status: FilterKey = statusParam && statusParam in FILTERS ? (statusParam as FilterKey) : "all";

  const where: Prisma.ProductWhereInput = {
    AND: [
      FILTERS[status].where,
      q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { sku: { contains: q, mode: "insensitive" } },
              { composition: { contains: q, mode: "insensitive" } },
            ],
          }
        : {},
    ],
  };
  const [products, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: [{ isActive: "asc" }, { name: "asc" }],
      take: 100,
      select: {
        id: true,
        sku: true,
        name: true,
        schedule: true,
        pricePaise: true,
        mrpPaise: true,
        isActive: true,
        category: { select: { name: true, slug: true } },
        batches: liveBatches(),
      },
    }),
    db.product.count({ where }),
  ]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">Products</h1>
        <Link href="/admin/products/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
          Add product
        </Link>
      </div>

      <form className="flex flex-wrap items-center gap-2" role="search">
        <input type="hidden" name="status" value={status} />
        <label htmlFor="product-q" className="sr-only">
          Search products
        </label>
        <input
          id="product-q"
          name="q"
          defaultValue={q}
          placeholder="Name, item code or salt"
          className="w-72 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:border-brand">Search</button>
        <nav aria-label="Filter" className="ml-auto flex flex-wrap gap-2">
          {(Object.keys(FILTERS) as FilterKey[]).map((f) => (
            <Link
              key={f}
              href={`/admin/products?status=${f}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              aria-current={f === status ? "true" : undefined}
              className={`rounded-full border px-3 py-1 text-sm ${f === status ? "border-brand bg-brand text-white" : "border-slate-300 bg-white"}`}
            >
              {FILTERS[f].label}
            </Link>
          ))}
        </nav>
      </form>

      <p className="text-sm text-slate-500">
        {total} item{total === 1 ? "" : "s"}
        {total > products.length && ` · showing first ${products.length}, search to narrow down`}
      </p>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500">
            <tr>
              <th className="p-3 font-normal">Item</th>
              <th className="p-3 font-normal">Category</th>
              <th className="p-3 font-normal">Schedule</th>
              <th className="p-3 text-right font-normal">Price</th>
              <th className="p-3 text-right font-normal">Sellable stock</th>
              <th className="p-3 font-normal">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map((p) => {
              const stock = availableQty(p.batches);
              return (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="p-3">
                    <Link href={`/admin/products/${p.id}`} className="font-medium hover:text-brand">
                      {p.name}
                    </Link>
                    <div className="text-xs text-slate-500">{p.sku}</div>
                  </td>
                  <td className="p-3">{p.category.name}</td>
                  <td className="p-3">{p.schedule}</td>
                  <td className="p-3 text-right">{formatPaise(p.pricePaise)}</td>
                  <td className={`p-3 text-right ${stock === 0 ? "text-red-700" : ""}`}>{stock}</td>
                  <td className="p-3">
                    {p.isActive ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">On sale</span>
                    ) : p.category.slug === "uncategorised" ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Draft — review</span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">Hidden</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
