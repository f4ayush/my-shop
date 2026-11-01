"use client";

import { useActionState, useState } from "react";
import { FileIcon, LockIcon, PinIcon } from "@/components/icons";
import { btn, card, errorBox, field } from "@/components/ui";
import { formatPrice } from "@/lib/money";
import { addAddressAction, placeOrderAction, type FormState } from "./actions";

export type AddressOption = { id: string; summary: string; deliveryFeePaise: number | null };
export type SlotOption = { value: string; label: string };

export type PrescriptionOption = { id: string; label: string; status: string };

type Props = {
  subtotalPaise: number;
  /** MRP of the same items, to show the discount. */
  mrpTotalPaise: number;
  addresses: AddressOption[];
  slots: SlotOption[];
  /** Names of cart items that need a prescription (empty when none do). */
  rxItems: string[];
  prescriptions: PrescriptionOption[];
  prescriptionUpload: React.ReactNode;
  onlineEnabled: boolean;
};

const section = `${card} flex flex-col gap-4 p-5 sm:p-6`;
const tile = (selected: boolean, disabled = false) =>
  `flex min-h-14 items-center gap-3 rounded-[14px] border-2 px-4 py-3 text-[15px] ${
    disabled ? "border-line text-subtle" : selected ? "cursor-pointer border-brand bg-mint" : "cursor-pointer border-line bg-white hover:border-line-strong"
  }`;
const radio = "size-[18px] shrink-0 accent-brand";

function SectionHeading({ icon, tone, title, sub }: { icon: React.ReactNode; tone: string; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>{icon}</span>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-lg font-bold">{title}</h2>
        {sub && <span className="text-sm text-muted">{sub}</span>}
      </div>
    </div>
  );
}

