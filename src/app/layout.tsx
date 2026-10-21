import type { Metadata } from "next";
import Link from "next/link";
import { SearchBox } from "@/components/SearchBox";
import { logoutAction } from "@/app/login/actions";
import { getCurrentUser, isStaff } from "@/lib/auth/session";
import { getCartView } from "@/lib/cart";
import { getCategories } from "@/lib/catalog";
import { BUSINESS } from "@/lib/business";
import { LEGAL_LINKS } from "@/lib/legal-links";
import { maskPhone } from "@/lib/phone";
import "./globals.css";

// Every page reads live prices and stock from the database.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "My Pharmacy", template: "%s | My Pharmacy" },
  description: "Order medicines and health products online — store pickup or local delivery.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [categories, user, cart] = await Promise.all([getCategories(), getCurrentUser(), getCartView()]);
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <header className="bg-brand text-white print:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-8">
            <Link href="/" className="shrink-0 text-xl font-semibold">
              My Pharmacy
            </Link>
            <SearchBox />
            <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 text-sm sm:ml-auto">
              {user ? (
                <>
                  {isStaff(user) && (
                    <Link href="/admin" className="rounded bg-amber-300 px-2 py-0.5 font-medium text-slate-900">
                      Admin
                    </Link>
                  )}
                  <Link href="/account/prescriptions" className="hover:underline">
                    Prescriptions
                  </Link>
                  <Link href="/account/orders" className="hover:underline">
                    My orders
                  </Link>
                  <span className="hidden text-white/70 md:inline">{maskPhone(user.phone)}</span>
                  <form action={logoutAction}>
                    <button className="hover:underline">Log out</button>
                  </form>
                </>
              ) : (
                <Link href="/login" className="hover:underline">
                  Log in
                </Link>
              )}
              <Link href="/cart" className="rounded-md bg-white/15 px-3 py-1.5 font-medium hover:bg-white/25">
                Cart{cart.itemCount > 0 && ` (${cart.itemCount})`}
              </Link>
            </div>
          </div>
          <nav aria-label="Categories" className="bg-brand-dark">
            <ul className="mx-auto flex max-w-6xl gap-5 overflow-x-auto px-4 py-2 text-sm whitespace-nowrap">
              <li>
                <Link href="/search" className="hover:underline">
                  All products
                </Link>
              </li>
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link href={`/category/${c.slug}`} className="hover:underline">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-slate-200 bg-white print:hidden">
          <div className="mx-auto max-w-6xl space-y-1 px-4 py-6 text-xs text-slate-500">
            <p>
              Prescription medicines are dispensed only against a valid prescription verified by our registered
              pharmacist.
            </p>
            <nav aria-label="Policies" className="flex flex-wrap gap-x-4 gap-y-1 py-1">
              {LEGAL_LINKS.map((l) => (
                <Link key={l.href} href={l.href} className="hover:text-brand hover:underline">
                  {l.label}
                </Link>
              ))}
            </nav>
            <p>
              {BUSINESS.legalName}
              {BUSINESS.address && ` · ${BUSINESS.address}`}
              {BUSINESS.phone && ` · ${BUSINESS.phone}`}
              {BUSINESS.email && ` · ${BUSINESS.email}`}
              {BUSINESS.drugLicence && ` · Drug licence: ${BUSINESS.drugLicence}`}
              {BUSINESS.pharmacist && ` · Pharmacist: ${BUSINESS.pharmacist}`}
              {BUSINESS.gstin && ` · GSTIN: ${BUSINESS.gstin}`}
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
