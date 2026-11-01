import type { Metadata } from "next";
import Link from "next/link";
import { BUSINESS } from "@/lib/business";
import { Fill } from "../fill";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy policy</h1>
      <p className="text-slate-500">Last updated: <Fill value={null} placeholder="date" /></p>

      <p>
        {BUSINESS.legalName} (“we”) runs this online pharmacy from our licensed store at{" "}
        <Fill value={BUSINESS.address} placeholder="store address" />. This notice explains what personal data we collect,
        why, and your rights under the Digital Personal Data Protection Act, 2023.
      </p>

      <h2>What we collect and why</h2>
      <ul>
        <li><strong>Mobile number</strong> — to log you in with a one-time code and send order updates.</li>
        <li><strong>Name and delivery address</strong> — to deliver your order and print it on your invoice.</li>
        <li>
          <strong>Prescriptions</strong> (health data) — only when you upload one, to let our registered pharmacist verify and
          dispense prescription medicines, as the law requires.
        </li>
        <li><strong>Order and payment records</strong> — to fulfil orders, issue GST invoices, process refunds and meet tax and drug-law record-keeping duties.</li>
      </ul>
      <p>
        We don’t sell your data, use your prescriptions for marketing, or put medicine names in SMS messages. Card and UPI
        details are entered on our payment partner’s page and never reach our servers.
      </p>

      <h2>Consent</h2>
      <p>
        We ask for your consent before storing a prescription. You can withdraw consent at any time by contacting us (see
        below); this won’t affect orders already dispensed, and we may still need to keep records the law requires.
      </p>

      <h2>Who we share it with</h2>
      <ul>
        <li>Our registered pharmacist and staff, only as needed for your order. Access to prescriptions is logged.</li>
        <li>Service providers acting on our instructions: payment gateway, SMS provider and hosting — <Fill value={null} placeholder="list providers" />.</li>
        <li>Authorities, when the law requires it (e.g. drug inspectors, tax authorities).</li>
      </ul>

      <h2>How long we keep it</h2>
      <p>
        Prescriptions and dispensing records are kept for <Fill value={null} placeholder="period required under drug rules" />;
        invoices and payment records for <Fill value={null} placeholder="period required under GST law" />. Other data is
        deleted or anonymised when no longer needed.
      </p>

      <h2>Your rights</h2>
      <p>You can ask us to:</p>
      <ul>
        <li>tell you what personal data we hold about you and how we use it;</li>
        <li>correct or update it;</li>
        <li>erase it, unless we must keep it by law;</li>
        <li>nominate someone to exercise these rights if you are unable to.</li>
      </ul>
      <p>
        Write to our grievance officer (see <Link href="/grievance">Contact &amp; grievances</Link>). If you are not satisfied
        with our response, you may complain to the Data Protection Board of India.
      </p>

      <h2>Security</h2>
      <p>
        Data is stored in <Fill value={null} placeholder="hosting region, e.g. India" />, encrypted in transit, and access is
        limited to staff who need it. Prescription files are private and never publicly linkable.
      </p>
    </>
  );
}
