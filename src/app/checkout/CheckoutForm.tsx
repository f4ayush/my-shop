"use client";

import { useActionState, useState } from "react";
import { formatPaise } from "@/lib/money";
import { addAddressAction, placeOrderAction, type FormState } from "./actions";

export type AddressOption = { id: string; summary: string; deliveryFeePaise: number | null };
export type SlotOption = { value: string; label: string };

export type PrescriptionOption = { id: string; label: string; status: string };

type Props = {
  subtotalPaise: number;
  addresses: AddressOption[];
  slots: SlotOption[];
  /** Names of cart items that need a prescription (empty when none do). */
  rxItems: string[];
  prescriptions: PrescriptionOption[];
  prescriptionUpload: React.ReactNode;
  onlineEnabled: boolean;
};

const card = "rounded-xl bg-white p-5 shadow-sm";
const input = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none";
const errorBox = "rounded-md bg-red-50 p-3 text-sm text-red-800";

export function CheckoutForm({
  subtotalPaise,
  addresses,
  slots,
  rxItems,
  prescriptions,
  prescriptionUpload,
  onlineEnabled,
}: Props) {
  const needsRx = rxItems.length > 0;
  const [payment, setPayment] = useState<"ONLINE" | "COD">(onlineEnabled ? "ONLINE" : "COD");
  const [chosenRxId, setRxId] = useState("");
  // Default to the newest usable prescription (e.g. one just uploaded) until the customer picks one.
  const rxId = prescriptions.some((p) => p.id === chosenRxId) ? chosenRxId : (prescriptions[0]?.id ?? "");
  const [mode, setMode] = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const serviceable = addresses.filter((a) => a.deliveryFeePaise !== null);
  const [chosenId, setAddressId] = useState("");
  // Fall back to the newest deliverable address (e.g. one just saved) until the customer picks one.
  const addressId = serviceable.some((a) => a.id === chosenId) ? chosenId : (serviceable[0]?.id ?? "");
  const [orderState, placeOrder, placing] = useActionState<FormState, FormData>(placeOrderAction, {});
  const [addressState, addAddress, saving] = useActionState<FormState, FormData>(addAddressAction, {});

  const selected = addresses.find((a) => a.id === addressId);
  const deliveryFee = mode === "DELIVERY" ? (selected?.deliveryFeePaise ?? 0) : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <fieldset className={card}>
          <legend className="mb-3 text-lg font-semibold">How would you like to get your order?</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["PICKUP", "DELIVERY"] as const).map((m) => (
              <label
                key={m}
                className={`cursor-pointer rounded-lg border p-3 ${mode === m ? "border-brand ring-2 ring-brand/30" : "border-slate-300"}`}
              >
                <input type="radio" name="mode-choice" className="mr-2" checked={mode === m} onChange={() => setMode(m)} />
                <span className="font-medium">{m === "PICKUP" ? "Store pickup" : "Home delivery"}</span>
                <span className="block pl-5 text-xs text-slate-500">
                  {m === "PICKUP" ? "Free · collect at the counter" : "Within our delivery area"}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {mode === "PICKUP" ? (
          <section className={card}>
            <label htmlFor="pickupSlot" className="mb-2 block text-lg font-semibold">
              Pickup time
            </label>
            {slots.length > 0 ? (
              <select id="pickupSlot" name="pickupSlot" form="place-order" className={input} defaultValue={slots[0].value}>
                {slots.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-slate-600">No pickup slots are available right now.</p>
            )}
            <p className="mt-2 text-xs text-slate-500">Bring your order number. Pay by cash or UPI at the counter.</p>
          </section>
        ) : (
          <section className={card}>
            <h2 className="mb-3 text-lg font-semibold">Delivery address</h2>
            {addresses.length > 0 && (
              <div className="mb-4 space-y-2">
                {addresses.map((a) => (
                  <label
                    key={a.id}
                    className={`block rounded-lg border p-3 text-sm ${a.deliveryFeePaise === null ? "border-slate-200 text-slate-400" : "cursor-pointer border-slate-300"} ${addressId === a.id ? "border-brand ring-2 ring-brand/30" : ""}`}
                  >
                    <input
                      type="radio"
                      name="address-choice"
                      className="mr-2"
                      disabled={a.deliveryFeePaise === null}
                      checked={addressId === a.id}
                      onChange={() => setAddressId(a.id)}
                    />
                    {a.summary}
                    <span className="block pl-5 text-xs">
                      {a.deliveryFeePaise === null
                        ? "We don't deliver here yet"
                        : a.deliveryFeePaise === 0
                          ? "Free delivery"
                          : `Delivery fee ${formatPaise(a.deliveryFeePaise)}`}
                    </span>
                  </label>
                ))}
              </div>
            )}

            <details open={addresses.length === 0} className="rounded-lg border border-dashed border-slate-300 p-3">
              <summary className="cursor-pointer text-sm font-medium text-brand">Add a new address</summary>
              <form action={addAddress} className="mt-3 grid gap-3 sm:grid-cols-2">
                <input name="line1" required placeholder="House / flat, street *" className={`${input} sm:col-span-2`} />
                <input name="line2" placeholder="Area / locality" className={`${input} sm:col-span-2`} />
                <input name="landmark" placeholder="Landmark" className={input} />
                <input name="label" placeholder="Label (Home, Office)" className={input} />
                <input name="city" required placeholder="City *" className={input} />
                <input name="state" required placeholder="State *" className={input} />
                <input
                  name="pincode"
                  required
                  inputMode="numeric"
                  pattern="[1-9][0-9]{5}"
                  maxLength={6}
                  placeholder="Pincode *"
                  className={input}
                />
                <button
                  disabled={saving}
                  className="rounded-md border border-brand px-4 py-2 text-sm font-medium text-brand hover:bg-brand hover:text-white disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save address"}
                </button>
                {addressState.error && <p className={`${errorBox} sm:col-span-2`}>{addressState.error}</p>}
              </form>
            </details>
          </section>
        )}

        {needsRx && (
          <section className={card}>
            <h2 className="mb-1 text-lg font-semibold">Prescription</h2>
            <p className="mb-3 text-sm text-slate-600">
              Needed for: {rxItems.join(", ")}. Our pharmacist will verify it before your order is packed — we’ll
              update you if anything is missing.
            </p>
            {prescriptions.length > 0 && (
              <div className="mb-4 space-y-2">
                {prescriptions.map((p) => (
                  <label
                    key={p.id}
                    className={`flex cursor-pointer flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm ${rxId === p.id ? "border-brand ring-2 ring-brand/30" : "border-slate-300"}`}
                  >
                    <span>
                      <input
                        type="radio"
                        name="rx-choice"
                        className="mr-2"
                        checked={rxId === p.id}
                        onChange={() => setRxId(p.id)}
                      />
                      {p.label}
                      <span className="ml-2 text-xs text-slate-500">{p.status}</span>
                    </span>
                    <a
                      href={`/api/prescriptions/${p.id}/file`}
                      target="_blank"
                      rel="noopener"
                      className="text-xs text-brand hover:underline"
                    >
                      View
                    </a>
                  </label>
                ))}
              </div>
            )}
            <details open={prescriptions.length === 0} className="rounded-lg border border-dashed border-slate-300 p-3">
              <summary className="cursor-pointer text-sm font-medium text-brand">Upload a new prescription</summary>
              <div className="mt-3">{prescriptionUpload}</div>
            </details>
          </section>
        )}

        <fieldset className={card}>
          <legend className="mb-3 text-lg font-semibold">Payment</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {onlineEnabled && (
              <label
                className={`cursor-pointer rounded-lg border p-3 ${payment === "ONLINE" ? "border-brand ring-2 ring-brand/30" : "border-slate-300"}`}
              >
                <input type="radio" name="payment-choice" className="mr-2" checked={payment === "ONLINE"} onChange={() => setPayment("ONLINE")} />
                <span className="font-medium">Pay online</span>
                <span className="block pl-5 text-xs text-slate-500">
                  UPI, cards, netbanking via Razorpay{needsRx && " · refunded if the prescription isn’t accepted"}
                </span>
              </label>
            )}
            <label
              className={`cursor-pointer rounded-lg border p-3 ${payment === "COD" ? "border-brand ring-2 ring-brand/30" : "border-slate-300"}`}
            >
              <input type="radio" name="payment-choice" className="mr-2" checked={payment === "COD"} onChange={() => setPayment("COD")} />
              <span className="font-medium">{mode === "PICKUP" ? "Pay at pickup" : "Cash on delivery"}</span>
              <span className="block pl-5 text-xs text-slate-500">Cash or UPI when you receive your order</span>
            </label>
          </div>
        </fieldset>
      </div>

      <aside className={`${card} h-fit`}>
        <h2 className="mb-3 text-lg font-semibold">Order summary</h2>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt>Items (incl. GST)</dt>
            <dd>{formatPaise(subtotalPaise)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>{mode === "PICKUP" ? "Store pickup" : "Delivery"}</dt>
            <dd>{deliveryFee === 0 ? "Free" : formatPaise(deliveryFee)}</dd>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold">
            <dt>To pay</dt>
            <dd>{formatPaise(subtotalPaise + deliveryFee)}</dd>
          </div>
        </dl>

        <form id="place-order" action={placeOrder} className="mt-4">
          <input type="hidden" name="mode" value={mode} />
          {mode === "DELIVERY" && <input type="hidden" name="addressId" value={addressId} />}
          {needsRx && <input type="hidden" name="prescriptionId" value={rxId} />}
          <input type="hidden" name="paymentMethod" value={payment} />
          <button
            disabled={
              placing ||
              (mode === "DELIVERY" && !addressId) ||
              (mode === "PICKUP" && slots.length === 0) ||
              (needsRx && !rxId)
            }
            className="w-full rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {placing ? "Placing order…" : payment === "ONLINE" ? "Place order & pay" : "Place order"}
          </button>
          {orderState.error && <p className={`${errorBox} mt-3`}>{orderState.error}</p>}
        </form>
        {needsRx && !rxId && (
          <p className="mt-2 text-xs text-amber-800">Upload or choose a prescription to place this order.</p>
        )}
        <p className="mt-2 text-xs text-slate-500">Final prices and stock are checked again when you place the order.</p>
      </aside>
    </div>
  );
}
