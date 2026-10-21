import { db } from "@/lib/db";
import { OrderStatus, PrescriptionStatus } from "@/generated/prisma/enums";
import { releaseOrderStock } from "@/lib/inventory-db";

/** A review problem the pharmacist can act on (shown as-is). */
export class ReviewError extends Error {}

const STALE = "This order is no longer awaiting prescription review.";

export type ApproveInput = {
  orderId: string;
  reviewerId: string;
  doctorName: string;
  issuedOn: Date;
  expiresAt?: Date;
  notes?: string;
};

/** Approves the order's prescription and confirms the order. */
export async function approveRxOrder(input: ApproveInput): Promise<void> {
  await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      select: { status: true, prescriptionId: true },
    });
    if (!order?.prescriptionId || order.status !== OrderStatus.AWAITING_RX_REVIEW) throw new ReviewError(STALE);

    // Guarded transition: only one reviewer can move the order out of review.
    const moved = await tx.order.updateMany({
      where: { id: input.orderId, status: OrderStatus.AWAITING_RX_REVIEW },
      data: { status: OrderStatus.CONFIRMED, rxReviewNotes: input.notes ?? null },
    });
    if (moved.count !== 1) throw new ReviewError(STALE);

    await tx.prescription.update({
      where: { id: order.prescriptionId },
      data: {
        status: PrescriptionStatus.APPROVED,
        doctorName: input.doctorName,
        issuedOn: input.issuedOn,
        expiresAt: input.expiresAt ?? null,
        reviewedById: input.reviewerId,
        reviewedAt: new Date(),
        reviewNotes: input.notes ?? null,
      },
    });
    await tx.auditLog.createMany({
      data: [
        {
          actorId: input.reviewerId,
          action: "prescription.approve",
          entityType: "Prescription",
          entityId: order.prescriptionId,
          metadata: { orderId: input.orderId },
        },
        {
          actorId: input.reviewerId,
          action: "order.status_change",
          entityType: "Order",
          entityId: input.orderId,
          metadata: { from: OrderStatus.AWAITING_RX_REVIEW, to: OrderStatus.CONFIRMED },
        },
      ],
    });
  });
}

export type RejectInput = {
  orderId: string;
  reviewerId: string;
  reason: string;
  /** The prescription itself is invalid (not just unsuitable for this order), so it can't be reused. */
  prescriptionInvalid: boolean;
};

/** Rejects the order, releases its reserved stock and optionally marks the prescription invalid. */
export async function rejectRxOrder(input: RejectInput): Promise<void> {
  await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      select: { status: true, prescriptionId: true, items: { select: { batchId: true, quantity: true } } },
    });
    if (!order?.prescriptionId || order.status !== OrderStatus.AWAITING_RX_REVIEW) throw new ReviewError(STALE);

    const moved = await tx.order.updateMany({
      where: { id: input.orderId, status: OrderStatus.AWAITING_RX_REVIEW },
      data: { status: OrderStatus.RX_REJECTED, rxReviewNotes: input.reason },
    });
    if (moved.count !== 1) throw new ReviewError(STALE);

    await releaseOrderStock(tx, order.items);

    if (input.prescriptionInvalid) {
      await tx.prescription.update({
        where: { id: order.prescriptionId },
        data: {
          status: PrescriptionStatus.REJECTED,
          reviewedById: input.reviewerId,
          reviewedAt: new Date(),
          reviewNotes: input.reason,
        },
      });
    }
    await tx.auditLog.createMany({
      data: [
        {
          actorId: input.reviewerId,
          action: "prescription.reject",
          entityType: "Prescription",
          entityId: order.prescriptionId,
          metadata: { orderId: input.orderId, prescriptionInvalid: input.prescriptionInvalid },
        },
        {
          actorId: input.reviewerId,
          action: "order.status_change",
          entityType: "Order",
          entityId: input.orderId,
          metadata: { from: OrderStatus.AWAITING_RX_REVIEW, to: OrderStatus.RX_REJECTED },
        },
      ],
    });
  });
}
