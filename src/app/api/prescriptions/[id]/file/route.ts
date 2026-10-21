import { db } from "@/lib/db";
import { getCurrentUser, isStaff } from "@/lib/auth/session";
import { prescriptionFileHeaders } from "@/lib/security-headers";
import { getObject } from "@/lib/storage";

// Serves a prescription file to its owner or to pharmacy staff only. Staff views are audit-logged.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("Not found", { status: 404 });

  const rx = await db.prescription.findUnique({
    where: { id },
    select: { id: true, userId: true, fileKey: true, mimeType: true },
  });
  const staff = isStaff(user);
  // Same response whether it doesn't exist or isn't theirs, so IDs can't be probed.
  if (!rx || (rx.userId !== user.id && !staff)) return new Response("Not found", { status: 404 });

  if (staff && rx.userId !== user.id) {
    await db.auditLog.create({
      data: { actorId: user.id, action: "prescription.view", entityType: "Prescription", entityId: rx.id },
    });
  }

  const body = await getObject(rx.fileKey);
  const ext = rx.mimeType === "application/pdf" ? "pdf" : rx.mimeType === "image/png" ? "png" : "jpg";
  const headers = {
    ...prescriptionFileHeaders(rx.mimeType),
    "Content-Type": rx.mimeType,
    "Content-Disposition": `inline; filename="prescription.${ext}"`,
  };
  return new Response(new Uint8Array(body), { headers });
}
