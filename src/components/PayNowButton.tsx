"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { confirmPaymentAction, startPaymentAction } from "@/app/account/orders/payment-actions";

type RazorpayResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayInstance = { open(): void; on(event: string, cb: (r: { error?: { description?: string } }) => void): void };

declare global {
  interface Window {
    Razorpay?: new (options: object) => RazorpayInstance;
  }
}

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadCheckout(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const script = existing ?? Object.assign(document.createElement("script"), { src: SCRIPT_SRC, async: true });
    script.addEventListener("load", () => resolve(true), { once: true });
    script.addEventListener("error", () => resolve(false), { once: true });
    if (!existing) document.body.appendChild(script);
  });
}

export function PayNowButton({ orderNumber, autoOpen = false }: { orderNumber: string; autoOpen?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "starting" | "open" | "verifying">("idle");
  const [error, setError] = useState<string | null>(null);
  const opened = useRef(false);

  const pay = useCallback(async () => {
    setError(null);
    setState("starting");
    const session = await startPaymentAction(orderNumber);
    if (!session.ok) {
      setError(session.error);
      setState("idle");
      return;
    }
    if (!(await loadCheckout()) || !window.Razorpay) {
      setError("Couldn't load the payment window. Check your connection and try again.");
      setState("idle");
      return;
    }

    const rzp = new window.Razorpay({
      key: session.keyId,
      order_id: session.gatewayOrderId,
      amount: session.amountPaise,
      currency: "INR",
      name: "My Pharmacy",
      description: `Order ${orderNumber}`,
      prefill: { contact: session.contact },
      theme: { color: "#0f766e" },
      handler: async (res: RazorpayResponse) => {
        setState("verifying");
        const result = await confirmPaymentAction({ orderNumber, ...res });
        if (!result.ok) setError(result.error);
        setState("idle");
        router.replace(`/account/orders/${orderNumber}?placed=1`);
        router.refresh();
      },
      modal: { ondismiss: () => setState("idle") },
    });
    rzp.on("payment.failed", (r) => setError(r.error?.description ?? "Payment failed. You can try again."));
    setState("open");
    rzp.open();
  }, [orderNumber, router]);

  useEffect(() => {
    if (autoOpen && !opened.current) {
      opened.current = true;
      void pay();
    }
  }, [autoOpen, pay]);

  return (
    <div className="space-y-2">
      <button
        onClick={pay}
        disabled={state !== "idle"}
        className="rounded-md bg-brand px-5 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {state === "starting" ? "Opening payment…" : state === "verifying" ? "Confirming payment…" : "Pay now"}
      </button>
      {error && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}
