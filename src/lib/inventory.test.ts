import { describe, expect, it } from "vitest";
import { allocateFefo } from "./inventory";

describe("allocateFefo", () => {
  const batches = [
    { id: "soonest", available: 3 },
    { id: "later", available: 5 },
  ];

  it("takes from the soonest-expiring batch first", () => {
    expect(allocateFefo(batches, 2)).toEqual([{ batchId: "soonest", quantity: 2 }]);
  });

  it("spills over into later batches", () => {
    expect(allocateFefo(batches, 6)).toEqual([
      { batchId: "soonest", quantity: 3 },
      { batchId: "later", quantity: 3 },
    ]);
  });

  it("returns null when total stock is insufficient", () => {
    expect(allocateFefo(batches, 9)).toBeNull();
  });

  it("skips empty and over-reserved batches", () => {
    expect(
      allocateFefo(
        [
          { id: "empty", available: 0 },
          { id: "over", available: -2 },
          { id: "ok", available: 4 },
        ],
        4,
      ),
    ).toEqual([{ batchId: "ok", quantity: 4 }]);
  });
});
