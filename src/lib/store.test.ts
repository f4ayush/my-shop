import { describe, expect, it } from "vitest";
import { findPickupSlot, pickupSlots, STORE, todayIst } from "./store";

describe("todayIst", () => {
  it("uses the Indian date, which runs ahead of UTC", () => {
    expect(todayIst(new Date("2026-10-20T19:00:00Z"))).toBe("2026-10-21"); // 00:30 IST next day
    expect(todayIst(new Date("2026-10-20T18:00:00Z"))).toBe("2026-10-20"); // 23:30 IST
  });
});

// 2026-10-20 08:00 IST = 02:30 UTC
const morningIst = new Date("2026-10-20T02:30:00Z");

describe("pickupSlots", () => {
  it("starts at the first slot after the lead time, in IST", () => {
    const slots = pickupSlots(morningIst);
    // 08:00 + 60 min lead → first slot is 09:00 IST (opening) = 03:30 UTC
    expect(slots[0].start.toISOString()).toBe("2026-10-20T03:30:00.000Z");
  });

  it("offers every slot between opening and closing for each pickup day", () => {
    const perDay = ((STORE.closeHour - STORE.openHour) * 60) / STORE.slotMinutes;
    expect(pickupSlots(morningIst)).toHaveLength(perDay * STORE.pickupDays);
  });

  it("skips slots that are too soon late in the day", () => {
    // 20:30 IST: today's last slot (20:00) has passed, so the first slot is tomorrow 09:00 IST
    const lateIst = new Date("2026-10-20T15:00:00Z");
    expect(pickupSlots(lateIst)[0].start.toISOString()).toBe("2026-10-21T03:30:00.000Z");
  });

  it("labels slots in IST", () => {
    expect(pickupSlots(morningIst)[0].label).toMatch(/9:00\s?am/i);
  });
});

describe("findPickupSlot", () => {
  it("accepts an offered slot and rejects anything else", () => {
    expect(findPickupSlot("2026-10-20T03:30:00.000Z", morningIst)).not.toBeNull();
    expect(findPickupSlot("2026-10-20T03:45:00.000Z", morningIst)).toBeNull();
    expect(findPickupSlot("not-a-date", morningIst)).toBeNull();
  });
});
