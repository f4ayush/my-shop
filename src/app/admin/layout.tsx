import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/prescriptions", label: "Rx queue" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/inventory", label: "Stock sync" },
];

// Every admin page is staff-only; non-staff get a 404. Actions re-check this themselves.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return (
    <div className="space-y-6">
      <nav aria-label="Admin" className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 text-sm print:hidden">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="rounded-md px-3 py-1.5 font-medium text-slate-700 hover:bg-white hover:text-brand">
            {n.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
