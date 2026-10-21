import type { Metadata } from "next";
import { ListFilters, Pagination } from "@/components/ListControls";
import { ProductGrid } from "@/components/ProductCard";
import { listProducts, parseListOptions, parseQuery, searchWhere, type RawSearchParams } from "@/lib/catalog";

type Props = { searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = parseQuery(await searchParams);
  // Search result pages shouldn't be indexed; the catalogue is reached via category/product pages.
  return { title: q ? `Search: ${q}` : "All products", robots: { index: false } };
}

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = parseQuery(sp);
  const options = parseListOptions(sp);
  const result = await listProducts(q ? searchWhere(q) : {}, options);
  const keep: Record<string, string> = q ? { q } : {};

  return (
    <section>
      <h1 className="text-2xl font-bold">{q ? <>Results for “{q}”</> : "All products"}</h1>
      <p className="mb-4 text-sm text-slate-500">
        {result.total} {result.total === 1 ? "product" : "products"}
      </p>
      <ListFilters basePath="/search" options={options} keep={keep} />
      {result.items.length > 0 ? (
        <ProductGrid products={result.items} />
      ) : (
        <div className="rounded-lg bg-white p-6 text-slate-600 shadow-sm">
          <p>No products found{q && <> for “{q}”</>}.</p>
          <p className="mt-1 text-sm">Try the salt name (e.g. “metformin”) or a shorter search.</p>
        </div>
      )}
      <Pagination basePath="/search" options={options} keep={keep} pageCount={result.pageCount} />
    </section>
  );
}
