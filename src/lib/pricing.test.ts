import { describe, expect, it } from "vitest";
import { includedGstPaise, orderTotals } from "./pricing";

describe("includedGstPaise", () => {
  it("extracts GST contained in an inclusive price", () => {
    expect(includedGstPaise(10500, 5)).toBe(500); // ₹105 at 5% → ₹5
    expect(includedGstPaise(11800, 18)).toBe(1800);
  });

  it("is zero for zero-rated items", () => {
    expect(includedGstPaise(10000, 0)).toBe(0);
  });

  it("rounds to the nearest paisa", () => {
    expect(includedGstPaise(2300, 5)).toBe(110); // 109.52 → 110
  });
});

describe("orderTotals", () => {
  it("sums inclusive lines and adds the delivery fee on top", () => {
    const totals = orderTotals(
      [
        { unitPricePaise: 2300, quantity: 2, gstRate: 5 },
        { unitPricePaise: 19900, quantity: 1, gstRate: 18 },
      ],
      3000,
    );
    expect(totals.subtotalPaise).toBe(24500);
    expect(totals.gstPaise).toBe(219 + 3036);
    expect(totals.deliveryFeePaise).toBe(3000);
    expect(totals.totalPaise).toBe(27500);
  });

  it("handles an empty order", () => {
    expect(orderTotals([], 0)).toEqual({ subtotalPaise: 0, gstPaise: 0, deliveryFeePaise: 0, totalPaise: 0 });
  });
});
