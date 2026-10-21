// Seller details for invoices and the footer, read from environment variables.

const env = (name: string) => process.env[name]?.trim() || null;

export const BUSINESS = {
  legalName: env("STORE_LEGAL_NAME") ?? "My Pharmacy",
  address: env("STORE_ADDRESS"),
  state: env("STORE_STATE"),
  gstin: env("STORE_GSTIN"),
  drugLicence: env("STORE_DRUG_LICENCE"),
  pharmacist: env("STORE_PHARMACIST"),
  email: env("STORE_EMAIL"),
  phone: env("STORE_PHONE"),
  grievanceOfficer: env("STORE_GRIEVANCE_OFFICER"),
  grievanceEmail: env("STORE_GRIEVANCE_EMAIL"),
  /** Set to "true" once a lawyer has reviewed the legal pages; until then they show a draft banner. */
  legalReviewed: env("STORE_LEGAL_REVIEWED") === "true",
};

/** Invoices aren't valid tax invoices until these are set. */
export const missingInvoiceDetails = (
  [
    ["STORE_LEGAL_NAME", env("STORE_LEGAL_NAME")],
    ["STORE_ADDRESS", BUSINESS.address],
    ["STORE_STATE", BUSINESS.state],
    ["STORE_GSTIN", BUSINESS.gstin],
    ["STORE_DRUG_LICENCE", BUSINESS.drugLicence],
  ] as const
)
  .filter(([, v]) => !v)
  .map(([k]) => k);
