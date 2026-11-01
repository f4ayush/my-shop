import Link from "next/link";
import { getCurrentUser, isStaff, type CurrentUser } from "@/lib/auth/session";
import { BRAND_NAME } from "@/lib/brand";
import { BUSINESS } from "@/lib/business";
import { getCartView } from "@/lib/cart";
import { getCategories } from "@/lib/catalog";
import { LEGAL_LINKS } from "@/lib/legal-links";
import { formatPrice } from "@/lib/money";
import { BrandLogo } from "./BrandLogo";
import { CartIcon, ChevronRightIcon, UploadIcon, UserIcon } from "./icons";
import { MobileTabBar } from "./MobileTabBar";
import { SearchBox } from "./SearchBox";
import { container } from "./ui";

/** Storefront chrome: header, footer and the phone tab/cart bars around the page. */
export async function SiteShell({ children }: { children: React.ReactNode }) {
  const [categories, user, cart] = await Promise.all([getCategories(), getCurrentUser(), getCartView()]);
  return (
    // On phones, leave room for the fixed tab bar (and the cart bar above it).
    <div className={`flex flex-1 flex-col ${cart.itemCount > 0 ? "max-sm:pb-40" : "max-sm:pb-20"} print:pb-0`}>
      <SiteHeader user={user} cartCount={cart.itemCount} />
      <main className={`${container} flex-1 pt-6 pb-20 sm:pt-7 sm:pb-24`}>{children}</main>
      <SiteFooter categories={categories} />
      {cart.itemCount > 0 && <MobileCartBar count={cart.itemCount} subtotalPaise={cart.subtotalPaise} />}
      <MobileTabBar />
    </div>
  );
}

function SiteHeader({ user, cartCount }: { user: CurrentUser | null; cartCount: number }) {
  return (
    <header className="print:hidden">
      <div className="bg-forest text-[13px] font-medium text-[#DDF1EC]">
        <p className={`${container} py-2.5 text-center`}>Every prescription order is checked by a registered pharmacist</p>
      </div>
      <div className="border-b border-line bg-white">
        <div className={`${container} flex flex-wrap items-center gap-x-7 gap-y-3 py-3 sm:py-4`}>
          <BrandLogo />
          <div className="order-last w-full sm:order-none sm:w-auto sm:flex-[1_1_320px]">
            <SearchBox variant="header" />
          </div>
          <nav aria-label="Account" className="ml-auto flex items-center gap-2 sm:ml-0">
            {isStaff(user) && (
              <Link href="/admin" className="rounded-lg bg-amber-tint px-2.5 py-1 text-sm font-bold text-amber-ink">
                Admin
              </Link>
            )}
            <Link
              href="/account/prescriptions"
              className="hidden h-11 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold text-ink hover:bg-field sm:flex"
            >
              <UploadIcon />
              Upload Rx
            </Link>
            <Link
              href="/account"
              aria-label={user ? "Your account" : "Log in"}
              className="hidden size-11 items-center justify-center rounded-xl text-ink hover:bg-field sm:flex"
            >
              <UserIcon size={22} />
            </Link>
            <Link
              href="/cart"
              className="flex h-11 items-center gap-2.5 rounded-xl bg-ink px-4 text-sm font-semibold text-white hover:bg-black"
            >
              <CartIcon />
              <span className="max-sm:sr-only">Cart</span>
              {cartCount > 0 && (
                <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold text-ink">
                  {cartCount}
                  <span className="sr-only"> items</span>
                </span>
              )}
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}

const linkClass = "text-brand hover:text-brand-dark hover:underline";

function SiteFooter({ categories }: { categories: { name: string; slug: string }[] }) {
  const help = [
    { href: "/account/orders", label: "Track order" },
    ...LEGAL_LINKS.filter((l) => ["/returns", "/shipping", "/grievance"].includes(l.href)),
  ];
  const legal = LEGAL_LINKS.filter((l) => ["/privacy", "/terms"].includes(l.href));
  const columns = [
    { title: "Shop", links: [...categories.map((c) => ({ href: `/category/${c.slug}`, label: c.name })), { href: "/search", label: "All products" }] },
    { title: "Help", links: help },
    { title: "Legal", links: legal },
  ];
  const contact = [BUSINESS.address, BUSINESS.phone, BUSINESS.email].filter(Boolean).join(" · ");
  const licence = [
    BUSINESS.drugLicence && `Drug licence no. ${BUSINESS.drugLicence}`,
    BUSINESS.pharmacist && `Pharmacist in charge: ${BUSINESS.pharmacist}`,
    BUSINESS.gstin && `GSTIN: ${BUSINESS.gstin}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <footer className="border-t border-line bg-white print:hidden">
      <div className={`${container} flex flex-col gap-10 pt-14 pb-8`}>
        <div className="flex flex-wrap justify-between gap-10">
          <div className="flex max-w-[360px] flex-[1_1_280px] flex-col gap-3">
            <span className="text-[22px] font-extrabold tracking-[-0.02em]">{BRAND_NAME}</span>
            <p className="text-sm leading-relaxed text-muted">
              Information on this site is not a substitute for medical advice. Always consult your doctor before
              starting or changing a medicine. Prescription medicines are dispensed only against a valid
              prescription verified by our registered pharmacist.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-14 gap-y-8">
            {columns.map((col) => (
              <nav key={col.title} aria-label={col.title} className="flex flex-col gap-2.5 text-sm">
                <strong className="text-ink">{col.title}</strong>
                {col.links.map((l) => (
                  <Link key={l.href} href={l.href} className={linkClass}>
                    {l.label}
                  </Link>
                ))}
              </nav>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap justify-between gap-x-6 gap-y-2 border-t border-line pt-6 text-[13px] text-muted">
          <div className="space-y-1">
            <p>
              {BUSINESS.legalName}
              {contact && ` · ${contact}`}
            </p>
            {licence && <p>{licence}</p>}
          </div>
          <span>
            © {new Date().getFullYear()} {BRAND_NAME}
          </span>
        </div>
      </div>
    </footer>
  );
}

/** Phone-only "N items · ₹X · View cart" bar above the tab bar. */
function MobileCartBar({ count, subtotalPaise }: { count: number; subtotalPaise: number }) {
  return (
    <Link
      href="/cart"
      className="fixed inset-x-4 bottom-[88px] z-40 flex h-14 items-center justify-between rounded-[18px] bg-ink px-[18px] text-white shadow-[0_12px_30px_rgba(16,32,30,.25)] hover:text-white sm:hidden print:hidden"
    >
      <span className="flex flex-col">
        <span className="text-xs text-[#C6D3D1]">
          {count} {count === 1 ? "item" : "items"}
        </span>
        <strong className="text-base">{formatPrice(subtotalPaise)}</strong>
      </span>
      <span className="flex items-center gap-1.5 text-[15px] font-bold">
        View cart
        <ChevronRightIcon size={18} strokeWidth={2.4} />
      </span>
    </Link>
  );
}
