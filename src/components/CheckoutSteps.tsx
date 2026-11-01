"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckIcon } from "./icons";

const STEPS = ["Prescription", "Delivery", "Payment"];

/** Cart → Prescription → Delivery → Payment. Steps 2–4 all happen on /checkout. */
export function CheckoutSteps() {
  const onCheckout = usePathname().startsWith("/checkout");
  const pill = "flex items-center gap-2 rounded-full px-3.5 py-2";
  const on = `${pill} bg-ink text-white`;
  const off = `${pill} bg-field text-ink-2`;
  return (
    <ol aria-label="Checkout steps" className="flex flex-wrap items-center gap-2 text-sm font-semibold max-sm:hidden">
      <li aria-current={onCheckout ? undefined : "step"}>
        {onCheckout ? (
          <Link href="/cart" className={`${pill} bg-mint text-brand-dark hover:text-brand-dark`}>
            <CheckIcon size={14} strokeWidth={3} />1 · Cart
          </Link>
        ) : (
          <span className={on}>1 · Cart</span>
        )}
      </li>
      {STEPS.map((label, i) => (
        <li key={label} aria-current={onCheckout ? "step" : undefined} className={onCheckout ? on : off}>
          {i + 2} · {label}
        </li>
      ))}
    </ol>
  );
}
