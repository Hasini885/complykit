import { currentUser } from "@clerk/nextjs/server";

import { createOrder, getBillingConfig, razorpayConfigured, razorpayKeyId } from "@/lib/billing-server";

/** Starts a yearly payment: a Razorpay order at the price the owner set. */
export async function POST() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sign in first." }, { status: 401 });
  const config = await getBillingConfig();
  if (!razorpayConfigured() || config.yearlyPrice <= 0) {
    return Response.json({ error: "Payments are not set up yet." }, { status: 503 });
  }
  try {
    const order = await createOrder(config.yearlyPrice, user.id);
    const meta = user.unsafeMetadata ?? {};
    return Response.json({
      keyId: razorpayKeyId(),
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      prefill: {
        name: typeof meta.name === "string" ? meta.name : [user.firstName, user.lastName].filter(Boolean).join(" "),
        email: user.primaryEmailAddress?.emailAddress ?? "",
        contact: typeof meta.mobile === "string" ? meta.mobile : "",
      },
    });
  } catch (error) {
    console.error("razorpay order failed", error);
    return Response.json({ error: "Could not start the payment. Try again." }, { status: 502 });
  }
}
