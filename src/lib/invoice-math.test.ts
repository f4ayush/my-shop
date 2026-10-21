import { describe, expect, it } from "vitest";
import { financialYear, formatInvoiceNumber, splitInclusiveGst } from "./invoice-math";

describe("financialYear", () => {
  it("runs April to March in IST", () => {
    expect(financialYear(new Date("2026-10-21T10:00:00Z"))).toBe("26-27");
    expect(financialYear(new Date("2027-03-31T18:00:00Z"))).toBe("26-27"); // 23:30 IST, 31 Mar
    expect(financialYear(new Date("2027-03-31T18:30:00Z"))).toBe("27-28"); // 00:00 IST, 1 Apr
    expect(financialYear(new Date("2099-06-01T00:00:00Z"))).toBe("99-00");
  });
});

describe("formatInvoiceNumber", () => {
  it("is zero-padded and within GST's 16-character limit", () => {
    const n = formatInvoiceNumber("26-27", 123);
    expect(n).toBe("MP/26-27/000123");
    expect(n.length).toBeLessThanOrEqual(16);
  });
});

describe("splitInclusiveGst", () => {
  it("splits 5% GST into equal CGST/SGST halves", () => {
    expect(splitInclusiveGst(10500, 5)).toEqual({ taxablePaise: 10000, cgstPaise: 250, sgstPaise: 250 });
  });

  it("always adds back up to the inclusive amount", () => {
    for (const [amount, rate] of [[2300, 5], [19900, 18], [4601, 12], [1, 5], [9999, 28]] as const) {
      const s = splitInclusiveGst(amount, rate);
      expect(s.taxablePaise + s.cgstPaise + s.sgstPaise).toBe(amount);
      expect(Math.abs(s.cgstPaise - s.sgstPaise)).toBeLessThanOrEqual(1);
    }
  });

  it("handles zero-rated items", () => {
    expect(splitInclusiveGst(5000, 0)).toEqual({ taxablePaise: 5000, cgstPaise: 0, sgstPaise: 0 });
  });
});
