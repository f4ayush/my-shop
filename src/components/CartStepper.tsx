"use client";

import { useFormStatus } from "react-dom";
import { updateCartAction } from "@/app/(checkout)/cart/actions";
import { MinusIcon, PlusIcon } from "./icons";

type Props = {
  productId: string;
  quantity: number;
  max: number;
  /** Product name, for the buttons' accessible labels. */
  label: string;
  /** "mint" on product cards, "outline" in the cart. */
  tone?: "mint" | "outline";
};

/** − qty + for a product already in the cart. Going below 1 removes it. Works without JavaScript. */
export function CartStepper({ productId, quantity, max, label, tone = "mint" }: Props) {
  return (
    <form
      action={updateCartAction}
      className={`flex h-11 shrink-0 items-center rounded-xl ${tone === "mint" ? "bg-mint text-brand-dark" : "border border-line-strong text-ink"}`}
    >
      <input type="hidden" name="productId" value={productId} />
      <StepperButtons quantity={quantity} max={max} label={label} />
    </form>
  );
}

function StepperButtons({ quantity, max, label }: Omit<Props, "productId" | "tone">) {
  const { pending } = useFormStatus();
  const button =
    "flex h-11 w-9 items-center justify-center rounded-xl disabled:opacity-40 sm:w-11 enabled:hover:bg-black/5";
  return (
    <>
      <button
        name="quantity"
        value={quantity - 1}
        disabled={pending}
        aria-label={quantity === 1 ? `Remove ${label} from cart` : `Remove one ${label}`}
        className={button}
      >
        <MinusIcon size={16} strokeWidth={2.6} />
      </button>
      <span className={`min-w-5 text-center text-[15px] font-extrabold ${pending ? "opacity-50" : ""}`}>
        {quantity}
        <span className="sr-only"> in cart</span>
      </span>
      <button
        name="quantity"
        value={quantity + 1}
        disabled={pending || quantity >= max}
        aria-label={`Add one more ${label}`}
        className={button}
      >
        <PlusIcon size={16} strokeWidth={2.6} />
      </button>
    </>
  );
}
