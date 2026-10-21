import { describe, expect, it } from "vitest";
import { canTransition, progressSteps, staffActions } from "./order-flow";

describe("staffActions / canTransition", () => {
  it("walks a pickup order through to collection", () => {
    expect(canTransition("PLACED", "CONFIRMED", "PICKUP")).toBe(true);
    expect(canTransition("CONFIRMED", "PACKED", "PICKUP")).toBe(true);
    expect(canTransition("PACKED", "READY_FOR_PICKUP", "PICKUP")).toBe(true);
    expect(canTransition("READY_FOR_PICKUP", "COMPLETED", "PICKUP")).toBe(true);
  });

  it("sends delivery orders out for delivery instead of to the counter", () => {
    expect(canTransition("PACKED", "OUT_FOR_DELIVERY", "DELIVERY")).toBe(true);
    expect(canTransition("PACKED", "READY_FOR_PICKUP", "DELIVERY")).toBe(false);
    expect(canTransition("PACKED", "OUT_FOR_DELIVERY", "PICKUP")).toBe(false);
  });

  it("doesn't allow skipping steps or reopening finished orders", () => {
    expect(canTransition("PLACED", "COMPLETED", "PICKUP")).toBe(false);
    expect(canTransition("COMPLETED", "CANCELLED", "PICKUP")).toBe(false);
    expect(canTransition("CANCELLED", "PLACED", "PICKUP")).toBe(false);
  });

  it("leaves payment and prescription states to their own flows", () => {
    for (const s of ["PAYMENT_PENDING", "AWAITING_RX_REVIEW", "RX_REJECTED"] as const) {
      expect(staffActions(s, "DELIVERY")).toEqual([]);
    }
  });

  it("allows cancelling any active order", () => {
    for (const s of ["PLACED", "CONFIRMED", "PACKED", "READY_FOR_PICKUP"] as const) {
      expect(canTransition(s, "CANCELLED", "PICKUP")).toBe(true);
    }
  });
});

describe("progressSteps", () => {
  it("includes the prescription check only for Rx orders", () => {
    expect(progressSteps("PLACED", "PICKUP", false).steps.map((s) => s.key)).not.toContain("AWAITING_RX_REVIEW");
    expect(progressSteps("CONFIRMED", "PICKUP", true).steps.map((s) => s.key)).toContain("AWAITING_RX_REVIEW");
  });

  it("points at the current step", () => {
    const p = progressSteps("OUT_FOR_DELIVERY", "DELIVERY", false);
    expect(p.steps[p.current].key).toBe("OUT_FOR_DELIVERY");
  });

  it("hides progress for orders that ended early", () => {
    expect(progressSteps("CANCELLED", "PICKUP", false).current).toBe(-1);
    expect(progressSteps("RX_REJECTED", "PICKUP", true).current).toBe(-1);
  });
});
