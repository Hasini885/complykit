import { auth } from "@clerk/nextjs/server";

import { checkoutSignatureOk, verifyAndCredit } from "@/lib/billing-server";

/** After Razorpay Checkout succeeds: check the signature, confirm with Razorpay, extend the account. */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in first." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = body;
  if (!orderId || !paymentId || !signature || !checkoutSignatureOk(orderId, paymentId, signature)) {
    return Response.json({ error: "The payment could not be verified." }, { status: 400 });
  }
  try {
    const { paidUntil } = await verifyAndCredit(paymentId, userId);
    return Response.json({ ok: true, paidUntil });
  } catch (error) {
    console.error("razorpay verify failed", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "The payment could not be verified." },
      { status: 400 },
    );
  }
}
