import type { Metadata } from "next";
import Link from "next/link";
import { CartStepper } from "@/components/CartStepper";
import { ChatIcon, CheckIcon, FileIcon, PinIcon, TrashIcon } from "@/components/icons";
import { ProductThumb } from "@/components/ProductArt";
import { RxBadge } from "@/components/RxBadge";
import { btn, card, pageTitle } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/session";
import { getCartView, MAX_QTY_PER_ITEM, type CartLine } from "@/lib/cart";
import { firstParam, type RawSearchParams } from "@/lib/catalog";
import { formatPrice } from "@/lib/money";
import { orderMessage, whatsappOrders, whatsappUrl } from "@/lib/whatsapp";
import { updateCartAction } from "./actions";

export const metadata: Metadata = { title: "Cart", robots: { index: false } };

const ISSUE_TEXT: Record<NonNullable<CartLine["issue"]>, (l: CartLine) => string> = {
  unavailable: () => "No longer available — please remove it.",
  out_of_stock: () => "Out of stock — please remove it.",
  insufficient_stock: (l) => `Only ${l.stockQty} in stock — please reduce the quantity.`,
};

/** Counts from "Order again" (?added=&skipped=), if present and sane. */
function reorderNote(sp: RawSearchParams): { added: number; skipped: number } | null {
  const added = Number(firstParam(sp.added));
  const skipped = Number(firstParam(sp.skipped));
  if (!Number.isInteger(added) || !Number.isInteger(skipped) || added < 0 || skipped < 0 || added + skipped > 100) return null;
  return { added, skipped };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default async function CartPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const [cart, user, sp] = await Promise.all([getCartView(), getCurrentUser(), searchParams]);
  const reorder = reorderNote(sp);
  const note = reorder && (
    <p role="status" className="flex items-start gap-2.5 rounded-2xl bg-mint px-4 py-3 text-sm font-semibold text-forest">
      <CheckIcon size={18} strokeWidth={2.6} className="mt-0.5 flex-none" />
      <span>
        {reorder.added > 0 ? `Added ${plural(reorder.added, "product", "products")} from your past order.` : "Nothing could be added."}
        {reorder.skipped > 0 &&
          ` ${plural(reorder.skipped, "product is", "products are")} no longer available or out of stock, so we skipped ${reorder.skipped === 1 ? "it" : "them"}.`}
      </span>
    </p>
  );

  if (cart.lines.length === 0) {
    return (
      <section className="mx-auto flex max-w-xl flex-col gap-4">
        {note}
        <div className={`${card} flex flex-col items-center gap-3 p-10 text-center`}>
          <h1 className="text-2xl font-extrabold tracking-[-0.02em]">Your cart is empty</h1>
          <Link href="/search" className={`${btn("primary")} mt-2`}>
            Browse medicines
          </Link>
        </div>
      </section>
    );
  }

  const live = cart.lines.filter((l) => !l.issue);
  const mrpTotal = live.reduce((n, l) => n + l.mrpPaise * l.quantity, 0);
  const saved = mrpTotal - cart.subtotalPaise;
  const rxCount = cart.lines.filter((l) => l.requiresRx).length;
  const canCheckout = !cart.hasIssues;
  const checkoutLabel = whatsappOrders ? "Order on WhatsApp" : "Proceed to checkout";
  const totalLabel = whatsappOrders ? "Estimated total" : "To pay";
  const checkout = () =>
    !canCheckout ? (
      <button disabled className={btn("outline", "lg")}>
        {checkoutLabel}
      </button>
    ) : whatsappOrders ? (
      <a href={whatsappUrl(orderMessage(cart))} target="_blank" rel="noopener noreferrer" className={btn("primary", "lg")}>
        <ChatIcon size={20} />
        {checkoutLabel}
      </a>
    ) : (
      <Link href={user ? "/checkout" : "/login?next=%2Fcheckout"} className={btn("primary", "lg")}>
        {user ? checkoutLabel : "Log in to check out"}
      </Link>
    );

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className={pageTitle}>Your cart</h1>
        <span className="text-base text-muted">{plural(cart.itemCount, "item", "items")}</span>
      </div>
      {note}

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
          <ul className={`${card} px-4 py-1 sm:px-6 sm:py-2`}>
            {cart.lines.map((l) => (
              <li key={l.productId} className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-line py-4 first:border-t-0 sm:py-[18px]">
                <ProductThumb id={l.productId} className="size-14 rounded-[14px] sm:size-[72px] sm:rounded-2xl" />
                <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-1">
                  <Link href={`/product/${l.slug}`} className="font-bold text-ink hover:text-brand sm:text-base">
                    {l.name}
                  </Link>
                  {l.packSize && <span className="text-sm text-muted">{l.packSize}</span>}
                  {l.requiresRx && <RxBadge className="mt-0.5 self-start" />}
                  {l.issue && <p className="text-sm font-medium text-red-700">{ISSUE_TEXT[l.issue](l)}</p>}
                </div>
                <div className="flex items-center gap-3 max-sm:w-full max-sm:justify-between sm:gap-4">
                  <CartStepper
                    productId={l.productId}
                    quantity={l.quantity}
                    max={Math.max(1, Math.min(MAX_QTY_PER_ITEM, l.stockQty))}
                    label={l.name}
                    tone="outline"
                  />
                  <strong className="min-w-[72px] text-right text-[17px]">{formatPrice(l.lineTotalPaise)}</strong>
                  <form action={updateCartAction}>
                    <input type="hidden" name="productId" value={l.productId} />
                    <input type="hidden" name="quantity" value="0" />
                    <button
                      aria-label={`Remove ${l.name}`}
                      className="flex size-11 items-center justify-center rounded-xl text-muted hover:bg-red-50 hover:text-red-700"
                    >
                      <TrashIcon />
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>

          {rxCount > 0 && (
            <section className={`${card} flex items-start gap-3 p-5 sm:p-6`}>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-tint text-amber-ink">
                <FileIcon />
              </span>
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-bold">Prescription needed</h2>
                <p className="text-sm text-muted">
                  {plural(rxCount, "item", "items")} in your cart {rxCount === 1 ? "needs" : "need"} a valid prescription.
                  {whatsappOrders
                    ? " Send a clear photo of it in the WhatsApp chat with your order."
                    : " You’ll upload one, or choose one you’ve already uploaded, at checkout."}{" "}
                  Our pharmacist verifies it before your order is packed.
                </p>
              </div>
            </section>
          )}

          <section className={`${card} flex items-start gap-3 p-5 sm:p-6`}>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-mint text-brand-dark">
              <PinIcon />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-bold">Pickup or delivery</h2>
              <p className="text-sm text-muted">
                {whatsappOrders
                  ? "Tell us in the chat whether you’ll pick up from the store (free) or want home delivery. Delivery fees depend on your area."
                  : "Choose free store pickup or home delivery at checkout. Delivery fees depend on your area."}
              </p>
            </div>
          </section>
        </div>

        <aside className={`${card} flex min-w-0 flex-[1_1_340px] flex-col gap-4 p-6`}>
          <h2 className="text-xl font-bold tracking-[-0.01em]">Order summary</h2>
          <dl className="flex flex-col gap-3 text-[15px]">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-2">Item total (MRP)</dt>
              <dd className="font-semibold">{formatPrice(mrpTotal)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-2">Discount</dt>
              <dd className="font-semibold text-brand-dark">−{formatPrice(saved)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-2">Delivery</dt>
              <dd className="font-semibold">{whatsappOrders ? "Confirmed on WhatsApp" : "At checkout"}</dd>
            </div>
          </dl>
          <div className="h-px bg-line" />
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-base font-bold">{totalLabel}</span>
            <span className="text-3xl font-extrabold tracking-[-0.02em]">{formatPrice(cart.subtotalPaise)}</span>
          </div>
          {saved > 0 && (
            <span className="rounded-xl bg-mint px-3.5 py-2.5 text-sm font-semibold text-forest">
              You save {formatPrice(saved)} on this order
            </span>
          )}
          {checkout()}
          {!canCheckout && (
            <span className="text-center text-[13px] text-muted">Remove or update the items marked above to continue</span>
          )}
          <p className="text-xs leading-relaxed text-muted">
            Prices include GST.
            {whatsappOrders
              ? " We confirm the final amount in the chat before packing. Prescription items are packed only after our pharmacist approves your prescription."
              : rxCount > 0 &&
                " Prescription items are packed only after our pharmacist approves your prescription; if it isn’t accepted, any online payment is refunded."}
          </p>
        </aside>
      </div>

      {/* Phones: the total and checkout button stay on screen. */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-line bg-white px-4 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] sm:hidden">
        <div className="flex flex-col">
          <span className="text-xs text-muted">{totalLabel}</span>
          <strong className="text-xl">{formatPrice(cart.subtotalPaise)}</strong>
        </div>
        <div className="flex-1">{checkout()}</div>
      </div>
    </section>
  );
}
