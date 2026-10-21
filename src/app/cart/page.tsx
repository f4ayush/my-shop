import type { Metadata } from "next";
import Link from "next/link";
import { RxBadge } from "@/components/RxBadge";
import { getCurrentUser } from "@/lib/auth/session";
import { getCartView, MAX_QTY_PER_ITEM, type CartLine } from "@/lib/cart";
import { formatPaise } from "@/lib/money";
import { updateCartAction } from "./actions";

export const metadata: Metadata = { title: "Cart", robots: { index: false } };

const ISSUE_TEXT: Record<NonNullable<CartLine["issue"]>, (l: CartLine) => string> = {
  unavailable: () => "No longer available — please remove it.",
  out_of_stock: () => "Out of stock — please remove it.",
  insufficient_stock: (l) => `Only ${l.stockQty} in stock — please reduce the quantity.`,
};

export default async function CartPage() {
  const [cart, user] = await Promise.all([getCartView(), getCurrentUser()]);

  if (cart.lines.length === 0) {
    return (
      <section className="rounded-xl bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold">Your cart is empty</h1>
        <Link href="/search" className="mt-4 inline-block text-brand hover:underline">
          Browse products
        </Link>
      </section>
    );
  }

  const canCheckout = !cart.hasIssues;
  const checkoutHref = user ? "/checkout" : "/login?next=%2Fcheckout";

  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <h1 className="mb-4 text-2xl font-bold">Cart ({cart.itemCount})</h1>
        <ul className="divide-y divide-slate-200 rounded-xl bg-white shadow-sm">
          {cart.lines.map((l) => (
            <li key={l.productId} className="flex flex-wrap items-start gap-4 p-4">
              <div className="min-w-0 flex-1">
                <Link href={`/product/${l.slug}`} className="font-medium hover:text-brand">
                  {l.name}
                </Link>
                {l.packSize && <div className="text-xs text-slate-500">{l.packSize}</div>}
                <div className="mt-1 text-sm">{formatPaise(l.pricePaise)} each</div>
                {l.requiresRx && (
                  <div className="mt-1">
                    <RxBadge />
                  </div>
                )}
                {l.issue && <p className="mt-1 text-sm text-red-700">{ISSUE_TEXT[l.issue](l)}</p>}
              </div>
              <form action={updateCartAction} className="flex items-center gap-2">
                <input type="hidden" name="productId" value={l.productId} />
                <label htmlFor={`qty-${l.productId}`} className="sr-only">
                  Quantity for {l.name}
                </label>
                <input
                  id={`qty-${l.productId}`}
                  name="quantity"
                  type="number"
                  min={1}
                  max={MAX_QTY_PER_ITEM}
                  defaultValue={l.quantity}
                  className="w-16 rounded-md border border-slate-300 px-2 py-1"
                />
                <button className="text-sm text-brand hover:underline">Update</button>
              </form>
              <form action={updateCartAction}>
                <input type="hidden" name="productId" value={l.productId} />
                <input type="hidden" name="quantity" value="0" />
                <button className="text-sm text-slate-500 hover:text-red-700 hover:underline">Remove</button>
              </form>
              <div className="w-24 text-right font-semibold">{formatPaise(l.lineTotalPaise)}</div>
            </li>
          ))}
        </ul>
      </div>

      <aside className="h-fit rounded-xl bg-white p-5 shadow-sm">
        <div className="flex justify-between text-lg font-semibold">
          <span>Subtotal</span>
          <span>{formatPaise(cart.subtotalPaise)}</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">Inclusive of GST. Delivery fee, if any, is added at checkout.</p>

        {cart.hasRxItems && (
          <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            Your cart has prescription medicines. You’ll upload your prescription at checkout, and our pharmacist
            will verify it before your order is packed.
          </p>
        )}

        {canCheckout ? (
          <Link
            href={checkoutHref}
            className="mt-4 block rounded-md bg-brand px-4 py-2 text-center font-medium text-white hover:bg-brand-dark"
          >
            {user ? "Proceed to checkout" : "Log in to check out"}
          </Link>
        ) : (
          <button disabled className="mt-4 w-full rounded-md bg-slate-200 px-4 py-2 font-medium text-slate-500">
            Proceed to checkout
          </button>
        )}
      </aside>
    </section>
  );
}
