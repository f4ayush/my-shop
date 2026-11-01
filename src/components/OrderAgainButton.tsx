"use client";

import { useFormStatus } from "react-dom";
import { orderAgainAction } from "@/app/(checkout)/cart/actions";
import { RefreshIcon } from "./icons";

/** Adds a past order's products back to the cart, then opens the cart. */
export function OrderAgainButton({ orderNumber, className }: { orderNumber: string; className: string }) {
  return (
    <form action={orderAgainAction}>
      <input type="hidden" name="orderNumber" value={orderNumber} />
      <SubmitButton className={className} />
    </form>
  );
}

function SubmitButton({ className }: { className: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={className}>
      <RefreshIcon size={18} />
      {pending ? "Adding to cart…" : "Order again"}
    </button>
  );
}
