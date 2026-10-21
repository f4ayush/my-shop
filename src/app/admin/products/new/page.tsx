import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { ProductForm } from "../ProductForm";

export const metadata: Metadata = { title: "Add product", robots: { index: false, follow: false } };

export default async function NewProductPage() {
  const categories = await db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } });
  const defaultCategory = categories.find((c) => c.slug !== "uncategorised") ?? categories[0];

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">Add product</h1>
        <Link href="/admin/products" className="text-sm text-brand hover:underline">
          ← All products
        </Link>
      </div>
      <p className="text-sm text-slate-600">
        Stock is added through Stock sync, matched on the item code — use the same code as your billing software.
      </p>
      <ProductForm
        categories={categories}
        values={{
          sku: "",
          name: "",
          slug: "",
          composition: "",
          manufacturer: "",
          packSize: "",
          description: "",
          categoryId: defaultCategory?.id ?? "",
          schedule: "H",
          mrp: "",
          price: "",
          hsnCode: "",
          gstRate: "12",
          isActive: false,
        }}
      />
    </section>
  );
}
