import type { Metadata } from "next";
import Link from "next/link";
import { Fill } from "../fill";

export const metadata: Metadata = { title: "Returns & refunds" };

export default function ReturnsPage() {
  return (
    <>
      <h1>Returns &amp; refunds</h1>

      <h2>What we can take back</h2>
      <p>
        For your safety, medicines can’t be returned once they’ve left the store, except when there is a problem on our side.
        Tell us within <Fill value={null} placeholder="e.g. 48 hours" /> of delivery or pickup if you received:
      </p>
      <ul>
        <li>a wrong item or quantity;</li>
        <li>a damaged, tampered or leaking item;</li>
        <li>an item that is expired or expires before <Fill value={null} placeholder="minimum shelf life you guarantee" />.</li>
      </ul>
      <p>
        Keep the item in its original packaging with the invoice. Fridge items and opened packs can only be accepted if the
        problem was ours.
      </p>

      <h2>Refunds</h2>
      <ul>
        <li>Online payments are refunded in full to the original payment method when we cancel an order, a prescription isn’t accepted, or a return is approved.</li>
        <li>Refunds usually reach you in 5–7 working days, depending on your bank.</li>
        <li>Cash payments are refunded in cash at the store or by <Fill value={null} placeholder="refund method" />.</li>
      </ul>

      <h2>Cancelling an order</h2>
      <p>
        Contact us before your order is packed to cancel it. See <Link href="/grievance">Contact &amp; grievances</Link>.
      </p>
    </>
  );
}
