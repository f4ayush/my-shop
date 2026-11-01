"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GridIcon, HomeIcon, TruckIcon, UserIcon } from "./icons";

const TABS = [
  { href: "/", label: "Home", Icon: HomeIcon, active: (p: string) => p === "/" },
  {
    href: "/search",
    label: "Categories",
    Icon: GridIcon,
    active: (p: string) => p.startsWith("/search") || p.startsWith("/category") || p.startsWith("/product"),
  },
  { href: "/account/orders", label: "Orders", Icon: TruckIcon, active: (p: string) => p.startsWith("/account/orders") },
  {
    href: "/account",
    label: "Account",
    Icon: UserIcon,
    active: (p: string) => p === "/account" || p.startsWith("/account/prescriptions"),
  },
];

/** Phone-only bottom navigation (the design's app tab bar). */
export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-white px-3 pt-2 pb-[max(14px,env(safe-area-inset-bottom))] sm:hidden print:hidden"
    >
      {TABS.map(({ href, label, Icon, active }) => {
        const on = active(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            className={`flex min-h-12 flex-col items-center justify-center gap-1 text-[11px] ${on ? "font-bold text-brand" : "font-semibold text-muted"}`}
          >
            <Icon size={22} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
