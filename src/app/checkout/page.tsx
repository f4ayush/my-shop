import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getCartView } from "@/lib/cart";
import { PrescriptionUploadForm } from "@/components/PrescriptionUploadForm";
import { formatOrderDate } from "@/lib/orders";
import { RX_STATUS_LABEL } from "@/lib/rx/labels";
import { usablePrescriptions } from "@/lib/rx/prescriptions";
import { onlinePaymentsEnabled } from "@/lib/payments/razorpay";
import { pickupSlots } from "@/lib/store";
import { CheckoutForm, type AddressOption } from "./CheckoutForm";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const user = await requireUser("/checkout");
  const cart = await getCartView();
  if (cart.lines.length === 0 || cart.hasIssues) redirect("/cart");

  const [addresses, prescriptions] = await Promise.all([
    db.address.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    cart.hasRxItems ? usablePrescriptions(user.id) : Promise.resolve([]),
  ]);
  const areas = await db.serviceArea.findMany({
    where: { isActive: true, pincode: { in: addresses.map((a) => a.pincode) } },
  });
  const feeByPincode = new Map(areas.map((a) => [a.pincode, a.deliveryFeePaise]));

  const addressOptions: AddressOption[] = addresses.map((a) => ({
    id: a.id,
    summary: [a.label && `${a.label}:`, a.line1, a.line2, a.landmark, `${a.city}, ${a.state} ${a.pincode}`]
      .filter(Boolean)
      .join(" "),
    deliveryFeePaise: feeByPincode.get(a.pincode) ?? null,
  }));

  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Checkout</h1>
        <Link href="/cart" className="text-sm text-brand hover:underline">
          ← Back to cart ({cart.itemCount} items)
        </Link>
      </div>
      <CheckoutForm
        subtotalPaise={cart.subtotalPaise}
        addresses={addressOptions}
        slots={pickupSlots().map((s) => ({ value: s.start.toISOString(), label: s.label }))}
        rxItems={cart.lines.filter((l) => l.requiresRx).map((l) => l.name)}
        prescriptions={prescriptions.map((p) => ({
          id: p.id,
          label: `Uploaded ${formatOrderDate(p.createdAt)}${p.doctorName ? ` · Dr. ${p.doctorName}` : ""}`,
          status: RX_STATUS_LABEL[p.status],
        }))}
        prescriptionUpload={<PrescriptionUploadForm />}
        onlineEnabled={onlinePaymentsEnabled()}
      />
    </section>
  );
}
