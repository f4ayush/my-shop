import { z } from "zod";
import { parseRupees } from "./inventory-import";

export const GST_RATES = [0, 5, 12, 18, 28] as const;
export const SCHEDULES = ["OTC", "H", "H1", "X"] as const;
export type Schedule = (typeof SCHEDULES)[number];

/** Schedule H, H1 and X medicines may only be sold against a prescription. */
export const requiresRxFor = (schedule: Schedule) => schedule !== "OTC";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));
const rupees = (label: string) =>
  z.string().transform((v, ctx) => {
    const paise = parseRupees(v);
    if (paise === null) {
      ctx.addIssue({ code: "custom", message: `${label} must be an amount in rupees, e.g. 45.50.` });
      return z.NEVER;
    }
    return paise;
  });

export const productInputSchema = z
  .object({
    sku: z.string().trim().min(1, "Item code is required.").max(64),
    name: z.string().trim().min(2, "Name is required.").max(200),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "URL name may only use lowercase letters, numbers and hyphens.")
      .max(100),
    composition: text(300),
    manufacturer: text(120),
    packSize: text(60),
    description: text(2000),
    categoryId: z.string().min(1, "Choose a category.").max(64),
    schedule: z.enum(SCHEDULES),
    mrpPaise: rupees("MRP"),
    pricePaise: rupees("Selling price"),
    hsnCode: z
      .string()
      .trim()
      .regex(/^(\d{4}|\d{6}|\d{8})?$/, "HSN must be 4, 6 or 8 digits.")
      .transform((v) => v || null),
    gstRate: z.coerce.number().refine((n) => (GST_RATES as readonly number[]).includes(n), "Choose a valid GST rate."),
    isActive: z.boolean(),
  })
  .refine((p) => p.pricePaise <= p.mrpPaise, { message: "Selling price can't be above MRP.", path: ["pricePaise"] });

export type ProductInput = z.infer<typeof productInputSchema>;

/** Reasons an item can't be put on sale yet (empty when it can). */
export function activationProblems(p: Pick<ProductInput, "schedule" | "pricePaise">, categorySlug: string): string[] {
  const problems: string[] = [];
  if (p.schedule === "X") problems.push("Schedule X medicines can't be sold online.");
  if (p.pricePaise <= 0) problems.push("Set a selling price before putting it on sale.");
  if (categorySlug === "uncategorised") problems.push("Choose a real category before putting it on sale.");
  return problems;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 100);
}

/** Field-level differences for the audit log (prices in paise). */
export function diffProduct(before: Record<string, unknown>, after: Record<string, unknown>) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    const a = before[key];
    const b = after[key];
    if (String(a ?? "") !== String(b ?? "")) changes[key] = { from: a ?? null, to: b ?? null };
  }
  return changes;
}
