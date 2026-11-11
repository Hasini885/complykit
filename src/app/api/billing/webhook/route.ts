import { verifyAndCredit, webhookSignatureOk } from "@/lib/billing-server";

/**
 * Razorpay webhook (payment.captured / order.paid): credits a payment even if
 * the payer closed the tab before Checkout reported back. Set it up in the
 * Razorpay dashboard with RAZORPAY_WEBHOOK_SECRET.
 */
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  if (!webhookSignatureOk(body, signature)) return Response.json({ error: "Bad signature." }, { status: 400 });
  let event: { event?: string; payload?: { payment?: { entity?: { id?: string } } } };
  try {
    event = JSON.parse(body);
  } catch {
    return Response.json({ error: "Unreadable." }, { status: 400 });
  }
  const paymentId = event.payload?.payment?.entity?.id;
  if ((event.event === "payment.captured" || event.event === "order.paid") && paymentId) {
    try {
      await verifyAndCredit(paymentId);
    } catch (error) {
      // Not ours, or not captured yet: acknowledge so Razorpay does not retry forever.
      console.error("razorpay webhook", error);
    }
  }
  return Response.json({ ok: true });
}
