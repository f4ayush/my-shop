// Pilot ordering. While WHATSAPP_ORDER_NUMBER is set, customers don't log in or check out: they fill a cart
// and send it to the shop on WhatsApp. Unset it to switch accounts, checkout and payments back on.
// Reads the environment, so server-only: hand links to client components as props.

import { BRAND_NAME } from "@/lib/brand";
import type { CartLine } from "@/lib/cart";
import { formatPrice } from "@/lib/money";
import { normalizeIndianMobile } from "@/lib/phone";

/** The shop's number as wa.me wants it ("919876543210"), or null when the pilot is off. */
export function whatsappNumberFromEnv(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  const e164 = normalizeIndianMobile(raw);
  // Fail the deploy rather than quietly fall back to online checkout.
  if (!e164) throw new Error("WHATSAPP_ORDER_NUMBER must be a 10-digit Indian mobile number");
  return e164.slice(1);
}

const number = whatsappNumberFromEnv(process.env.WHATSAPP_ORDER_NUMBER);

/** True during the pilot: orders are taken on WhatsApp instead of online checkout. */
export const whatsappOrders = number !== null;

export const waMeLink = (number: string, text: string) => `https://wa.me/${number}?text=${encodeURIComponent(text)}`;

/** Opens a chat with the shop with `text` typed in. Only while `whatsappOrders` is on. */
export function whatsappUrl(text: string): string {
  if (!number) throw new Error("WHATSAPP_ORDER_NUMBER is not set");
  return waMeLink(number, text);
}

export const HELLO_MESSAGE = `Hi ${BRAND_NAME}, I'd like to order some medicines.`;
export const PRESCRIPTION_MESSAGE = `Hi ${BRAND_NAME}, I'd like to order the medicines on my prescription. I'll send a photo of it here.`;

type OrderLine = Pick<CartLine, "name" | "packSize" | "quantity" | "lineTotalPaise" | "issue">;

/** What the cart's "Order on WhatsApp" button types in for the customer. */
export function orderMessage(cart: { lines: OrderLine[]; subtotalPaise: number; hasRxItems: boolean }): string {
  const items = cart.lines
    .filter((l) => !l.issue)
    .map((l, i) => `${i + 1}. ${l.name}${l.packSize ? ` (${l.packSize})` : ""} × ${l.quantity} — ${formatPrice(l.lineTotalPaise)}`);
  return [
    `Hi ${BRAND_NAME}, I'd like to order:`,
    "",
    ...items,
    "",
    `Estimated total: ${formatPrice(cart.subtotalPaise)}`,
    ...(cart.hasRxItems ? ["I'll send my prescription in this chat."] : []),
  ].join("\n");
}
