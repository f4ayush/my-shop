/** Normalises an Indian mobile number to E.164 (+91XXXXXXXXXX), or returns null if it isn't one. */
export function normalizeIndianMobile(input: string): string | null {
  const compact = input.replace(/[\s\-()]/g, "");
  const match = /^(?:\+?91|0)?([6-9]\d{9})$/.exec(compact);
  return match ? `+91${match[1]}` : null;
}

/** "+919876543210" → "+91******3210" — for logs and UI, so full numbers aren't exposed. */
export function maskPhone(e164: string): string {
  return `${e164.slice(0, 3)}******${e164.slice(-4)}`;
}
