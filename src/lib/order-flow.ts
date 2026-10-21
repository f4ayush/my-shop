// Which status changes staff may make by hand. Payment and prescription states are driven by
// their own flows (checkout/webhooks and the Rx queue), never from the order board.

export type Status =
  | "PAYMENT_PENDING"
  | "PLACED"
  | "AWAITING_RX_REVIEW"
  | "RX_REJECTED"
  | "CONFIRMED"
  | "PACKED"
  | "READY_FOR_PICKUP"
  | "OUT_FOR_DELIVERY"
  | "COMPLETED"
  | "CANCELLED";
export type Mode = "PICKUP" | "DELIVERY";

export type StaffAction = { to: Status; label: string; danger?: boolean };

export function staffActions(status: Status, mode: Mode): StaffAction[] {
  const cancel: StaffAction = { to: "CANCELLED", label: "Cancel", danger: true };
  switch (status) {
    case "PLACED":
      return [{ to: "CONFIRMED", label: "Confirm" }, cancel];
    case "CONFIRMED":
      return [{ to: "PACKED", label: "Mark packed" }, cancel];
    case "PACKED":
      return mode === "PICKUP"
        ? [{ to: "READY_FOR_PICKUP", label: "Ready for pickup" }, cancel]
        : [{ to: "OUT_FOR_DELIVERY", label: "Out for delivery" }, cancel];
    case "READY_FOR_PICKUP":
      return [{ to: "COMPLETED", label: "Collected" }, { ...cancel, label: "Not collected — cancel" }];
    case "OUT_FOR_DELIVERY":
      return [{ to: "COMPLETED", label: "Delivered" }, { ...cancel, label: "Delivery failed — cancel" }];
    default:
      return [];
  }
}

export function canTransition(from: Status, to: Status, mode: Mode): boolean {
  return staffActions(from, mode).some((a) => a.to === to);
}

/** Customer-facing progress steps for an order, and how far along it is (-1 when it ended early). */
export function progressSteps(status: Status, mode: Mode, hasRx: boolean) {
  const steps: { key: Status; label: string }[] = [
    { key: "PLACED", label: "Placed" },
    ...(hasRx ? [{ key: "AWAITING_RX_REVIEW" as Status, label: "Prescription check" }] : []),
    { key: "CONFIRMED", label: "Confirmed" },
    { key: "PACKED", label: "Packed" },
    mode === "PICKUP"
      ? { key: "READY_FOR_PICKUP" as Status, label: "Ready for pickup" }
      : { key: "OUT_FOR_DELIVERY" as Status, label: "Out for delivery" },
    { key: "COMPLETED", label: mode === "PICKUP" ? "Collected" : "Delivered" },
  ];
  if (status === "CANCELLED" || status === "RX_REJECTED" || status === "PAYMENT_PENDING") return { steps, current: -1 };
  // An Rx order goes AWAITING_RX_REVIEW → CONFIRMED without PLACED, but "Placed" is still done.
  return { steps, current: steps.findIndex((s) => s.key === status) };
}
