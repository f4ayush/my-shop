import { db } from "@/lib/db";
import { PrescriptionStatus } from "@/generated/prisma/enums";
import { deleteObject, newPrescriptionKey, putObject } from "@/lib/storage";
import { detectRxFileType, MAX_RX_BYTES } from "./file-type";

const MAX_UPLOADS_PER_DAY = 10;

export type UploadResult = { ok: true; id: string } | { ok: false; error: string };

export async function uploadPrescription(userId: string, file: unknown, consent: boolean): Promise<UploadResult> {
  if (!consent) return { ok: false, error: "Please confirm consent to upload your prescription." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a photo or PDF of your prescription." };
  if (file.size > MAX_RX_BYTES) return { ok: false, error: "The file is too large. The limit is 5 MB." };

  const recent = await db.prescription.count({
    where: { userId, createdAt: { gt: new Date(Date.now() - 24 * 60 * 60_000) } },
  });
  if (recent >= MAX_UPLOADS_PER_DAY) return { ok: false, error: "Upload limit reached. Please try again tomorrow." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectRxFileType(bytes);
  if (!type) return { ok: false, error: "Only JPG, PNG or PDF files are accepted." };

  const fileKey = newPrescriptionKey(type.ext);
  await putObject(fileKey, bytes);
  try {
    const rx = await db.prescription.create({
      data: { userId, fileKey, mimeType: type.mime, sizeBytes: bytes.length, consentAt: new Date() },
      select: { id: true },
    });
    await db.auditLog.create({
      data: { actorId: userId, action: "prescription.upload", entityType: "Prescription", entityId: rx.id },
    });
    return { ok: true, id: rx.id };
  } catch (e) {
    await deleteObject(fileKey); // don't leave orphaned health data behind
    throw e;
  }
}

/** Prescriptions a customer can attach to a new order: not rejected and not expired. */
export async function usablePrescriptions(userId: string) {
  return db.prescription.findMany({
    where: {
      userId,
      status: { in: [PrescriptionStatus.PENDING, PrescriptionStatus.APPROVED] },
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, status: true, createdAt: true, doctorName: true, mimeType: true },
  });
}
