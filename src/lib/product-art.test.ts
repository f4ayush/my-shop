import { describe, expect, it } from "vitest";
import { ART_TONES, artKind, artTone } from "./product-art";

describe("artKind", () => {
  it("reads the pack size", () => {
    expect(artKind("Strip of 15 tablets")).toBe("tablets");
    expect(artKind("Strip of 10 capsules")).toBe("capsules");
    expect(artKind("Bottle of 500 ml")).toBe("bottle");
    expect(artKind("200 ml bottle")).toBe("bottle");
    expect(artKind("Bottle of 60 softgels")).toBe("bottle");
  });

  it("treats a container of tablets as a bottle", () => {
    expect(artKind("Bottle of 30 tablets")).toBe("bottle");
  });

  it("falls back for anything else", () => {
    expect(artKind("1 roll")).toBe("other");
    expect(artKind("Sachet of 21 g")).toBe("other");
    expect(artKind(null)).toBe("other");
  });
});

describe("artTone", () => {
  it("is stable for the same key", () => {
    expect(artTone("prod_123")).toEqual(artTone("prod_123"));
  });

  it("always returns one of the design's tones", () => {
    for (const key of ["a", "b", "cmabc123", "", "x".repeat(200)]) {
      expect(ART_TONES).toContainEqual(artTone(key));
    }
  });

  it("spreads keys across tones", () => {
    const used = new Set(Array.from({ length: 50 }, (_, i) => artTone(`p${i}`).tint));
    expect(used.size).toBeGreaterThan(3);
  });
});
