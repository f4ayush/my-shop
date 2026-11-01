import type { Metadata } from "next";
import { BUSINESS } from "@/lib/business";
import { Fill } from "../fill";

export const metadata: Metadata = { title: "Contact & grievances" };

export default function GrievancePage() {
  return (
    <>
      <h1>Contact &amp; grievances</h1>

      <h2>Customer care</h2>
      <ul>
        <li>Phone: <Fill value={BUSINESS.phone} placeholder="customer care number" /></li>
        <li>Email: <Fill value={BUSINESS.email} placeholder="customer care email" /></li>
        <li>Store: {BUSINESS.legalName}, <Fill value={BUSINESS.address} placeholder="store address" /></li>
        <li>Hours: <Fill value={null} placeholder="e.g. 9 am – 9 pm, all days" /></li>
      </ul>
      <p>Please include your order number. For medicine questions, ask to speak to our pharmacist.</p>

      <h2>Grievance officer</h2>
      <p>If your issue isn’t resolved, or for any complaint about your personal data, contact our grievance officer:</p>
      <ul>
        <li>Name and designation: <Fill value={BUSINESS.grievanceOfficer} placeholder="name, designation" /></li>
        <li>Email: <Fill value={BUSINESS.grievanceEmail} placeholder="grievance email" /></li>
        <li>Address: <Fill value={BUSINESS.address} placeholder="store address" /></li>
      </ul>
      <p>
        We acknowledge complaints within 48 hours and aim to resolve them within one month of receipt. For data-protection
        complaints you may also approach the Data Protection Board of India; for consumer disputes, the National Consumer
        Helpline (1915) or the consumer commission.
      </p>

      <h2>Licences</h2>
      <ul>
        <li>Drug licence: <Fill value={BUSINESS.drugLicence} placeholder="drug licence number(s)" /></li>
        <li>Registered pharmacist: <Fill value={BUSINESS.pharmacist} placeholder="name and registration number" /></li>
        <li>GSTIN: <Fill value={BUSINESS.gstin} placeholder="GSTIN" /></li>
      </ul>
    </>
  );
}
