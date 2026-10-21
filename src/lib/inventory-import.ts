// Pure parsing/validation for stock files exported from any billing software.
// Columns are matched by common header names; values are validated before anything touches the database.

import { parseCsv } from "./csv";

export const MAX_IMPORT_ROWS = 20_000;
const VALID_GST_RATES = [0, 5, 12, 18, 28];

export type Field = "sku" | "name" | "batch" | "expiry" | "quantity" | "mrp" | "price" | "hsn" | "gst" | "manufacturer" | "pack";

/** Accepted header spellings, compared after lower-casing and removing non-alphanumerics. */
export const HEADER_ALIASES: Record<Field, string[]> = {
  sku: ["sku", "itemcode", "code", "productcode", "itemid", "icode"],
  name: ["name", "itemname", "productname", "item", "description", "product"],
  batch: ["batch", "batchno", "batchnumber", "batchcode"],
  expiry: ["expiry", "exp", "expirydate", "expdate", "expiry date"],
  quantity: ["qty", "quantity", "stock", "closingstock", "balance", "stockqty", "closingqty", "currentstock"],
  mrp: ["mrp"],
  price: ["rate", "price", "sellingprice", "salerate", "srate", "saleprice", "sellingrate"],
  hsn: ["hsn", "hsncode", "hsnsac"],
  gst: ["gst", "gstrate", "gstpercent", "gstper", "tax", "taxrate", "taxpercent"],
  manufacturer: ["manufacturer", "mfr", "company", "mfg", "brand", "make"],
  pack: ["pack", "packsize", "packing", "unit"],
};
export const REQUIRED: Field[] = ["sku", "batch", "expiry", "quantity"];

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

export function mapHeaders(headers: string[]): { columns: Partial<Record<Field, number>>; missing: Field[] } {
  const columns: Partial<Record<Field, number>> = {};
  headers.forEach((h, i) => {
    const n = norm(h);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [Field, string[]][]) {
      if (columns[field] === undefined && aliases.map(norm).includes(n)) columns[field] = i;
    }
  });
  return { columns, missing: REQUIRED.filter((f) => columns[f] === undefined) };
}

/**
 * Expiry as a UTC date. Accepts YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY and month-only
 * MM/YY or MM/YYYY (common on medicine packs — means the end of that month).
 */
export function parseExpiry(raw: string): Date | null {
  const s = raw.trim();
  let y: number, m: number, d: number | null;
  let match: RegExpExecArray | null;
  if ((match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) [y, m, d] = [+match[1], +match[2], +match[3]];
  else if ((match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s))) [d, m, y] = [+match[1], +match[2], +match[3]];
  else if ((match = /^(\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s))) {
    m = +match[1];
    y = match[2].length === 2 ? 2000 + +match[2] : +match[2];
    d = null;
  } else return null;

  if (m < 1 || m > 12 || y < 2000 || y > 2100) return null;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const day = d ?? lastDay;
  if (day < 1 || day > lastDay) return null;
  return new Date(Date.UTC(y, m - 1, day));
}

/** "1,234.50" or "₹ 45" → paise. Null when not a valid non-negative amount. */
export function parseRupees(raw: string): number | null {
  const s = raw.replace(/[₹,\s]/g, "").replace(/^rs\.?/i, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

export type ImportRow = {
  line: number;
  sku: string;
  name: string | null;
  batchNo: string;
  expiryDate: string; // YYYY-MM-DD
  quantity: number;
  mrpPaise: number | null;
  pricePaise: number | null;
  hsnCode: string | null;
  gstRate: number | null;
  manufacturer: string | null;
  packSize: string | null;
};
export type RowIssue = { line: number; message: string };
export type ParsedImport = {
  rows: ImportRow[];
  errors: RowIssue[];
  warnings: RowIssue[];
  missingColumns: Field[];
  totalLines: number;
};

export function parseStockFile(text: string, now: Date = new Date()): ParsedImport {
  const table = parseCsv(text);
  const [header = [], ...body] = table;
  const { columns, missing } = mapHeaders(header);
  const result: ParsedImport = { rows: [], errors: [], warnings: [], missingColumns: missing, totalLines: body.length };
  if (missing.length > 0) return result;
  if (body.length > MAX_IMPORT_ROWS) {
    result.errors.push({ line: 1, message: `Too many rows (${body.length}). The limit is ${MAX_IMPORT_ROWS} per file.` });
    return result;
  }

  const get = (cells: string[], f: Field) => {
    const i = columns[f];
    return i === undefined ? "" : (cells[i] ?? "").trim();
  };
  const seen = new Map<string, number>();
  const today = now.toISOString().slice(0, 10);

  body.forEach((cells, idx) => {
    const line = idx + 2; // 1-based, after the header
    const problems: string[] = [];

    const sku = get(cells, "sku");
    const batchNo = get(cells, "batch");
    if (!sku) problems.push("item code is empty");
    else if (sku.length > 64) problems.push("item code is too long");
    if (!batchNo) problems.push("batch is empty");
    else if (batchNo.length > 64) problems.push("batch is too long");

    const expiry = parseExpiry(get(cells, "expiry"));
    if (!expiry) problems.push(`expiry "${get(cells, "expiry")}" isn't a date (use DD/MM/YYYY or MM/YYYY)`);

    const qtyRaw = get(cells, "quantity").replace(/,/g, "");
    const quantity = /^\d+(\.0+)?$/.test(qtyRaw) ? Math.trunc(Number(qtyRaw)) : NaN;
    if (!Number.isFinite(quantity)) problems.push(`quantity "${get(cells, "quantity")}" must be a whole number ≥ 0`);

    const mrpRaw = get(cells, "mrp");
    const priceRaw = get(cells, "price");
    const mrpPaise = mrpRaw ? parseRupees(mrpRaw) : null;
    const pricePaise = priceRaw ? parseRupees(priceRaw) : null;
    if (mrpRaw && mrpPaise === null) problems.push(`MRP "${mrpRaw}" isn't an amount`);
    if (priceRaw && pricePaise === null) problems.push(`rate "${priceRaw}" isn't an amount`);
    // Selling above MRP is illegal in India.
    if (mrpPaise !== null && pricePaise !== null && pricePaise > mrpPaise) problems.push("selling rate is above MRP");

    const gstRaw = get(cells, "gst").replace("%", "");
    const gstRate = gstRaw ? Number(gstRaw) : null;
    if (gstRate !== null && !VALID_GST_RATES.includes(gstRate)) problems.push(`GST "${get(cells, "gst")}" isn't a valid GST rate`);

    const key = `${sku.toLowerCase()}|${batchNo.toLowerCase()}`;
    if (sku && batchNo && seen.has(key)) problems.push(`same item and batch as line ${seen.get(key)}`);
    else if (sku && batchNo) seen.set(key, line);

    if (problems.length > 0) {
      result.errors.push({ line, message: problems.join("; ") });
      return;
    }

    const expiryDate = expiry!.toISOString().slice(0, 10);
    if (expiryDate <= today && quantity > 0) {
      result.warnings.push({ line, message: `batch ${batchNo} of ${sku} has expired — it won't be sold` });
    }
    result.rows.push({
      line,
      sku,
      name: get(cells, "name").slice(0, 200) || null,
      batchNo,
      expiryDate,
      quantity,
      mrpPaise,
      pricePaise,
      hsnCode: get(cells, "hsn").slice(0, 16) || null,
      gstRate,
      manufacturer: get(cells, "manufacturer").slice(0, 120) || null,
      packSize: get(cells, "pack").slice(0, 60) || null,
    });
  });
  return result;
}
