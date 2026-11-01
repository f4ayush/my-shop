"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { addToCartAction, type AddToCartState } from "@/app/(checkout)/cart/actions";
import { CheckIcon, MinusIcon, PlusIcon } from "./icons";
import { btn } from "./ui";

type Props = {
  productId: string;
  /** Product name, for the accessible label. */
  label: string;
  disabled?: boolean;
  /** "card": compact "+ Add" (product cards). "full": quantity picker and a large button (product page). */
  variant?: "card" | "full";
  maxQuantity?: number;
};

export function AddToCartButton({ productId, label, disabled = false, variant = "card", maxQuantity = 10 }: Props) {
  const [state, action, pending] = useActionState<AddToCartState, FormData>(addToCartAction, { status: "idle" });

  if (variant === "card") {
    if (disabled) {
      return <span className="rounded-xl bg-field px-3 py-2.5 text-xs font-bold text-muted">Out of stock</span>;
    }
    // Once added, the page refreshes and the card shows the cart stepper instead.
    return (
      <form action={action} className="relative shrink-0">
        <input type="hidden" name="productId" value={productId} />
        <button
          disabled={pending}
          className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-brand text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-60 max-sm:w-11 sm:px-[18px]"
        >
          <PlusIcon size={16} strokeWidth={2.6} />
          <span className="max-sm:sr-only">{pending ? "Adding…" : "Add"}</span>
          <span className="sr-only"> {label} to cart</span>
        </button>
        {state.status === "error" && (
          <p role="alert" className="absolute top-full right-0 z-10 mt-1 w-44 text-right text-xs text-red-700">
            {state.message}
          </p>
        )}
      </form>
    );
  }

  if (disabled) {
    return (
      <button disabled className={btn("outline", "lg")}>
        Currently out of stock
      </button>
    );
  }
  return <FullAdd productId={productId} action={action} pending={pending} state={state} max={Math.max(1, maxQuantity)} />;
}

function FullAdd({
  productId,
  action,
  pending,
  state,
  max,
}: {
  productId: string;
  action: (formData: FormData) => void;
  pending: boolean;
  state: AddToCartState;
  max: number;
}) {
  const [qty, setQty] = useState(1);
  // "Added · Go to cart" shows after a successful add, until the quantity changes.
  const [submitted, setSubmitted] = useState(false);
  const added = submitted && !pending && state.status === "added";
  const change = (n: number) => {
    setQty(Math.min(max, Math.max(1, n)));
    setSubmitted(false);
  };
  const stepButton = "flex h-[54px] w-[52px] items-center justify-center rounded-2xl disabled:opacity-40";

  return (
    <form action={action} onSubmit={() => setSubmitted(true)} className="flex flex-wrap gap-3">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="quantity" value={qty} />
      <div className="flex h-14 items-center rounded-2xl border border-line-strong bg-white">
        <button type="button" onClick={() => change(qty - 1)} disabled={qty <= 1} aria-label="Decrease quantity" className={stepButton}>
          <MinusIcon size={18} strokeWidth={2.4} />
        </button>
        <span aria-live="polite" className="min-w-7 text-center text-[17px] font-extrabold">
          <span className="sr-only">Quantity </span>
          {qty}
        </span>
        <button type="button" onClick={() => change(qty + 1)} disabled={qty >= max} aria-label="Increase quantity" className={stepButton}>
          <PlusIcon size={18} strokeWidth={2.4} />
        </button>
      </div>
      {added ? (
        <Link href="/cart" className={`${btn("dark", "lg")} flex-[1_1_220px]`}>
          <CheckIcon size={18} strokeWidth={2.6} />
          Added · Go to cart
        </Link>
      ) : (
        <button disabled={pending} className={`${btn("primary", "lg")} flex-[1_1_220px]`}>
          {pending ? "Adding…" : "Add to cart"}
        </button>
      )}
      {state.status === "error" && (
        <p role="alert" className="basis-full text-sm text-red-700">
          {state.message}
        </p>
      )}
    </form>
  );
}
