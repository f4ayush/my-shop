import Link from "next/link";
import { ProductGrid } from "@/components/ProductCard";
import { getCategories, listProducts } from "@/lib/catalog";

export default async function HomePage() {
  const [categories, featured] = await Promise.all([
    getCategories(),
    listProducts({}, { sort: "name", rx: "otc", page: 1 }),
  ]);

  return (
    <div className="space-y-10">
      <section className="rounded-xl bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold sm:text-3xl">Your neighbourhood pharmacy, online</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Order medicines and health essentials for store pickup or local delivery. Upload a prescription for
          prescription medicines — our pharmacist verifies every one before dispatch.
        </p>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Shop by category</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/category/${c.slug}`}
                className="block rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm hover:border-brand"
              >
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-slate-500">{c._count.products} products</div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">No prescription needed</h2>
          <Link href="/search?rx=otc" className="text-sm text-brand hover:underline">
            View all →
          </Link>
        </div>
        <ProductGrid products={featured.items.slice(0, 8)} />
      </section>
    </div>
  );
}
