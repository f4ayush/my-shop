"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { activationProblems, diffProduct, productInputSchema, requiresRxFor, slugify } from "@/lib/product-rules";

export type ProductFormState = { error?: string };

export async function saveProductAction(_prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  const staff = await requireStaff(); // checked on every action, not just the page
  const id = String(formData.get("id") ?? "") || null;
  const str = (k: string) => String(formData.get(k) ?? "");

  const parsed = productInputSchema.safeParse({
    sku: str("sku"),
    name: str("name"),
    slug: str("slug").trim() || slugify(str("name")),
    composition: str("composition"),
    manufacturer: str("manufacturer"),
    packSize: str("packSize"),
    description: str("description"),
    categoryId: str("categoryId"),
    schedule: str("schedule"),
    mrpPaise: str("mrp"),
    pricePaise: str("price"),
    hsnCode: str("hsnCode"),
    gstRate: str("gstRate"),
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the details." };
  const input = parsed.data;

  const category = await db.category.findUnique({ where: { id: input.categoryId }, select: { slug: true } });
  if (!category) return { error: "Choose a category." };
  if (input.isActive) {
    const problems = activationProblems(input, category.slug);
    if (problems.length) return { error: problems.join(" ") };
  }

  const clash = await db.product.findFirst({
    where: { OR: [{ sku: input.sku }, { slug: input.slug }], ...(id ? { NOT: { id } } : {}) },
    select: { sku: true },
  });
  if (clash) return { error: clash.sku === input.sku ? "Another item already uses this item code." : "Another item already uses this URL name." };

  const data = { ...input, requiresRx: requiresRxFor(input.schedule) };
  let savedId: string;
  if (id) {
    const before = await db.product.findUnique({ where: { id } });
    if (!before) return { error: "This item no longer exists." };
    await db.product.update({ where: { id }, data });
    const changes = diffProduct({ ...before, gstRate: Number(before.gstRate) }, data);
    if (Object.keys(changes).length) {
      await db.auditLog.create({
        data: { actorId: staff.id, action: "product.update", entityType: "Product", entityId: id, metadata: JSON.parse(JSON.stringify(changes)) },
      });
    }
    savedId = id;
  } else {
    const created = await db.product.create({ data, select: { id: true } });
    await db.auditLog.create({
      data: { actorId: staff.id, action: "product.create", entityType: "Product", entityId: created.id, metadata: { sku: input.sku } },
    });
    savedId = created.id;
  }

  revalidatePath("/", "layout");
  redirect(`/admin/products/${savedId}?saved=1`);
}
