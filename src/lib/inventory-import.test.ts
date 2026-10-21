import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";
import { mapHeaders, parseExpiry, parseRupees, parseStockFile } from "./inventory-import";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, embedded commas/newlines, CRLF and a BOM", () => {
    const text = '﻿code,name\r\n"A1","Tab, ""Strong""\nx"\r\nB2,Plain\r\n\r\n';
    expect(parseCsv(text)).toEqual([
      ["code", "name"],
      ["A1", 'Tab, "Strong"\nx'],
      ["B2", "Plain"],
    ]);
  });

  it("detects semicolon and tab delimiters", () => {
    expect(parseCsv("a;b\n1;2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv("a\tb\n1\t2")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("mapHeaders", () => {
  it("recognises common billing-software column names", () => {
    const { columns, missing } = mapHeaders(["Item Code", "Item Name", "Batch No.", "Exp. Date", "Closing Stock", "M.R.P.", "Sale Rate", "GST %"]);
    expect(missing).toEqual([]);
    expect(columns).toMatchObject({ sku: 0, name: 1, batch: 2, expiry: 3, quantity: 4, mrp: 5, price: 6, gst: 7 });
  });

  it("reports missing required columns", () => {
    expect(mapHeaders(["Item Code", "Qty"]).missing).toEqual(["batch", "expiry"]);
  });
});

describe("parseExpiry", () => {
  const iso = (s: string) => parseExpiry(s)?.toISOString().slice(0, 10) ?? null;
  it("accepts full dates in Indian and ISO formats", () => {
    expect(iso("2027-03-15")).toBe("2027-03-15");
    expect(iso("15/03/2027")).toBe("2027-03-15");
    expect(iso("15-03-2027")).toBe("2027-03-15");
  });
  it("treats month-only expiry as the end of that month", () => {
    expect(iso("02/28")).toBe("2028-02-29"); // leap year
    expect(iso("11/2027")).toBe("2027-11-30");
  });
  it("rejects impossible dates", () => {
    expect(iso("31/02/2027")).toBeNull();
    expect(iso("13/27")).toBeNull();
    expect(iso("soon")).toBeNull();
  });
});

describe("parseRupees", () => {
  it("parses rupee amounts to paise", () => {
    expect(parseRupees("1,234.50")).toBe(123450);
    expect(parseRupees("₹ 45")).toBe(4500);
    expect(parseRupees("Rs.12.5")).toBe(1250);
  });
  it("rejects negatives, extra decimals and text", () => {
    expect(parseRupees("-5")).toBeNull();
    expect(parseRupees("1.234")).toBeNull();
    expect(parseRupees("abc")).toBeNull();
  });
});

describe("parseStockFile", () => {
  const now = new Date("2026-10-22T00:00:00Z");
  const header = "Item Code,Item Name,Batch,Expiry,Qty,MRP,Rate,GST\n";

  it("returns valid rows and line-numbered errors", () => {
    const r = parseStockFile(
      header +
        "OTC-001,ORS,B9,12/2027,40,25,23,5\n" +
        "OTC-002,Vit C,B1,15/13/2027,10,120,108,5\n" + // bad expiry
        "OTC-003,Sanitizer,B1,12/2027,5,100,120,18\n" + // above MRP
        "OTC-004,Thermo,B1,12/2027,2.5,350,299,5\n" + // fractional qty
        "OTC-005,Bandage,B1,12/2027,5,110,95,7\n" + // invalid GST
        "OTC-001,ORS,b9,12/2027,1,25,23,5\n", // duplicate item+batch
      now,
    );
    expect(r.rows.map((x) => x.sku)).toEqual(["OTC-001"]);
    expect(r.rows[0]).toMatchObject({ batchNo: "B9", expiryDate: "2027-12-31", quantity: 40, mrpPaise: 2500, pricePaise: 2300, gstRate: 5 });
    expect(r.errors.map((e) => e.line)).toEqual([3, 4, 5, 6, 7]);
    expect(r.errors[1].message).toContain("above MRP");
    expect(r.errors[4].message).toContain("line 2");
  });

  it("warns about expired stock but still imports it", () => {
    const r = parseStockFile(header + "OTC-001,ORS,OLD,01/2026,3,25,23,5\n", now);
    expect(r.rows).toHaveLength(1);
    expect(r.warnings[0].message).toContain("expired");
  });

  it("stops early when required columns are missing", () => {
    const r = parseStockFile("Code,Qty\nA,1\n", now);
    expect(r.missingColumns).toEqual(["batch", "expiry"]);
    expect(r.rows).toEqual([]);
  });
});
