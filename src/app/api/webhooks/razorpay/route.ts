import { db } from "@/lib/db";
import { recordFailedAttempt, recordRefundResult, settleGatewayPayment } from "@/lib/payments/online";
import { verifyWebhookSignature, type RazorpayPayment } from "@/lib/payments/razorpay";

type WebhookBody = {
  event: string;
  payload: {
    payment?: { entity: RazorpayPayment };
    refund?: { entity: { id: string; payment_id: string } };
  };
};

// Razorpay retries non-2xx responses, so every handler below is idempotent.
export async function POST(req: Request) {
  const raw = await req.text(); // signature is over the exact raw body
  if (!verifyWebhookSignature(raw, req.headers.get("x-razorpay-signature"))) {
    return new Response("Invalid signature", { status: 400 });
  }

  const eventId = req.headers.get("x-razorpay-event-id");
  if (eventId && (await db.webhookEvent.findUnique({ where: { id: eventId } }))) {
    return Response.json({ status: "duplicate" });
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(raw) as WebhookBody;
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  try {
    const payment = body.payload.payment?.entity;
    const refund = body.payload.refund?.entity;
    switch (body.event) {
      case "payment.authorized":
      case "payment.captured":
      case "order.paid":
        if (payment) await settleGatewayPayment(payment);
        break;
      case "payment.failed":
        if (payment) await recordFailedAttempt(payment.order_id, payment.error_description);
        break;
      case "refund.processed":
        if (refund) await recordRefundResult(refund.payment_id, true);
        break;
      case "refund.failed":
        if (refund) await recordRefundResult(refund.payment_id, false);
        break;
      default:
        break; // events we don't subscribe to are acknowledged and ignored
    }
  } catch (e) {
    console.error("Razorpay webhook failed", body.event, e);
    return new Response("Processing failed", { status: 500 });
  }

  if (eventId) {
    await db.webhookEvent.create({ data: { id: eventId, provider: "razorpay" } }).catch(() => undefined);
  }
  return Response.json({ status: "ok" });
}
