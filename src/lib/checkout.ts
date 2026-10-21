import { randomInt } from "node:crypto";
import { db } from "@/lib/db";
import {
  DrugSchedule,
  FulfilmentMode,
  OrderStatus,
  PaymentMethod,
  PrescriptionStatus,
} from "@/generated/prisma/enums";
import { allocateFefo } from "@/lib/inventory";
import { notifyOrder } from "@/lib/notify";
import { expireUnpaidOrders } from "@/lib/payments/online";
import { onlinePaymentsEnabled } from "@/lib/payments/razorpay";
import { orderTotals } from "@/lib/pricing";
import { findPickupSlot } from "@/lib/store";

/** A problem the customer can fix (shown to them as-is). */
export class CheckoutError extends Error {}

export type CheckoutInput = { userId: string; prescriptionId?: string; paymentMethod: "COD" | "ONLINE" } & (
  | { mode: "PICKUP"; pickupSlot: string }
  | { mode: "DELIVERY"; addressId: string }
);

const ORDER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

function newOrderNumber(now: Date): string {
  const ist = new Date(now.getTime() + 330 * 60_000);
  const date = ist.toISOString().slice(2, 10).replace(/-/g, "");
  const code = Array.from({ length: 6 }, () => ORDER_CODE_ALPHABET[randomInt(ORDER_CODE_ALPHABET.length)]).join("");
  return `MP-${date}-${code}`;
}

/**
 * Places an order from the user's cart in one transaction: re-reads prices, reserves stock (FEFO, with an
 * atomic guard against overselling), creates the order and empties the cart. Online orders start as
 * PAYMENT_PENDING and only move on once the payment is confirmed.
 */
export async function placeOrder(input: CheckoutInput): Promise<{ orderNumber: string }> {
  const now = new Date();
  const online = input.paymentMethod === "ONLINE";
  if (online && !onlinePaymentsEnabled()) throw new CheckoutError("Online payment isn't available right now.");
  await expireUnpaidOrders(); // frees stock held by abandoned online orders

  const placed = await db.$transaction(async (tx) => {
    const cart = await tx.cart.findUnique({
      where: { userId: input.userId },
      include: {
        items: {
          orderBy: { id: "asc" },
          include: {
            product: {
              include: {
                batches: { where: { expiryDate: { gt: now } }, orderBy: [{ expiryDate: "asc" }, { id: "asc" }] },
              },
            },
          },
        },
      },
    });
    if (!cart || cart.items.length === 0) throw new CheckoutError("Your cart is empty.");

    let deliveryFeePaise = 0;
    let addressId: string | undefined;
    let pickupSlotStart: Date | undefined;

    if (input.mode === "DELIVERY") {
      const address = await tx.address.findFirst({ where: { id: input.addressId, userId: input.userId } });
      if (!address) throw new CheckoutError("Please choose a delivery address.");
      const area = await tx.serviceArea.findFirst({ where: { pincode: address.pincode, isActive: true } });
      if (!area) throw new CheckoutError(`Sorry, we don't deliver to ${address.pincode} yet. Choose store pickup instead.`);
      deliveryFeePaise = area.deliveryFeePaise;
      addressId = address.id;
    } else {
      const slot = findPickupSlot(input.pickupSlot, now);
      if (!slot) throw new CheckoutError("That pickup slot is no longer available. Please choose another.");
      pickupSlotStart = slot.start;
    }

    // Prescription medicines: the order waits for a pharmacist to verify the attached prescription.
    const needsRx = cart.items.some((i) => i.product.requiresRx);
    let prescriptionId: string | undefined;
    if (needsRx) {
      const rx = input.prescriptionId
        ? await tx.prescription.findFirst({
            where: {
              id: input.prescriptionId,
              userId: input.userId,
              status: { in: [PrescriptionStatus.PENDING, PrescriptionStatus.APPROVED] },
              OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
            },
            select: { id: true },
          })
        : null;
      if (!rx) throw new CheckoutError("Please attach a valid prescription for the prescription medicines in your cart.");
      prescriptionId = rx.id;
    }

    const orderItems = [];
    for (const { quantity, product } of cart.items) {
      if (!product.isActive || product.schedule === DrugSchedule.X) {
        throw new CheckoutError(`${product.name} is no longer available. Please remove it from your cart.`);
      }
      const allocations = allocateFefo(
        product.batches.map((b) => ({ id: b.id, available: b.quantity - b.reserved })),
        quantity,
      );
      if (!allocations) throw new CheckoutError(`Not enough stock of ${product.name}. Please reduce the quantity.`);

      for (const a of allocations) {
        // Guarded increment: fails if another order took this stock since we read it.
        const updated = await tx.$executeRaw`
          UPDATE "InventoryBatch" SET reserved = reserved + ${a.quantity}
          WHERE id = ${a.batchId} AND quantity - reserved >= ${a.quantity}`;
        if (updated !== 1) throw new CheckoutError(`Stock of ${product.name} just changed. Please review your cart.`);

        orderItems.push({
          productId: product.id,
          batchId: a.batchId,
          productName: product.name,
          hsnCode: product.hsnCode,
          quantity: a.quantity,
          unitPricePaise: product.pricePaise,
          gstRate: product.gstRate,
          lineTotalPaise: product.pricePaise * a.quantity,
        });
      }
    }

    const totals = orderTotals(
      orderItems.map((i) => ({ unitPricePaise: i.unitPricePaise, quantity: i.quantity, gstRate: Number(i.gstRate) })),
      deliveryFeePaise,
    );

    const order = await tx.order.create({
      data: {
        orderNumber: newOrderNumber(now),
        userId: input.userId,
        fulfilmentMode: input.mode === "DELIVERY" ? FulfilmentMode.DELIVERY : FulfilmentMode.PICKUP,
        status: online ? OrderStatus.PAYMENT_PENDING : needsRx ? OrderStatus.AWAITING_RX_REVIEW : OrderStatus.PLACED,
        addressId,
        pickupSlotStart,
        prescriptionId,
        ...totals,
        items: { create: orderItems },
        payments: {
          create: online
            ? { method: PaymentMethod.ONLINE, gateway: "razorpay", amountPaise: totals.totalPaise }
            : { method: PaymentMethod.COD, amountPaise: totals.totalPaise },
        },
        ...(input.mode === "DELIVERY" ? { delivery: { create: {} } } : {}),
      },
      select: { id: true, orderNumber: true },
    });

    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    await tx.auditLog.create({
      data: {
        actorId: input.userId,
        action: "order.create",
        entityType: "Order",
        entityId: order.id,
        metadata: { paymentMethod: input.paymentMethod, totalPaise: totals.totalPaise, prescriptionId: prescriptionId ?? null },
      },
    });

    return order;
  });

  // Online orders are announced once the payment is confirmed (see settleGatewayPayment).
  if (!online) await notifyOrder(placed.id);
  return { orderNumber: placed.orderNumber };
}
