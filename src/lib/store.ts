// Store pickup settings. Times are in India Standard Time (UTC+5:30, no daylight saving),
// computed explicitly so slots are right even when the server runs in UTC.

export const STORE = {
  openHour: 9,
  closeHour: 21,
  slotMinutes: 60,
  pickupDays: 3,
  /** Minimum time to pack an order before its pickup slot. */
  leadMinutes: 60,
};

const IST_OFFSET_MS = 330 * 60_000;

const slotFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export type PickupSlot = { start: Date; label: string };

export function pickupSlots(now: Date = new Date()): PickupSlot[] {
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const [y, m, d] = [istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()];
  const earliest = now.getTime() + STORE.leadMinutes * 60_000;

  const slots: PickupSlot[] = [];
  for (let day = 0; day < STORE.pickupDays; day++) {
    for (let mins = STORE.openHour * 60; mins < STORE.closeHour * 60; mins += STORE.slotMinutes) {
      const startMs = Date.UTC(y, m, d + day, 0, mins) - IST_OFFSET_MS;
      if (startMs < earliest) continue;
      const start = new Date(startMs);
      slots.push({ start, label: slotFormat.format(start) });
    }
  }
  return slots;
}

/** Finds the offered slot matching an ISO timestamp from the form, or null if it isn't (or no longer is) offered. */
export function findPickupSlot(iso: string, now: Date = new Date()): PickupSlot | null {
  return pickupSlots(now).find((s) => s.start.toISOString() === iso) ?? null;
}

/** Today's date in India as YYYY-MM-DD. */
export function todayIst(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function formatSlot(date: Date): string {
  return slotFormat.format(date);
}
