"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CartIcon, ChatIcon, GridIcon, HomeIcon, TruckIcon, UserIcon } from "./icons";

const HOME = { href: "/", label: "Home", Icon: HomeIcon, active: (p: string) => p === "/" };
const CATEGORIES = {
  href: "/search",
  label: "Categories",
  Icon: GridIcon,
  active: (p: string) => p.startsWith("/search") || p.startsWith("/category") || p.startsWith("/product"),
};

const TABS = [
  HOME,
  CATEGORIES,
  { href: "/account/orders", label: "Orders", Icon: TruckIcon, active: (p: string) => p.startsWith("/account/orders") },
  {
    href: "/account",
    label: "Account",
    Icon: UserIcon,
    active: (p: string) => p === "/account" || p.startsWith("/account/prescriptions"),
  },
];

const tabClass = (on: boolean) =>
  `flex min-h-12 flex-col items-center justify-center gap-1 text-[11px] ${on ? "font-bold text-brand" : "font-semibold text-muted"}`;

/**
 * Phone-only bottom navigation (the design's app tab bar). During the WhatsApp pilot (`whatsappHref` set),
 * Orders and Account give way to Cart and a WhatsApp chat.
 */
export function MobileTabBar({ whatsappHref }: { whatsappHref: string | null }) {
  const pathname = usePathname();
  const tabs = whatsappHref
    ? [HOME, CATEGORIES, { href: "/cart", label: "Cart", Icon: CartIcon, active: (p: string) => p.startsWith("/cart") }]
    : TABS;
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-white px-3 pt-2 pb-[max(14px,env(safe-area-inset-bottom))] sm:hidden print:hidden"
    >
      {tabs.map(({ href, label, Icon, active }) => {
        const on = active(pathname);
        return (
          <Link key={href} href={href} aria-current={on ? "page" : undefined} className={tabClass(on)}>
            <Icon size={22} />
            {label}
          </Link>
        );
      })}
      {whatsappHref && (
        <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={tabClass(false)}>
          <ChatIcon size={22} />
          WhatsApp
        </a>
      )}
    </nav>
  );
}
