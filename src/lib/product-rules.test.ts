import { describe, expect, it } from "vitest";
import { activationProblems, diffProduct, productInputSchema, requiresRxFor, slugify } from "./product-rules";

const valid = {
  sku: "RX-9",
  name: "Paracetamol 650 mg Tablet",
  slug: "paracetamol-650-mg-tablet",
  composition: "Paracetamol 650 mg",
  manufacturer: "",
  packSize: "Strip of 15",
  description: "",
  categoryId: "cat1",
  schedule: "H",
  mrpPaise: "30.50",
  pricePaise: "28",
  hsnCode: "3004",
  gstRate: "12",
  isActive: true,
};

describe("productInputSchema", () => {
  it("accepts a valid product and converts rupees to paise", () => {
    const r = productInputSchema.parse(valid);
    expect(r).toMatchObject({ mrpPaise: 3050, pricePaise: 2800, gstRate: 12, manufacturer: null, description: null });
  });

  it("rejects selling above MRP", () => {
    const r = productInputSchema.safeParse({ ...valid, pricePaise: "31" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toContain("above MRP");
  });

  it("rejects invalid GST, HSN, amounts and URL names", () => {
    expect(productInputSchema.safeParse({ ...valid, gstRate: "7" }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...valid, hsnCode: "30" }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...valid, mrpPaise: "abc" }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...valid, slug: "Bad Slug!" }).success).toBe(false);
  });
});

describe("activationProblems", () => {
  it("allows a priced, categorised H item", () => {
    expect(activationProblems({ schedule: "H", pricePaise: 2800 }, "medicines")).toEqual([]);
  });

  it("blocks Schedule X, zero prices and uncategorised drafts", () => {
    expect(activationProblems({ schedule: "X", pricePaise: 0 }, "uncategorised")).toHaveLength(3);
  });
});

describe("requiresRxFor", () => {
  it("requires a prescription for every schedule except OTC", () => {
    expect(requiresRxFor("OTC")).toBe(false);
    expect(requiresRxFor("H")).toBe(true);
    expect(requiresRxFor("H1")).toBe(true);
    expect(requiresRxFor("X")).toBe(true);
  });
});

describe("slugify / diffProduct", () => {
  it("makes URL-safe names", () => {
    expect(slugify("PARACETAMOL 650 TAB, 15'S")).toBe("paracetamol-650-tab-15-s");
  });

  it("reports only changed fields", () => {
    expect(diffProduct({ pricePaise: 2800, name: "A" }, { pricePaise: 2700, name: "A" })).toEqual({
      pricePaise: { from: 2800, to: 2700 },
    });
  });
});
