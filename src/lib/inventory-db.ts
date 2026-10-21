import type { Prisma } from "@/generated/prisma/client";

/** Returns an order's reserved units to available stock (call inside the transaction that cancels it). */
export async function releaseOrderStock(
  tx: Prisma.TransactionClient,
  items: { batchId: string | null; quantity: number }[],
): Promise<void> {
  for (const item of items) {
    if (!item.batchId) continue;
    await tx.$executeRaw`
      UPDATE "InventoryBatch" SET reserved = GREATEST(reserved - ${item.quantity}, 0)
      WHERE id = ${item.batchId}`;
  }
}
