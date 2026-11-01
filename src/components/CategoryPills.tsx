import Link from "next/link";
import { CrossIcon, GridIcon, LeafIcon, PillIcon, SunIcon, ThermometerIcon } from "./icons";

// Icons for the store's categories; any other category gets the grid icon.
const ICONS: Record<string, typeof GridIcon> = {
  medicines: PillIcon,
  wellness: SunIcon,
  "personal-care": LeafIcon,
  devices: ThermometerIcon,
  "first-aid": CrossIcon,
};

type Props = {
  categories: { name: string; slug: string }[];
  /** Slug of the selected category; null for "All". */
  active: string | null;
  /** "filter": home page, filters the product list in place. "navigate": category pages. */
  mode: "filter" | "navigate";
};

export function CategoryPills({ categories, active, mode }: Props) {
  const items = [
    { slug: null, name: "All", href: mode === "filter" ? "/" : "/search" },
    ...categories.map((c) => ({
      slug: c.slug,
      name: c.name,
      href: mode === "filter" ? `/?category=${encodeURIComponent(c.slug)}` : `/category/${c.slug}`,
    })),
  ];
  return (
    <nav aria-label="Categories" className="-mx-[clamp(16px,4vw,40px)] overflow-x-auto px-[clamp(16px,4vw,40px)] pb-1 [scrollbar-width:none]">
      <ul className="flex gap-2.5 sm:gap-3">
        {items.map(({ slug, name, href }) => {
          const on = slug === active;
          const Icon = slug ? (ICONS[slug] ?? GridIcon) : GridIcon;
          return (
            <li key={slug ?? "all"} className="flex-none">
              <Link
                href={href}
                scroll={mode === "navigate"}
                aria-current={on ? "page" : undefined}
                className={`flex h-11 items-center gap-2.5 rounded-full border px-4 text-sm font-semibold whitespace-nowrap sm:h-[52px] sm:rounded-2xl sm:pr-5 sm:pl-3.5 sm:text-[15px] ${
                  on
                    ? "border-ink bg-ink text-white hover:text-white sm:border-brand sm:bg-brand"
                    : "border-line-strong bg-white text-ink hover:border-brand hover:text-ink"
                }`}
              >
                <Icon className="max-sm:hidden" />
                {name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
