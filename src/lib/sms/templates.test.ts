import { describe, expect, it } from "vitest";
import { msg91FlowBody, msg91Mobile, msg91Outcome, orderMessage, otpMessage, templateEnvVar, templateId } from "./templates";

describe("template IDs from the environment", () => {
  it("derives env var names from template keys", () => {
    expect(templateEnvVar("otp")).toBe("SMS_TEMPLATE_OTP");
    expect(templateEnvVar("order.rx_review")).toBe("SMS_TEMPLATE_ORDER_RX_REVIEW");
    expect(templateEnvVar("order.ready_for_pickup")).toBe("SMS_TEMPLATE_ORDER_READY_FOR_PICKUP");
  });

  it("refuses to send when a template ID is missing", () => {
    expect(templateId("otp", { SMS_TEMPLATE_OTP: " tmpl-otp " })).toBe("tmpl-otp");
    expect(() => templateId("order.placed", {})).toThrow(/SMS_TEMPLATE_ORDER_PLACED is not set/);
    expect(() => templateId("order.placed", { SMS_TEMPLATE_ORDER_PLACED: "  " })).toThrow();
  });
});

describe("messages", () => {
  it("OTP keeps the code as a variable", () => {
    const m = otpMessage("042517");
    expect(m).toMatchObject({ template: "otp", vars: { otp: "042517" } });
    expect(m.text).toContain("042517");
  });

  it("order messages carry only the order number", () => {
    expect(orderMessage("order.confirmed", "MP-1001", "x")).toEqual({ template: "order.confirmed", vars: { order: "MP-1001" }, text: "x" });
  });
});

describe("MSG91", () => {
  const env = { SMS_TEMPLATE_OTP: "tmpl-otp", SMS_TEMPLATE_ORDER_PLACED: "tmpl-placed" };

  it("formats Indian mobiles without +", () => {
    expect(msg91Mobile("+919876543210")).toBe("919876543210");
    expect(() => msg91Mobile("9876543210")).toThrow();
    expect(() => msg91Mobile("+14155550100")).toThrow();
  });

  it("builds a Flow API body with template ID and variables, and no free text", () => {
    const body = msg91FlowBody("+919876543210", otpMessage("123456"), env);
    expect(body).toEqual({ template_id: "tmpl-otp", short_url: "0", recipients: [{ mobiles: "919876543210", otp: "123456" }] });
    expect(JSON.stringify(body)).not.toContain("login code");

    const order = msg91FlowBody("+919876543210", orderMessage("order.placed", "MP-1001", "ignored"), env);
    expect(order).toEqual({ template_id: "tmpl-placed", short_url: "0", recipients: [{ mobiles: "919876543210", order: "MP-1001" }] });
  });

  it("treats only HTTP 2xx with type=success as sent", () => {
    expect(msg91Outcome(200, { type: "success", message: "3567686b6d" })).toEqual({ ok: true });
    expect(msg91Outcome(200, { type: "error", message: "Invalid template" })).toEqual({
      ok: false,
      error: "MSG91 rejected the message (HTTP 200): Invalid template",
    });
    expect(msg91Outcome(401, null).ok).toBe(false);
    expect(msg91Outcome(500, "oops").ok).toBe(false);
  });

  it("strips long digit runs (codes, numbers) from provider errors", () => {
    const r = msg91Outcome(400, { type: "error", message: "Mobile 919876543210 invalid for otp 123456" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).not.toContain("9876543210");
      expect(r.error).not.toContain("123456");
    }
  });
});
