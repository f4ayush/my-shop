"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addToCart, MAX_QTY_PER_ITEM, setCartQuantity } from "@/lib/cart";

export type AddToCartState = { status: "idle" | "added" | "error"; message?: string };

const addSchema = z.object({
  productId: z.string().min(1).max(64),
  quantity: z.coerce.number().int().min(1).max(MAX_QTY_PER_ITEM).default(1),
});

export async function addToCartAction(_prev: AddToCartState, formData: FormData): Promise<AddToCartState> {
  const parsed = addSchema.safeParse({
    productId: formData.get("productId"),
    quantity: formData.get("quantity") ?? undefined,
  });
  if (!parsed.success) return { status: "error", message: "Please choose a valid quantity." };

  const result = await addToCart(parsed.data.productId, parsed.data.quantity);
  if (!result.ok) return { status: "error", message: result.error };
  revalidatePath("/", "layout");
  return { status: "added", message: "Added to cart" };
}

const updateSchema = z.object({
  productId: z.string().min(1).max(64),
  quantity: z.coerce.number().int().min(0).max(MAX_QTY_PER_ITEM),
});

export async function updateCartAction(formData: FormData): Promise<void> {
  const parsed = updateSchema.safeParse({
    productId: formData.get("productId"),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) return;
  await setCartQuantity(parsed.data.productId, parsed.data.quantity);
  revalidatePath("/", "layout");
}
