"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/session";
import { FulfilmentError, transitionOrder } from "@/lib/fulfilment";

const schema = z.object({
  orderId: z.string().min(1).max(64),
  to: z.enum(["CONFIRMED", "PACKED", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "COMPLETED", "CANCELLED"]),
  reason: z.string().trim().max(300).optional(),
  tab: z.string().max(20).optional(),
});

export async function transitionAction(formData: FormData): Promise<void> {
  const staff = await requireStaff(); // checked on every action, not just the page
  const parsed = schema.safeParse({
    orderId: formData.get("orderId"),
    to: formData.get("to"),
    reason: formData.get("reason") || undefined,
    tab: formData.get("tab") || undefined,
  });
  const back = (params: Record<string, string>) =>
    `/admin/orders?${new URLSearchParams({ ...(parsed.data?.tab ? { tab: parsed.data.tab } : {}), ...params })}`;
  if (!parsed.success) redirect(back({ error: "Invalid request." }));

  let message: string;
  try {
    const result = await transitionOrder({ ...parsed.data, actorId: staff.id });
    message =
      result.refund === "started"
        ? "Order cancelled and a full refund started."
        : result.refund === "failed"
          ? "Order cancelled, but the refund couldn't be started — retry it from the Rx queue page."
          : "Order updated.";
    if (result.invoiceToReverse) message += ` Invoice ${result.invoiceToReverse} was already issued: raise a credit note.`;
  } catch (e) {
    if (e instanceof FulfilmentError) redirect(back({ error: e.message }));
    throw e;
  }
  revalidatePath("/admin/orders");
  redirect(back({ done: message }));
}
