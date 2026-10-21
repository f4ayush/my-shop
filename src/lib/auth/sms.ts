import { maskPhone } from "@/lib/phone";

/**
 * Sends an SMS. No provider is wired up yet: in development the message is printed to the
 * dev server log instead; in production sending fails until SMS_PROVIDER is implemented
 * (e.g. MSG91 or Gupshup with a DLT-registered template).
 */
export async function sendSms(phone: string, message: string): Promise<void> {
  const provider = process.env.SMS_PROVIDER;
  if (!provider) {
    if (process.env.NODE_ENV === "production") throw new Error("SMS_PROVIDER is not configured");
    console.info(`[dev sms] to ${maskPhone(phone)}: ${message}`);
    return;
  }
  throw new Error(`SMS provider "${provider}" is not implemented`);
}
