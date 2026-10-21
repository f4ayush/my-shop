import { maskPhone } from "@/lib/phone";
import { MSG91_FLOW_URL, msg91FlowBody, msg91Outcome, type SmsMessage } from "@/lib/sms/templates";

export type { SmsMessage } from "@/lib/sms/templates";

/**
 * Sends a DLT template SMS.
 * - SMS_PROVIDER unset: development only — the text is printed to the dev server log.
 * - SMS_PROVIDER=msg91: MSG91 Flow API with MSG91_AUTH_KEY and SMS_TEMPLATE_* template IDs.
 * Message text and variables (OTPs, order numbers) are never logged in production.
 */
export async function sendSms(phone: string, message: SmsMessage): Promise<void> {
  const provider = process.env.SMS_PROVIDER?.trim();
  if (!provider) {
    if (process.env.NODE_ENV === "production") throw new Error("SMS_PROVIDER is not configured");
    console.info(`[dev sms] to ${maskPhone(phone)}: ${message.text}`);
    return;
  }
  if (provider === "msg91") return sendViaMsg91(phone, message);
  throw new Error(`SMS provider "${provider}" is not supported (use "msg91")`);
}

async function sendViaMsg91(phone: string, message: SmsMessage): Promise<void> {
  const authKey = process.env.MSG91_AUTH_KEY?.trim();
  if (!authKey) throw new Error("MSG91_AUTH_KEY is not set");

  const res = await fetch(MSG91_FLOW_URL, {
    method: "POST",
    headers: { authkey: authKey, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(msg91FlowBody(phone, message, process.env)),
    signal: AbortSignal.timeout(10_000),
  });
  const outcome = msg91Outcome(res.status, await res.json().catch(() => null));
  if (!outcome.ok) {
    console.error(`SMS to ${maskPhone(phone)} failed (template ${message.template}): ${outcome.error}`);
    throw new Error(outcome.error);
  }
}
