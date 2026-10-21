import type { Metadata } from "next";
import Link from "next/link";
import { BUSINESS } from "@/lib/business";
import { Fill } from "../fill";

export const metadata: Metadata = { title: "Terms of use" };

export default function TermsPage() {
  return (
    <>
      <h1>Terms of use</h1>
      <p className="text-slate-500">Last updated: <Fill value={null} placeholder="date" /></p>

      <h2>Who we are</h2>
      <p>
        This website is operated by {BUSINESS.legalName}, a retail pharmacy at <Fill value={BUSINESS.address} placeholder="store address" />,
        holding drug licence <Fill value={BUSINESS.drugLicence} placeholder="drug licence number(s)" /> and GSTIN{" "}
        <Fill value={BUSINESS.gstin} placeholder="GSTIN" />. Orders are dispensed from this licensed store under the supervision of
        our registered pharmacist <Fill value={BUSINESS.pharmacist} placeholder="pharmacist name and registration number" />.
      </p>

      <h2>Prescription medicines</h2>
      <ul>
        <li>Schedule H and H1 medicines are supplied only against a valid prescription from a registered medical practitioner.</li>
        <li>Our pharmacist may reject a prescription that is unclear, expired, altered or doesn’t cover the items ordered. Any online payment for a rejected order is refunded in full.</li>
        <li>Schedule X and narcotic medicines are not sold online.</li>
        <li>We may limit quantities in line with the prescription and the law.</li>
      </ul>

      <h2>Medical advice</h2>
      <p>
        Product information on this site is for general reference and is not medical advice. Always follow your doctor’s
        instructions. Do not switch brands or salts without asking your doctor or our pharmacist.
      </p>

      <h2>Orders, prices and payment</h2>
      <ul>
        <li>Prices include GST and never exceed the MRP. Prices and stock are confirmed when you place your order.</li>
        <li>An order is accepted once we confirm it; we may cancel it (for example if stock runs out), and refund any payment in full.</li>
        <li>Online payments are processed by our payment partner. Unpaid online orders are cancelled after 30 minutes.</li>
      </ul>

      <h2>Your account</h2>
      <p>
        You log in with a one-time code sent to your mobile number. Keep your phone secure; you are responsible for orders
        placed from your account. You must be 18 or older to order.
      </p>

      <h2>Returns, delivery and complaints</h2>
      <p>
        See <Link href="/returns">Returns &amp; refunds</Link>, <Link href="/shipping">Delivery &amp; pickup</Link> and{" "}
        <Link href="/grievance">Contact &amp; grievances</Link>.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of India. Courts at <Fill value={null} placeholder="city" /> have jurisdiction,
        without affecting your rights as a consumer.
      </p>
    </>
  );
}
