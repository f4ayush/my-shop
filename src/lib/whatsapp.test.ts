import { describe, expect, it } from "vitest";
import { orderMessage, waMeLink, whatsappNumberFromEnv } from "./whatsapp";

describe("whatsappNumberFromEnv", () => {
  it("is off when unset or blank", () => {
    expect(whatsappNumberFromEnv(undefined)).toBeNull();
    expect(whatsappNumberFromEnv("  ")).toBeNull();
  });

  it("normalises an Indian mobile for wa.me", () => {
    expect(whatsappNumberFromEnv("+91 98765 43210")).toBe("919876543210");
    expect(whatsappNumberFromEnv("09876543210")).toBe("919876543210");
  });

  it("refuses anything else", () => {
    expect(() => whatsappNumberFromEnv("12345")).toThrow(/WHATSAPP_ORDER_NUMBER/);
  });
});

const line = (name: string, quantity: number, lineTotalPaise: number, packSize: string | null = null) => ({
  name,
  packSize,
  quantity,
  lineTotalPaise,
  issue: null,
});

describe("orderMessage", () => {
  it("lists each line with pack size, quantity and price, then the total", () => {
    const text = orderMessage({
      lines: [line("Dolo 650", 2, 6000, "15 tablets"), line("ORS sachet", 1, 2250)],
      subtotalPaise: 8250,
      hasRxItems: false,
    });
    expect(text).toBe(
      [
        "Hi Raj Healthcares, I'd like to order:",
        "",
        "1. Dolo 650 (15 tablets) × 2 — ₹60",
        "2. ORS sachet × 1 — ₹22.50",
        "",
        "Estimated total: ₹82.50",
      ].join("\n"),
    );
  });

  it("asks for the prescription only when an item needs one", () => {
    const cart = { lines: [line("Azithral 500", 1, 11900)], subtotalPaise: 11900 };
    expect(orderMessage({ ...cart, hasRxItems: true })).toMatch(/I'll send my prescription in this chat\.$/);
    expect(orderMessage({ ...cart, hasRxItems: false })).not.toMatch(/prescription/);
  });

  it("leaves out lines that can't be ordered", () => {
    const text = orderMessage({
      lines: [{ ...line("Gone", 1, 500), issue: "unavailable" as const }, line("Dolo 650", 1, 3000)],
      subtotalPaise: 3000,
      hasRxItems: false,
    });
    expect(text).not.toMatch(/Gone/);
    expect(text).toMatch(/^1\. Dolo 650/m);
  });
});

describe("waMeLink", () => {
  it("encodes the message", () => {
    expect(waMeLink("919876543210", "Hi & bye\n1. A × 2")).toBe(
      "https://wa.me/919876543210?text=Hi%20%26%20bye%0A1.%20A%20%C3%97%202",
    );
  });
});
