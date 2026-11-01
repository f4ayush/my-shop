import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { CheckoutSteps } from "@/components/CheckoutSteps";
import { LockIcon } from "@/components/icons";
import { container } from "@/components/ui";
import { BRAND_NAME } from "@/lib/brand";
import { LEGAL_LINKS } from "@/lib/legal-links";

// Cart and checkout: a quiet header with the steps instead of the full shop navigation.
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-line bg-white print:hidden">
        <div className={`${container} flex flex-wrap items-center justify-between gap-4 py-4`}>
          <BrandLogo />
          <CheckoutSteps />
          <span className="flex items-center gap-2 text-[13px] font-medium text-muted">
            <LockIcon size={16} />
            Secure checkout
          </span>
        </div>
      </header>
      <main className={`${container} flex-1 pt-8 pb-28 sm:pb-24`}>{children}</main>
      <footer className="border-t border-line bg-white print:hidden">
        <div className={`${container} flex flex-wrap justify-between gap-x-6 gap-y-2 py-6 text-[13px] text-muted max-sm:pb-28`}>
          <nav aria-label="Policies" className="flex flex-wrap gap-x-4 gap-y-1">
            {LEGAL_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="text-brand hover:underline">
                {l.label}
              </Link>
            ))}
          </nav>
          <span>
            © {new Date().getFullYear()} {BRAND_NAME}
          </span>
        </div>
      </footer>
    </>
  );
}
