import Link from "next/link";
import type { ProductCardData } from "@/lib/catalog";
import { discountPercent, formatPaise } from "@/lib/money";
import { AddToCartButton } from "./AddToCartButton";
import { RxBadge } from "./RxBadge";

export function ProductCard({ product: p }: { product: ProductCardData }) {
  const off = discountPercent(p.mrpPaise, p.pricePaise);
  return (
    <li className="flex flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <Link href={`/category/${p.category.slug}`} className="text-xs uppercase text-slate-500 hover:underline">
        {p.category.name}
      </Link>
      <Link href={`/product/${p.slug}`} className="mt-1 font-semibold hover:text-brand">
        {p.name}
      </Link>
      {p.composition && <div className="text-sm text-slate-600">{p.composition}</div>}
      {p.packSize && <div className="text-xs text-slate-500">{p.packSize}</div>}
      <div className="mt-auto pt-3">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold">{formatPaise(p.pricePaise)}</span>
          {off > 0 && (
            <>
              <span className="text-sm text-slate-400 line-through">{formatPaise(p.mrpPaise)}</span>
              <span className="text-xs font-medium text-green-700">{off}% off</span>
            </>
          )}
        </div>
        {p.requiresRx && (
          <div className="mt-2">
            <RxBadge />
          </div>
        )}
        <div className="mt-3">
          <AddToCartButton productId={p.id} disabled={!p.inStock} />
        </div>
      </div>
    </li>
  );
}

export function ProductGrid({ products }: { products: ProductCardData[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </ul>
  );
}
