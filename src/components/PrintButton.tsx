"use client";

export function PrintButton({ label = "Print / save as PDF" }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark print:hidden"
    >
      {label}
    </button>
  );
}