export function CheckoutForm({
  subtotalPaise,
  mrpTotalPaise,
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
  const discount = Math.max(0, mrpTotalPaise - subtotalPaise);
  const blockedReason =
    needsRx && !rxId
      ? "Upload or choose a prescription to continue"
      : mode === "DELIVERY" && !addressId
        ? "Add a delivery address we serve to continue"
        : mode === "PICKUP" && slots.length === 0
          ? "No pickup slots are available right now"
          : null;

  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
        {needsRx && (
          <section className={section}>
            <SectionHeading
              icon={<FileIcon />}
              tone="bg-amber-tint text-amber-ink"
              title="Prescription"
              sub={`Needed for: ${rxItems.join(", ")}`}
            />
            {prescriptions.length > 0 && (
              <div role="radiogroup" aria-label="Prescription" className="flex flex-col gap-2.5">
                {prescriptions.map((p) => (
                  <label key={p.id} className={`${tile(rxId === p.id)} flex-wrap justify-between`}>
                    <span className="flex items-center gap-3">
                      <input type="radio" name="rx-choice" className={radio} checked={rxId === p.id} onChange={() => setRxId(p.id)} />
                      <span className="flex flex-col">
                        <span className="font-semibold">{p.label}</span>
                        <span className="text-xs text-muted">{p.status}</span>
                      </span>
                    </span>
                    <a
                      href={`/api/prescriptions/${p.id}/file`}
                      target="_blank"
                      rel="noopener"
                      className="text-sm font-bold text-brand hover:underline"
                    >
                      View
                    </a>
                  </label>
                ))}
              </div>
            )}
            <details open={prescriptions.length === 0} className="group">
              <summary className="cursor-pointer text-sm font-bold text-brand group-open:mb-3">Upload a new prescription</summary>
              {prescriptionUpload}
            </details>
            <p className="text-xs text-muted">
              Our pharmacist verifies it before your order is packed — we’ll update you if anything is missing.
            </p>
          </section>
        )}

        <section className={section}>
          <SectionHeading icon={<PinIcon />} tone="bg-mint text-brand-dark" title="Pickup or delivery" />
          <div role="radiogroup" aria-label="Pickup or delivery" className="grid gap-3 sm:grid-cols-2">
            {(["PICKUP", "DELIVERY"] as const).map((m) => (
              <label key={m} className={tile(mode === m)}>
                <input type="radio" name="mode-choice" className={radio} checked={mode === m} onChange={() => setMode(m)} />
                <span className="flex flex-col">
                  <span className="font-semibold">{m === "PICKUP" ? "Store pickup" : "Home delivery"}</span>
                  <span className="text-xs text-muted">{m === "PICKUP" ? "Free · collect at the counter" : "Within our delivery area"}</span>
                </span>
              </label>
            ))}
          </div>

          {mode === "PICKUP" ? (
            <div className="flex flex-col gap-2">
              <label htmlFor="pickupSlot" className="text-sm font-bold">
                Pickup time
              </label>
              {slots.length > 0 ? (
                <select id="pickupSlot" name="pickupSlot" form="place-order" className={field} defaultValue={slots[0].value}>
                  {slots.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-muted">No pickup slots are available right now.</p>
              )}
              <p className="text-xs text-muted">Bring your order number. Pay by cash or UPI at the counter.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-bold">Deliver to</h3>
              {addresses.length > 0 && (
                <div role="radiogroup" aria-label="Delivery address" className="flex flex-col gap-2.5">
                  {addresses.map((a) => {
                    const unserved = a.deliveryFeePaise === null;
                    return (
                      <label key={a.id} className={tile(addressId === a.id, unserved)}>
                        <input
                          type="radio"
                          name="address-choice"
                          className={radio}
                          disabled={unserved}
                          checked={addressId === a.id}
                          onChange={() => setAddressId(a.id)}
                        />
                        <span className="flex flex-col text-sm">
                          <span className="font-semibold">{a.summary}</span>
                          <span className="text-xs">
                            {unserved
                              ? "We don't deliver here yet"
                              : a.deliveryFeePaise === 0
                                ? "Free delivery"
                                : `Delivery fee ${formatPrice(a.deliveryFeePaise!)}`}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              <details open={addresses.length === 0} className="group rounded-2xl border-2 border-dashed border-[#C9D8D5] bg-canvas p-4">
                <summary className="cursor-pointer text-sm font-bold text-brand">Add a new address</summary>
                <form action={addAddress} className="mt-4 grid gap-3 sm:grid-cols-2">
                  <input name="line1" required placeholder="House / flat, street *" aria-label="House / flat, street" className={`${field} sm:col-span-2`} />
                  <input name="line2" placeholder="Area / locality" aria-label="Area / locality" className={`${field} sm:col-span-2`} />
                  <input name="landmark" placeholder="Landmark" aria-label="Landmark" className={field} />
                  <input name="label" placeholder="Label (Home, Office)" aria-label="Label" className={field} />
                  <input name="city" required placeholder="City *" aria-label="City" className={field} />
                  <input name="state" required placeholder="State *" aria-label="State" className={field} />
                  <input
                    name="pincode"
                    required
                    inputMode="numeric"
                    pattern="[1-9][0-9]{5}"
                    maxLength={6}
                    placeholder="PIN code *"
                    aria-label="PIN code"
                    className={field}
                  />
                  <button disabled={saving} className={btn("dark")}>
                    {saving ? "Saving…" : "Save address"}
                  </button>
                  {addressState.error && <p className={`${errorBox} sm:col-span-2`}>{addressState.error}</p>}
                </form>
              </details>
            </div>
          )}
        </section>

        <section className={section}>
          <h2 className="text-lg font-bold">Payment method</h2>
          <div role="radiogroup" aria-label="Payment method" className="grid gap-3 sm:grid-cols-2">
            {onlineEnabled && (
              <label className={tile(payment === "ONLINE")}>
                <input type="radio" name="payment-choice" className={radio} checked={payment === "ONLINE"} onChange={() => setPayment("ONLINE")} />
                <span className="flex flex-col">
                  <span className="font-semibold">Pay online</span>
                  <span className="text-xs text-muted">
                    UPI, cards, netbanking via Razorpay{needsRx && " · refunded if the prescription isn’t accepted"}
                  </span>
                </span>
              </label>
            )}
            <label className={tile(payment === "COD")}>
              <input type="radio" name="payment-choice" className={radio} checked={payment === "COD"} onChange={() => setPayment("COD")} />
              <span className="flex flex-col">
                <span className="font-semibold">{mode === "PICKUP" ? "Pay at pickup" : "Cash on delivery"}</span>
                <span className="text-xs text-muted">Cash or UPI when you receive your order</span>
              </span>
            </label>
          </div>
        </section>
      </div>

      <aside className={`${card} flex min-w-0 flex-[1_1_340px] flex-col gap-4 p-6`}>
        <h2 className="text-xl font-bold tracking-[-0.01em]">Order summary</h2>
        <dl className="flex flex-col gap-3 text-[15px]">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-2">Item total (MRP)</dt>
            <dd className="font-semibold">{formatPrice(mrpTotalPaise)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-2">Discount</dt>
            <dd className="font-semibold text-brand-dark">−{formatPrice(discount)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-2">{mode === "PICKUP" ? "Store pickup" : "Delivery"}</dt>
            <dd className="font-semibold">{deliveryFee === 0 ? "Free" : formatPrice(deliveryFee)}</dd>
          </div>
        </dl>
        <div className="h-px bg-line" />
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-base font-bold">To pay</span>
          <span className="text-3xl font-extrabold tracking-[-0.02em]">{formatPrice(subtotalPaise + deliveryFee)}</span>
        </div>
        {discount > 0 && (
          <span className="rounded-xl bg-mint px-3.5 py-2.5 text-sm font-semibold text-forest">
            You save {formatPrice(discount)} on this order
          </span>
        )}

        <form id="place-order" action={placeOrder} className="flex flex-col gap-2">
          <input type="hidden" name="mode" value={mode} />
          {mode === "DELIVERY" && <input type="hidden" name="addressId" value={addressId} />}
          {needsRx && <input type="hidden" name="prescriptionId" value={rxId} />}
          <input type="hidden" name="paymentMethod" value={payment} />
          <button disabled={placing || blockedReason !== null} className={btn("primary", "lg")}>
            <LockIcon size={18} />
            {placing ? "Placing order…" : payment === "ONLINE" ? "Place order & pay" : "Place order"}
          </button>
          {blockedReason && <span className="text-center text-[13px] text-muted">{blockedReason}</span>}
          {orderState.error && <p className={errorBox}>{orderState.error}</p>}
        </form>
        <p className="text-xs leading-relaxed text-muted">
          Prices include GST and are checked again when you place the order.
          {needsRx &&
            " Prescription items are packed only after our pharmacist approves your prescription; if it isn’t accepted, any online payment is refunded."}
        </p>
      </aside>
    </div>
  );
}
