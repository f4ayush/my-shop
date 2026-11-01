"use client";

import { startTransition, useActionState, useState } from "react";
import { saveProductAction, type ProductFormState } from "./actions";

export type ProductFormValues = {
  id?: string;
  sku: string;
  name: string;
  slug: string;
  composition: string;
  manufacturer: string;
  packSize: string;
  description: string;
  categoryId: string;
  schedule: "OTC" | "H" | "H1" | "X";
  mrp: string;
  price: string;
  hsnCode: string;
  gstRate: string;
  isActive: boolean;
};

const input = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none";
const label = "mb-1 block text-sm font-medium";

const SCHEDULE_HELP: Record<ProductFormValues["schedule"], string> = {
  OTC: "Sold without a prescription.",
  H: "Prescription required; pharmacist verifies before dispatch.",
  H1: "Prescription required, and each sale must be entered in the H1 register.",
  X: "Can never be sold online. The item stays hidden.",
};

export function ProductForm({ values, categories }: { values: ProductFormValues; categories: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<ProductFormState, FormData>(saveProductAction, {});
  const [schedule, setSchedule] = useState(values.schedule);

  const field = (name: keyof ProductFormValues, text: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={name} className={label}>
        {text}
      </label>
      <input id={name} name={name} defaultValue={String(values[name] ?? "")} className={input} {...props} />
    </div>
  );

  // Submit manually: React's automatic form reset after an action would otherwise wipe the staff
  // member's edits after a validation error — and silently flip the controlled schedule select to
  // its first option (OTC), which could save a prescription drug as OTC.
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => action(formData));
  };

  return (
    <form action={action} onSubmit={onSubmit} className="space-y-6">
      {values.id && <input type="hidden" name="id" value={values.id} />}

      <fieldset className="grid gap-4 rounded-xl bg-white p-5 shadow-sm sm:grid-cols-2">
        <legend className="sr-only">Details</legend>
        {field("name", "Name *", { required: true, maxLength: 200 })}
        {field("sku", "Item code (from billing software) *", { required: true, maxLength: 64 })}
        {field("composition", "Salt / composition", { maxLength: 300, placeholder: "e.g. Paracetamol 650 mg" })}
        {field("manufacturer", "Manufacturer", { maxLength: 120 })}
        {field("packSize", "Pack size", { maxLength: 60, placeholder: "e.g. Strip of 15 tablets" })}
        {field("slug", "URL name", { maxLength: 100, placeholder: "Leave blank to generate from the name" })}
        <div className="sm:col-span-2">
          <label htmlFor="description" className={label}>
            Description
          </label>
          <textarea id="description" name="description" rows={3} maxLength={2000} defaultValue={values.description} className={input} />
        </div>
      </fieldset>

      <fieldset className="grid gap-4 rounded-xl bg-white p-5 shadow-sm sm:grid-cols-2">
        <legend className="sr-only">Classification</legend>
        <div>
          <label htmlFor="categoryId" className={label}>
            Category *
          </label>
          <select id="categoryId" name="categoryId" required defaultValue={values.categoryId} className={input}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="schedule" className={label}>
            Drug schedule *
          </label>
          <select
            id="schedule"
            name="schedule"
            value={schedule}
            onChange={(e) => setSchedule(e.target.value as ProductFormValues["schedule"])}
            className={input}
          >
            <option value="OTC">OTC (no prescription)</option>
            <option value="H">Schedule H</option>
            <option value="H1">Schedule H1</option>
            <option value="X">Schedule X</option>
          </select>
          <p className={`mt-1 text-xs ${schedule === "X" ? "text-red-700" : "text-slate-500"}`}>{SCHEDULE_HELP[schedule]}</p>
        </div>
      </fieldset>

      <fieldset className="grid gap-4 rounded-xl bg-white p-5 shadow-sm sm:grid-cols-4">
        <legend className="sr-only">Pricing and tax</legend>
        {field("mrp", "MRP (₹) *", { required: true, inputMode: "decimal" })}
        {field("price", "Selling price (₹) *", { required: true, inputMode: "decimal" })}
        {field("hsnCode", "HSN code", { inputMode: "numeric", maxLength: 8 })}
        <div>
          <label htmlFor="gstRate" className={label}>
            GST % *
          </label>
          <select id="gstRate" name="gstRate" defaultValue={values.gstRate} className={input}>
            {["0", "5", "12", "18", "28"].map((r) => (
              <option key={r} value={r}>
                {r}%
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-slate-500 sm:col-span-4">
          Prices include GST. The selling price can’t be above MRP. Confirm GST rates and HSN codes with your CA.
        </p>
      </fieldset>

      <div className="flex flex-wrap items-center gap-4 rounded-xl bg-white p-5 shadow-sm">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="isActive" defaultChecked={values.isActive} disabled={schedule === "X"} />
          On sale (visible in the shop)
        </label>
        <button
          disabled={pending}
          className="ml-auto rounded-md bg-brand px-5 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {state.error && (
          <p role="alert" className="w-full rounded-md bg-red-50 p-3 text-sm text-red-800">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}
