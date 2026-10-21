import { PrescriptionStatus } from "@/generated/prisma/enums";

export const RX_STATUS_LABEL: Record<PrescriptionStatus, string> = {
  PENDING: "Awaiting pharmacist check",
  APPROVED: "Verified",
  REJECTED: "Not accepted",
};

export const RX_STATUS_STYLE: Record<PrescriptionStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};
