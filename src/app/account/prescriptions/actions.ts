"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { uploadPrescription } from "@/lib/rx/prescriptions";

export type UploadState = { error?: string; uploadedId?: string };

export async function uploadPrescriptionAction(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Faccount%2Fprescriptions");

  const result = await uploadPrescription(user.id, formData.get("file"), formData.get("consent") === "on");
  if (!result.ok) return { error: result.error };

  revalidatePath("/account/prescriptions");
  revalidatePath("/checkout");
  return { uploadedId: result.id };
}
