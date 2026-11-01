import { describe, expect, it } from "vitest";
import { discountPercent, formatPaise, formatPrice } from "./money";

describe("formatPrice", () => {
  it("drops paise for whole rupees", () => {
    expect(formatPrice(3000)).toBe("₹30");
    expect(formatPrice(123400)).toBe("₹1,234");
  });

  it("keeps two decimals otherwise", () => {
    expect(formatPrice(3050)).toBe("₹30.50");
    expect(formatPrice(5)).toBe("₹0.05");
  });

  it("leaves formatPaise unchanged for invoices", () => {
    expect(formatPaise(3000)).toBe("₹30.00");
  });
});

describe("discountPercent", () => {
  it("rounds the saving off MRP", () => {
    expect(discountPercent(9500, 8600)).toBe(9);
  });

  it("is 0 without a discount", () => {
    expect(discountPercent(9500, 9500)).toBe(0);
    expect(discountPercent(0, 100)).toBe(0);
  });
});
