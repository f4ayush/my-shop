"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { applyImport, createImportPreview, discardImport, ImportError } from "@/lib/inventory-sync";

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const back = (params: Record<string, string>) => `/admin/inventory?${new URLSearchParams(params)}`;

export async function uploadStockFileAction(formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) redirect(back({ error: "Choose a CSV file to upload." }));
  if (file.size > MAX_FILE_BYTES) redirect(back({ error: "The file is larger than 2 MB. Split it into smaller files." }));
  if (!/\.(csv|txt)$/i.test(file.name)) {
    redirect(back({ error: "Upload a .csv file. In Excel or your billing software, use “Save as / Export → CSV”." }));
  }

  let id: string;
  try {
    id = await createImportPreview({
      userId: staff.id,
      fileName: file.name,
      text: new TextDecoder("utf-8").decode(await file.arrayBuffer()),
      fullSnapshot: formData.get("fullSnapshot") === "on",
    });
  } catch (e) {
    if (e instanceof ImportError) redirect(back({ error: e.message }));
    throw e;
  }
  redirect(back({ preview: id }));
}

export async function applyImportAction(formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const id = String(formData.get("importId") ?? "").slice(0, 64);
  try {
    await applyImport(id, staff.id);
  } catch (e) {
    if (e instanceof ImportError) redirect(back({ error: e.message }));
    console.error("applyImport failed", e);
    redirect(back({ error: "The import failed and nothing was changed. Please try again." }));
  }
  revalidatePath("/", "layout");
  redirect(back({ applied: id }));
}

export async function discardImportAction(formData: FormData): Promise<void> {
  await requireStaff();
  await discardImport(String(formData.get("importId") ?? "").slice(0, 64));
  redirect("/admin/inventory");
}
