import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import { PlusIcon } from "./icons";

/** Logo tile + name. `inverted` is for dark backgrounds (sign-in panel). */
export function BrandLogo({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link
      href="/"
      className={`flex shrink-0 items-center gap-2.5 ${inverted ? "text-white hover:text-white" : "text-ink hover:text-ink"}`}
    >
      <span
        className={`flex size-[38px] items-center justify-center rounded-xl ${inverted ? "bg-white text-forest" : "bg-brand text-white"}`}
      >
        <PlusIcon size={22} strokeWidth={2.2} />
      </span>
      <span className="text-[22px] font-extrabold tracking-[-0.02em]">{BRAND_NAME}</span>
    </Link>
  );
}
