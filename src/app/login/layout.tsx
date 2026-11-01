import { BrandLogo } from "@/components/BrandLogo";
import { CheckIcon } from "@/components/icons";

const PERKS = ["Saved prescriptions, private to you", "Order again from your past orders", "Order history and invoices"];

// Sign-in (and the staff second step): brand panel beside the form, no shop chrome.
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-wrap">
      <section className="flex min-w-0 flex-[1_1_480px] flex-col justify-between gap-8 bg-forest p-[clamp(24px,5vw,72px)] text-white sm:gap-12">
        <BrandLogo inverted />
        <div className="flex max-w-[520px] flex-col gap-[18px]">
          <p className="text-[clamp(32px,4.6vw,60px)] leading-[1.04] font-extrabold tracking-[-0.035em]">
            Care that keeps up with you.
          </p>
          <p className="text-[17px] leading-relaxed text-mist max-sm:hidden">
            Sign in to order again in one tap, keep your prescriptions in one place and track every order.
          </p>
        </div>
        <ul className="flex flex-col gap-3.5 text-[15px] text-[#DDF1EC] max-sm:hidden">
          {PERKS.map((p) => (
            <li key={p} className="flex items-center gap-3">
              <CheckIcon strokeWidth={2.4} />
              {p}
            </li>
          ))}
        </ul>
      </section>
      <section className="flex min-w-0 flex-[1_1_480px] items-center justify-center p-[clamp(24px,5vw,72px)]">
        <div className="w-full max-w-[420px]">{children}</div>
      </section>
    </div>
  );
}
