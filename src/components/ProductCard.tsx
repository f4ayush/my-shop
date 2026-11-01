import Link from "next/link";
import { getCartView, MAX_QTY_PER_ITEM } from "@/lib/cart";
import type { ProductCardData } from "@/lib/catalog";
import { discountPercent, formatPrice } from "@/lib/money";
import { artTone } from "@/lib/product-art";
import { AddToCartButton } from "./AddToCartButton";
import { CartStepper } from "./CartStepper";
import { ProductArt } from "./ProductArt";
import { RxBadge } from "./RxBadge";

export function ProductCard({ product: p, cartQty }: { product: ProductCardData; cartQty: number }) {
  const off = discountPercent(p.mrpPaise, p.pricePaise);
  const href = `/product/${p.slug}`;
  return (
    <li className="flex flex-col gap-2.5 rounded-[18px] border border-line bg-white p-2.5 sm:gap-4 sm:rounded-[22px] sm:p-3.5">
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden="true"
        className="relative flex h-[100px] items-center justify-center rounded-xl sm:h-[168px] sm:rounded-2xl"
        style={{ background: artTone(p.id).tint }}
      >
        {p.requiresRx && <RxBadge onArt className="absolute top-2 left-2 sm:top-3 sm:left-3" />}
        {off > 0 && (
          <span className="absolute top-3 right-3 rounded-full bg-ink px-2.5 py-1 text-xs leading-none font-bold text-white max-sm:hidden">
            {off}% off
          </span>
        )}
        <ProductArt id={p.id} packSize={p.packSize} />
      </Link>
      <div className="flex flex-col gap-0.5 px-0.5 sm:gap-1 sm:px-1">
        <Link href={href} className="text-sm leading-snug font-bold text-ink hover:text-brand sm:text-[17px] sm:tracking-[-0.01em]">
          {p.name}
        </Link>
        {p.packSize && <span className="text-xs text-muted sm:text-sm">{p.packSize}</span>}
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 px-0.5 pb-0.5 sm:gap-3 sm:px-1 sm:pb-1">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-extrabold sm:text-xl">{formatPrice(p.pricePaise)}</span>
          {off > 0 && (
            <span className="text-sm text-subtle line-through max-sm:hidden">
              <span className="sr-only">MRP </span>
              {formatPrice(p.mrpPaise)}
            </span>
          )}
        </div>
        {p.inStock && cartQty > 0 ? (
          <CartStepper productId={p.id} quantity={cartQty} max={MAX_QTY_PER_ITEM} label={p.name} />
        ) : (
          <AddToCartButton productId={p.id} label={p.name} disabled={!p.inStock} />
        )}
      </div>
    </li>
  );
}

/** Shows each product's cart quantity (the cart view is cached per request, so this is free). */
export async function ProductGrid({ products }: { products: ProductCardData[] }) {
  const cart = await getCartView();
  const inCart = new Map(cart.lines.map((l) => [l.productId, l.quantity]));
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))] sm:gap-5">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} cartQty={inCart.get(p.id) ?? 0} />
      ))}
    </ul>
  );
}
