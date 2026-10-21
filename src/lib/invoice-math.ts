// Pure GST invoice helpers. Prices are GST-inclusive; the store sells within its own state,
// so tax splits equally into CGST + SGST (inter-state IGST isn't supported yet).

const IST_OFFSET_MS = 330 * 60_000;

/** Indian financial year (April–March) for a date, as "26-27". */
export function financialYear(date: Date): string {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const year = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? year : year - 1; // April = month 3
  const yy = (n: number) => String(n % 100).padStart(2, "0");
  return `${yy(start)}-${yy(start + 1)}`;
}

/** "MP/26-27/000123" — 15 characters (GST allows up to 16). */
export function formatInvoiceNumber(fy: string, n: number): string {
  return `MP/${fy}/${String(n).padStart(6, "0")}`;
}

export type GstSplit = { taxablePaise: number; cgstPaise: number; sgstPaise: number };

/** Splits a GST-inclusive amount into taxable value + CGST + SGST, summing exactly to the input. */
export function splitInclusiveGst(inclusivePaise: number, ratePercent: number): GstSplit {
  const taxablePaise = Math.round((inclusivePaise * 100) / (100 + ratePercent));
  const tax = inclusivePaise - taxablePaise;
  const cgstPaise = Math.floor(tax / 2);
  return { taxablePaise, cgstPaise, sgstPaise: tax - cgstPaise };
}
