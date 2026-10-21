// All prices are stored as integer paise to avoid floating-point rounding.
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

export function formatPaise(paise: number): string {
  return inr.format(paise / 100);
}

/** Whole-number discount off MRP, or 0 when there is none. */
export function discountPercent(mrpPaise: number, pricePaise: number): number {
  if (mrpPaise <= 0 || pricePaise >= mrpPaise) return 0;
  return Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100);
}
