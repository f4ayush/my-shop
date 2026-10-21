import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import { DrugSchedule } from "@/generated/prisma/enums";
import { getCurrentUser } from "@/lib/auth/session";
import { hashToken, newToken, secureCookie } from "@/lib/auth/tokens";
import { availableQty, liveBatches } from "@/lib/catalog";

const CART_COOKIE = "cart";
const CART_TTL_S = 30 * 24 * 60 * 60;
export const MAX_QTY_PER_ITEM = 10;

const clampQty = (n: number) => Math.min(MAX_QTY_PER_ITEM, Math.max(1, Math.floor(n)));

/** The current visitor's cart: the user's cart when signed in, otherwise the guest cart cookie's. */
async function findCartId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (user) {
    const cart = await db.cart.findUnique({ where: { userId: user.id }, select: { id: true } });
    return cart?.id ?? null;
  }
  const token = (await cookies()).get(CART_COOKIE)?.value;
  if (!token) return null;
  const cart = await db.cart.findUnique({ where: { tokenHash: hashToken(token) }, select: { id: true } });
  return cart?.id ?? null;
}

/** Must be called from a Server Action (it may set the guest cart cookie). */
async function getOrCreateCartId(): Promise<string> {
  const existing = await findCartId();
  if (existing) return existing;

  const user = await getCurrentUser();
  if (user) {
    const cart = await db.cart.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } });
    return cart.id;
  }
  const token = newToken();
  const cart = await db.cart.create({ data: { tokenHash: hashToken(token) } });
  (await cookies()).set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie,
    path: "/",
    maxAge: CART_TTL_S,
  });
  return cart.id;
}

export type AddResult = { ok: true } | { ok: false; error: string };

export async function addToCart(productId: string, quantity: number): Promise<AddResult> {
  const product = await db.product.findFirst({
    where: { id: productId, isActive: true, schedule: { not: DrugSchedule.X } },
    select: { id: true },
  });
  if (!product) return { ok: false, error: "This product is not available." };

  const cartId = await getOrCreateCartId();
  const qty = clampQty(quantity);
  await db.cartItem.upsert({
    where: { cartId_productId: { cartId, productId } },
    create: { cartId, productId, quantity: qty },
    update: { quantity: { increment: qty } },
  });
  await db.cartItem.updateMany({
    where: { cartId, productId, quantity: { gt: MAX_QTY_PER_ITEM } },
    data: { quantity: MAX_QTY_PER_ITEM },
  });
  return { ok: true };
}

/** Sets a line's quantity; 0 removes it. */
export async function setCartQuantity(productId: string, quantity: number): Promise<void> {
  const cartId = await findCartId();
  if (!cartId) return;
  if (quantity <= 0) {
    await db.cartItem.deleteMany({ where: { cartId, productId } });
  } else {
    await db.cartItem.updateMany({ where: { cartId, productId }, data: { quantity: clampQty(quantity) } });
  }
}

export type CartLine = {
  productId: string;
  slug: string;
  name: string;
  packSize: string | null;
  pricePaise: number;
  mrpPaise: number;
  quantity: number;
  lineTotalPaise: number;
  requiresRx: boolean;
  stockQty: number;
  /** Why this line can't be ordered right now, if it can't. */
  issue: "unavailable" | "out_of_stock" | "insufficient_stock" | null;
};

export type CartView = {
  lines: CartLine[];
  itemCount: number;
  subtotalPaise: number;
  hasRxItems: boolean;
  hasIssues: boolean;
};

export const getCartView = cache(async (): Promise<CartView> => {
  const cartId = await findCartId();
  const items = cartId
    ? await db.cartItem.findMany({
        where: { cartId },
        orderBy: { id: "asc" },
        include: {
          product: {
            select: {
              slug: true,
              name: true,
              packSize: true,
              pricePaise: true,
              mrpPaise: true,
              requiresRx: true,
              isActive: true,
              schedule: true,
              batches: liveBatches(),
            },
          },
        },
      })
    : [];

  const lines: CartLine[] = items.map(({ productId, quantity, product: p }) => {
    const stockQty = availableQty(p.batches);
    const sellable = p.isActive && p.schedule !== DrugSchedule.X;
    const issue = !sellable ? "unavailable" : stockQty === 0 ? "out_of_stock" : stockQty < quantity ? "insufficient_stock" : null;
    return {
      productId,
      slug: p.slug,
      name: p.name,
      packSize: p.packSize,
      pricePaise: p.pricePaise,
      mrpPaise: p.mrpPaise,
      quantity,
      lineTotalPaise: p.pricePaise * quantity,
      requiresRx: p.requiresRx,
      stockQty,
      issue,
    };
  });

  return {
    lines,
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    subtotalPaise: lines.reduce((n, l) => n + (l.issue ? 0 : l.lineTotalPaise), 0),
    hasRxItems: lines.some((l) => l.requiresRx),
    hasIssues: lines.some((l) => l.issue !== null),
  };
});

/** After login: move the guest cart's items into the user's cart. Call from a Server Action. */
export async function mergeGuestCartInto(userId: string): Promise<void> {
  const jar = await cookies();
  const token = jar.get(CART_COOKIE)?.value;
  if (!token) return;
  jar.delete(CART_COOKIE);

  const guest = await db.cart.findUnique({ where: { tokenHash: hashToken(token) }, include: { items: true } });
  if (!guest) return;

  const userCart = await db.cart.findUnique({ where: { userId }, select: { id: true } });
  if (!userCart) {
    await db.cart.update({ where: { id: guest.id }, data: { userId, tokenHash: null } });
    return;
  }

  await db.$transaction(async (tx) => {
    for (const item of guest.items) {
      await tx.cartItem.upsert({
        where: { cartId_productId: { cartId: userCart.id, productId: item.productId } },
        create: { cartId: userCart.id, productId: item.productId, quantity: item.quantity },
        update: { quantity: { increment: item.quantity } },
      });
    }
    await tx.cartItem.updateMany({
      where: { cartId: userCart.id, quantity: { gt: MAX_QTY_PER_ITEM } },
      data: { quantity: MAX_QTY_PER_ITEM },
    });
    await tx.cart.delete({ where: { id: guest.id } });
  });
}
