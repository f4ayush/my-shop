"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/session";
import { approveRxOrder, rejectRxOrder, ReviewError } from "@/lib/rx/review";
import { todayIst } from "@/lib/store";
import { db } from "@/lib/db";
import { notifyOrder } from "@/lib/notify";
import { refundOnlinePayment } from "@/lib/payments/online";
import { PaymentStatus } from "@/generated/prisma/enums";

export type ReviewState = { error?: string };

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.");
const optional = (v: FormDataEntryValue | null) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined);

const approveSchema = z
  .object({
    orderId: z.string().min(1).max(64),
    doctorName: z.string().trim().min(2, "Enter the prescribing doctor's name.").max(100),
    issuedOn: isoDate,
    expiresAt: isoDate.optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .refine((d) => d.issuedOn <= todayIst(), {
    message: "The prescription date can't be in the future.",
  })
  .refine((d) => !d.expiresAt || d.expiresAt >= d.issuedOn, {
    message: "'Valid until' must be on or after the prescription date.",
  });

export async function approveAction(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const staff = await requireStaff(); // re-checked on every action, not just the page
  const parsed = approveSchema.safeParse({
    orderId: formData.get("orderId"),
    doctorName: formData.get("doctorName"),
    issuedOn: formData.get("issuedOn"),
    expiresAt: optional(formData.get("expiresAt")),
    notes: optional(formData.get("notes")),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the details." };

  const d = parsed.data;
  try {
    await approveRxOrder({
      orderId: d.orderId,
      reviewerId: staff.id,
      doctorName: d.doctorName,
      issuedOn: new Date(`${d.issuedOn}T00:00:00Z`),
      expiresAt: d.expiresAt ? new Date(`${d.expiresAt}T00:00:00Z`) : undefined,
      notes: d.notes,
    });
  } catch (e) {
    if (e instanceof ReviewError) return { error: e.message };
    throw e;
  }
  await notifyOrder(d.orderId);
  revalidatePath("/admin/prescriptions");
  redirect("/admin/prescriptions?done=approved");
}

const rejectSchema = z.object({
  orderId: z.string().min(1).max(64),
  reason: z.string().trim().min(5, "Tell the customer why (at least a few words).").max(500),
});

export async function rejectAction(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const staff = await requireStaff();
  const parsed = rejectSchema.safeParse({ orderId: formData.get("orderId"), reason: formData.get("reason") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please give a reason." };

  try {
    await rejectRxOrder({
      orderId: parsed.data.orderId,
      reviewerId: staff.id,
      reason: parsed.data.reason,
      prescriptionInvalid: formData.get("prescriptionInvalid") === "on",
    });
  } catch (e) {
    if (e instanceof ReviewError) return { error: e.message };
    throw e;
  }

  await notifyOrder(parsed.data.orderId);

  // Prepaid orders get their money back. If the gateway call fails it's listed for staff to retry.
  let done = "rejected";
  const paid = await db.payment.findFirst({
    where: { orderId: parsed.data.orderId, status: PaymentStatus.CAPTURED, gateway: { not: null } },
    select: { id: true },
  });
  if (paid) {
    done = (await refundOnlinePayment(paid.id, "Prescription not accepted", staff.id)) ? "rejected_refunded" : "rejected_refund_failed";
  }
  revalidatePath("/admin/prescriptions");
  redirect(`/admin/prescriptions?done=${done}`);
}

export async function retryRefundAction(formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const paymentId = String(formData.get("paymentId") ?? "").slice(0, 64);
  const ok = await refundOnlinePayment(paymentId, "Refund retried by staff", staff.id);
  revalidatePath("/admin/prescriptions");
  redirect(`/admin/prescriptions?done=${ok ? "refund_retried" : "rejected_refund_failed"}`);
}
