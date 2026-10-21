import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/AddToCartButton";
import { ProductGrid } from "@/components/ProductCard";
import { MAX_QTY_PER_ITEM } from "@/lib/cart";
import { RxBadge } from "@/components/RxBadge";
import { getAlternatives, getProductBySlug } from "@/lib/catalog";
import { discountPercent, formatPaise } from "@/lib/money";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  if (!product) return {};
  return {
    title: product.name,
    description: [product.composition, product.packSize, product.manufacturer].filter(Boolean).join(" · "),
  };
}

export default async function ProductPage({ params }: Props) {
  const product = await getProductBySlug((await params).slug);
  if (!product) notFound();

  const alternatives = await getAlternatives(product.id, product.composition);
  const off = discountPercent(product.mrpPaise, product.pricePaise);
  const inStock = product.availableQty > 0;

  return (
    <div className="space-y-10">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <Link href="/" className="hover:underline">
          Home
        </Link>
        {" / "}
        <Link href={`/category/${product.category.slug}`} className="hover:underline">
          {product.category.name}
        </Link>
      </nav>

      <article className="rounded-xl bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold">{product.name}</h1>
        {product.composition && (
          <p className="mt-1 text-slate-700">
            <span className="text-slate-500">Salt: </span>
            <Link href={`/search?q=${encodeURIComponent(product.composition)}`} className="hover:underline">
              {product.composition}
            </Link>
          </p>
        )}
        <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm text-slate-600 sm:grid-cols-[auto_1fr]">
          {product.manufacturer && (
            <>
              <dt className="text-slate-500">Manufacturer</dt>
              <dd>{product.manufacturer}</dd>
            </>
          )}
          {product.packSize && (
            <>
              <dt className="text-slate-500">Pack size</dt>
              <dd>{product.packSize}</dd>
            </>
          )}
        </dl>

        <div className="mt-6 flex flex-wrap items-baseline gap-3">
          <span className="text-3xl font-bold">{formatPaise(product.pricePaise)}</span>
          {off > 0 && (
            <>
              <span className="text-slate-400 line-through">MRP {formatPaise(product.mrpPaise)}</span>
              <span className="font-medium text-green-700">{off}% off</span>
            </>
          )}
        </div>
        <p className="text-xs text-slate-500">Inclusive of all taxes</p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {inStock ? (
            <span className="text-sm font-medium text-green-700">In stock</span>
          ) : (
            <span className="text-sm font-medium text-slate-600">Currently out of stock</span>
          )}
          {product.requiresRx && <RxBadge />}
        </div>

        <div className="mt-4">
          <AddToCartButton
            productId={product.id}
            disabled={!inStock}
            withQuantity
            maxQuantity={Math.min(MAX_QTY_PER_ITEM, product.availableQty)}
          />
        </div>

        {product.requiresRx && (
          <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            This medicine is dispensed only against a valid prescription. You’ll be asked to upload it at checkout,
            and our pharmacist will verify it before your order is packed.
          </p>
        )}

        {product.description && <p className="mt-6 whitespace-pre-line text-slate-700">{product.description}</p>}
      </article>

      {alternatives.length > 0 && (
        <section>
          <h2 className="mb-1 text-xl font-semibold">Same salt, other brands</h2>
          <p className="mb-4 text-sm text-slate-500">
            Contain {product.composition}. Ask your doctor or our pharmacist before switching brands.
          </p>
          <ProductGrid products={alternatives} />
        </section>
      )}
    </div>
  );
}
