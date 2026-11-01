import type { Metadata } from "next";
import Link from "next/link";
import { logoutAction } from "@/app/login/actions";
import { ChevronRightIcon, FileIcon, GridIcon, TruckIcon, UserIcon } from "@/components/icons";
import { btn, card, pageTitle } from "@/components/ui";
import { isStaff, requireUser } from "@/lib/auth/session";
import { maskPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };

export default async function AccountPage() {
  const user = await requireUser("/account");
  const links = [
    { href: "/account/orders", label: "My orders", text: "Track orders, invoices and order again", Icon: TruckIcon },
    { href: "/account/prescriptions", label: "My prescriptions", text: "Upload and view your prescriptions", Icon: FileIcon },
    ...(isStaff(user) ? [{ href: "/admin", label: "Admin", text: "Orders, Rx queue, products and stock", Icon: GridIcon }] : []),
  ];

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex items-center gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-mint text-brand-dark">
          <UserIcon size={26} />
        </span>
        <div className="flex flex-col">
          <h1 className={pageTitle}>Your account</h1>
          <span className="text-muted">{user.name ? `${user.name} · ` : ""}{maskPhone(user.phone)}</span>
        </div>
      </div>
      <ul className={`${card} px-4 sm:px-5`}>
        {links.map(({ href, label, text, Icon }) => (
          <li key={href} className="border-t border-line first:border-t-0">
            <Link href={href} className="flex items-center gap-3.5 py-4 text-ink hover:text-ink">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-field text-ink">
                <Icon />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <strong className="text-base">{label}</strong>
                <span className="text-[13px] text-muted">{text}</span>
              </span>
              <ChevronRightIcon size={18} className="text-muted" />
            </Link>
          </li>
        ))}
      </ul>
      <form action={logoutAction}>
        <button className={btn("outline")}>Log out</button>
      </form>
    </section>
  );
}
