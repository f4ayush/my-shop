// Shared Tailwind class strings for the storefront design, so buttons and cards stay consistent.

export const container = "mx-auto w-full max-w-[1280px] px-[clamp(16px,4vw,40px)]";

export const card = "rounded-3xl border border-line bg-white";

const BUTTON_TONES = {
  primary: "bg-brand text-white hover:bg-brand-dark hover:text-white",
  dark: "bg-ink text-white hover:bg-black hover:text-white",
  outline: "border border-line-strong bg-white text-ink hover:border-ink hover:text-ink",
  /** On the dark forest panels. */
  light: "bg-white text-forest hover:bg-mint hover:text-forest",
};
const BUTTON_SIZES = {
  sm: "h-11 rounded-xl px-4 text-sm",
  md: "h-12 rounded-[14px] px-6 text-[15px]",
  /** Full-width call to action (place order, send code, add to cart). */
  lg: "h-14 w-full rounded-2xl px-6 text-base",
};

export function btn(tone: keyof typeof BUTTON_TONES, size: keyof typeof BUTTON_SIZES = "md"): string {
  return `inline-flex items-center justify-center gap-2 font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${BUTTON_SIZES[size]} ${BUTTON_TONES[tone]}`;
}

export const field =
  "h-12 w-full rounded-xl border border-line-strong bg-white px-3.5 text-[15px] text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

export const pageTitle = "text-[clamp(30px,3.6vw,44px)] leading-[1.05] font-extrabold tracking-[-0.03em]";
export const sectionTitle = "text-[clamp(28px,3.4vw,40px)] leading-[1.1] font-extrabold tracking-[-0.03em]";

export const errorBox = "rounded-xl bg-red-50 p-3 text-sm text-red-800";
