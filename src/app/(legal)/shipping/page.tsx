import type { Metadata } from "next";
import { db } from "@/lib/db";
import { formatPaise } from "@/lib/money";
import { STORE } from "@/lib/store";
import { Fill } from "../fill";

export const metadata: Metadata = { title: "Delivery & pickup" };

export default async function ShippingPage() {
  const areas = await db.serviceArea.findMany({ where: { isActive: true }, orderBy: { pincode: "asc" } });
  const hour = (h: number) => `${h % 12 || 12}:00 ${h < 12 ? "am" : "pm"}`;

  return (
    <>
      <h1>Delivery &amp; pickup</h1>

      <h2>Store pickup</h2>
      <p>
        Choose a pickup slot at checkout. The store is open {hour(STORE.openHour)}–{hour(STORE.closeHour)}, and you can book
        up to {STORE.pickupDays} days ahead. Bring your order number. Pickup is free.
      </p>

      <h2>Home delivery</h2>
      <p>
        We deliver only within our local area, from our licensed store. Delivery usually takes{" "}
        <Fill value={null} placeholder="e.g. same day if ordered before 5 pm" />. Prescription orders are dispatched only after
        our pharmacist has verified the prescription.
      </p>
      {areas.length > 0 && (
        <table className="mb-3 w-full max-w-sm text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="py-1 font-normal">Pincode</th>
              <th className="py-1 font-normal">Area</th>
              <th className="py-1 text-right font-normal">Delivery fee</th>
            </tr>
          </thead>
          <tbody>
            {areas.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="py-1">{a.pincode}</td>
                <td className="py-1">{a.area ?? "—"}</td>
                <td className="py-1 text-right">{a.deliveryFeePaise === 0 ? "Free" : formatPaise(a.deliveryFeePaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p>
        Someone aged 18 or over should receive prescription medicines. If nobody is available we’ll contact you to
        rearrange; repeated failed deliveries may lead to the order being cancelled and refunded.
      </p>

      <h2>Order updates</h2>
      <p>We’ll text you when your order is confirmed, ready for pickup or out for delivery, and when it’s complete.</p>
    </>
  );
}
