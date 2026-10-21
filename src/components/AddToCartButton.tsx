"use client";

import Link from "next/link";
import { useActionState } from "react";
import { addToCartAction, type AddToCartState } from "@/app/cart/actions";

type Props = {
  productId: string;
  disabled?: boolean;
  /** Show a quantity picker (product page) or just a button (cards). */
  withQuantity?: boolean;
  maxQuantity?: number;
};

export function AddToCartButton({ productId, disabled = false, withQuantity = false, maxQuantity = 10 }: Props) {
  const [state, action, pending] = useActionState<AddToCartState, FormData>(addToCartAction, { status: "idle" });

  if (disabled) {
    return (
      <button disabled className="rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-500">
        Out of stock
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="productId" value={productId} />
      {withQuantity && (
        <>
          <label htmlFor={`qty-${productId}`} className="sr-only">
            Quantity
          </label>
          <select
            id={`qty-${productId}`}
            name="quantity"
            defaultValue="1"
            className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
          >
            {Array.from({ length: Math.max(1, maxQuantity) }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </>
      )}
      <button
        disabled={pending}
        className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add to cart"}
      </button>
      <span aria-live="polite" className="text-sm">
        {state.status === "added" && (
          <span className="text-green-700">
            ✓ {state.message} ·{" "}
            <Link href="/cart" className="underline">
              View cart
            </Link>
          </span>
        )}
        {state.status === "error" && <span className="text-red-700">{state.message}</span>}
      </span>
    </form>
  );
}
