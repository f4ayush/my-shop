// All prices are stored as integer paise to avoid floating-point rounding.
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

export function formatPaise(paise: number): string {
  return inr.format(paise / 100);
}

const inrWhole = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

/** Shop-front price: "₹30" for whole rupees, "₹30.50" otherwise. Invoices keep formatPaise. */
export function formatPrice(paise: number): string {
  return paise % 100 === 0 ? inrWhole.format(paise / 100) : inr.format(paise / 100);
}

/** Whole-number discount off MRP, or 0 when there is none. */
export function discountPercent(mrpPaise: number, pricePaise: number): number {
  if (mrpPaise <= 0 || pricePaise >= mrpPaise) return 0;
  return Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100);
}
