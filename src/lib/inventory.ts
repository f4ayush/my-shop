export type BatchStock = { id: string; available: number };
export type Allocation = { batchId: string; quantity: number };

/**
 * First-expiry-first-out: takes stock from batches in the given order (callers sort by expiry,
 * soonest first). Returns null when there isn't enough stock in total.
 */
export function allocateFefo(batches: BatchStock[], quantity: number): Allocation[] | null {
  const allocations: Allocation[] = [];
  let remaining = quantity;
  for (const batch of batches) {
    if (remaining === 0) break;
    const take = Math.min(remaining, Math.max(0, batch.available));
    if (take > 0) {
      allocations.push({ batchId: batch.id, quantity: take });
      remaining -= take;
    }
  }
  return remaining === 0 ? allocations : null;
}
