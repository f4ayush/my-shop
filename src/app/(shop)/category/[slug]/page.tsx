import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryPills } from "@/components/CategoryPills";
import { ListFilters, Pagination } from "@/components/ListControls";
import { ProductGrid } from "@/components/ProductCard";
import { pageTitle } from "@/components/ui";
import { getCategories, getCategoryBySlug, listProducts, parseListOptions, type RawSearchParams } from "@/lib/catalog";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = await getCategoryBySlug((await params).slug);
  return category ? { title: category.name } : {};
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const options = parseListOptions(sp);
  const [result, categories] = await Promise.all([listProducts({ categoryId: category.id }, options), getCategories()]);
  const basePath = `/category/${category.slug}`;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className={pageTitle}>{category.name}</h1>
        <span className="text-base text-muted">
          {result.total} {result.total === 1 ? "product" : "products"}
        </span>
      </div>
      <CategoryPills categories={categories} active={category.slug} mode="navigate" />
      <div>
        <ListFilters basePath={basePath} options={options} />
        {result.items.length > 0 ? (
          <ProductGrid products={result.items} />
        ) : (
          <p className="rounded-3xl border border-line bg-white p-6 text-muted">No products match these filters.</p>
        )}
        <Pagination basePath={basePath} options={options} pageCount={result.pageCount} />
      </div>
    </section>
  );
}
