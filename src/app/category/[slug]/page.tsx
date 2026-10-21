import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListFilters, Pagination } from "@/components/ListControls";
import { ProductGrid } from "@/components/ProductCard";
import { getCategoryBySlug, listProducts, parseListOptions, type RawSearchParams } from "@/lib/catalog";

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
  const result = await listProducts({ categoryId: category.id }, options);
  const basePath = `/category/${category.slug}`;

  return (
    <section>
      <h1 className="text-2xl font-bold">{category.name}</h1>
      <p className="mb-4 text-sm text-slate-500">
        {result.total} {result.total === 1 ? "product" : "products"}
      </p>
      <ListFilters basePath={basePath} options={options} />
      {result.items.length > 0 ? (
        <ProductGrid products={result.items} />
      ) : (
        <p className="text-slate-600">No products match these filters.</p>
      )}
      <Pagination basePath={basePath} options={options} pageCount={result.pageCount} />
    </section>
  );
}
