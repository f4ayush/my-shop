"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { CheckoutError, placeOrder } from "@/lib/checkout";

export type FormState = { error?: string };

const addressSchema = z.object({
  label: z.string().trim().max(30).optional(),
  line1: z.string().trim().min(3, "Enter the house/flat and street.").max(120),
  line2: z.string().trim().max(120).optional(),
  landmark: z.string().trim().max(80).optional(),
  city: z.string().trim().min(2, "Enter the city.").max(60),
  state: z.string().trim().min(2, "Enter the state.").max(60),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit pincode."),
});

const optional = (v: FormDataEntryValue | null) => (typeof v === "string" && v.trim() !== "" ? v : undefined);

export async function addAddressAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fcheckout");

  const parsed = addressSchema.safeParse({
    label: optional(formData.get("label")),
    line1: formData.get("line1"),
    line2: optional(formData.get("line2")),
    landmark: optional(formData.get("landmark")),
    city: formData.get("city"),
    state: formData.get("state"),
    pincode: formData.get("pincode"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the address." };

  const area = await db.serviceArea.findFirst({ where: { pincode: parsed.data.pincode, isActive: true } });
  if (!area) return { error: `Sorry, we don't deliver to ${parsed.data.pincode} yet. You can choose store pickup.` };

  await db.address.create({ data: { ...parsed.data, userId: user.id } });
  revalidatePath("/checkout");
  return {};
}

const orderSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("PICKUP"), pickupSlot: z.string().min(1, "Choose a pickup time.") }),
  z.object({ mode: z.literal("DELIVERY"), addressId: z.string().min(1, "Choose a delivery address.") }),
]);

export async function placeOrderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fcheckout");

  const parsed = orderSchema.safeParse({
    mode: formData.get("mode"),
    pickupSlot: formData.get("pickupSlot") ?? "",
    addressId: formData.get("addressId") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check your choices." };

  const rx = z.string().max(64).optional().safeParse(optional(formData.get("prescriptionId")));
  const prescriptionId = rx.success ? rx.data : undefined;
  const paymentMethod = formData.get("paymentMethod") === "ONLINE" ? "ONLINE" : "COD";

  let orderNumber: string;
  try {
    ({ orderNumber } = await placeOrder({ userId: user.id, prescriptionId, paymentMethod, ...parsed.data }));
  } catch (e) {
    if (e instanceof CheckoutError) return { error: e.message };
    console.error("placeOrder failed", e);
    return { error: "We couldn't place your order. Please try again." };
  }

  revalidatePath("/", "layout");
  // Online orders go straight to the payment window on the order page.
  redirect(`/account/orders/${orderNumber}?${paymentMethod === "ONLINE" ? "pay=1" : "placed=1"}`);
}
