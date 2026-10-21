// SMS templates. Indian SMS must use DLT-registered templates, so the provider sends a registered
// template ID plus variables, never free text. `text` is our copy of the registered wording, used
// only by the development log driver — keep it identical to the registered template.

export type SmsTemplateKey =
  | "otp"
  | "order.placed"
  | "order.rx_review"
  | "order.confirmed"
  | "order.ready_for_pickup"
  | "order.out_for_delivery"
  | "order.completed"
  | "order.rx_rejected"
  | "order.cancelled";

export type SmsMessage = { template: SmsTemplateKey; vars: Record<string, string>; text: string };

/** "order.rx_review" → "SMS_TEMPLATE_ORDER_RX_REVIEW": the env var holding the provider's template ID. */
export function templateEnvVar(key: SmsTemplateKey): string {
  return `SMS_TEMPLATE_${key.replace(/[.]/g, "_").toUpperCase()}`;
}

export function templateId(key: SmsTemplateKey, env: Record<string, string | undefined>): string {
  const name = templateEnvVar(key);
  const id = env[name]?.trim();
  if (!id) throw new Error(`${name} is not set (the SMS provider's template ID for "${key}")`);
  return id;
}

export function otpMessage(code: string): SmsMessage {
  return {
    template: "otp",
    vars: { otp: code },
    text: `${code} is your My Pharmacy login code. It expires in 5 minutes. Do not share it with anyone.`,
  };
}

export function orderMessage(template: Exclude<SmsTemplateKey, "otp">, orderNumber: string, text: string): SmsMessage {
  return { template, vars: { order: orderNumber }, text };
}

// ─── MSG91 (Flow API) ────────────────────────────────────

export const MSG91_FLOW_URL = "https://control.msg91.com/api/v5/flow";

/** "+919876543210" → "919876543210" (MSG91 wants the country code without "+"). */
export function msg91Mobile(e164: string): string {
  if (!/^\+91[6-9]\d{9}$/.test(e164)) throw new Error("Not an Indian mobile number in E.164 form");
  return e164.slice(1);
}

/** Request body for one message. Template variables (##otp##, ##order##) are case-sensitive in MSG91. */
export function msg91FlowBody(phone: string, message: SmsMessage, env: Record<string, string | undefined>) {
  return {
    template_id: templateId(message.template, env),
    short_url: "0",
    recipients: [{ mobiles: msg91Mobile(phone), ...message.vars }],
  };
}

/**
 * Reads MSG91's reply. It can answer HTTP 200 with {"type":"error"}, so both are checked.
 * The error never includes our request (which holds the OTP or order number).
 */
export function msg91Outcome(status: number, body: unknown): { ok: true } | { ok: false; error: string } {
  const b = (body && typeof body === "object" ? body : {}) as { type?: unknown; message?: unknown };
  if (status >= 200 && status < 300 && b.type === "success") return { ok: true };
  const detail = typeof b.message === "string" ? b.message.replace(/\d{4,}/g, "…").slice(0, 120) : "no details";
  return { ok: false, error: `MSG91 rejected the message (HTTP ${status}): ${detail}` };
}
