import type { Metadata } from "next";
import { CategoryPills } from "@/components/CategoryPills";
import { ListFilters, Pagination } from "@/components/ListControls";
import { ProductGrid } from "@/components/ProductCard";
import { pageTitle } from "@/components/ui";
import { getCategories, listProducts, parseListOptions, parseQuery, searchWhere, type RawSearchParams } from "@/lib/catalog";

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
  const [result, categories] = await Promise.all([listProducts(q ? searchWhere(q) : {}, options), getCategories()]);
  const keep: Record<string, string> = q ? { q } : {};

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className={pageTitle}>{q ? <>Results for “{q}”</> : "All products"}</h1>
        <span className="text-base text-muted">
          {result.total} {result.total === 1 ? "product" : "products"}
        </span>
      </div>
      {!q && <CategoryPills categories={categories} active={null} mode="navigate" />}
      <div>
        <ListFilters basePath="/search" options={options} keep={keep} />
        {result.items.length > 0 ? (
          <ProductGrid products={result.items} />
        ) : (
          <div className="rounded-3xl border border-line bg-white p-6 text-muted">
            <p className="font-semibold text-ink">No products found{q && <> for “{q}”</>}.</p>
            <p className="mt-1 text-sm">Try the salt name (e.g. “metformin”) or a shorter search.</p>
          </div>
        )}
        <Pagination basePath="/search" options={options} keep={keep} pageCount={result.pageCount} />
      </div>
    </section>
  );
}
