import { currentAccess, razorpayConfigured } from "@/lib/billing-server";

/** The signed-in user's subscription: state, days left, and the yearly price. */
export async function GET() {
  const found = await currentAccess();
  if (!found) return Response.json({ error: "Sign in first." }, { status: 401 });
  return Response.json(
    {
      access: found.access,
      yearlyPrice: found.config.yearlyPrice,
      payable: found.config.yearlyPrice > 0 && razorpayConfigured(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
