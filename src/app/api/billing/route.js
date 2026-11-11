import { features } from "@/config/site";
import { currentAccess, razorpayConfigured } from "@/lib/billing-server";

/** The signed-in user's subscription: state, days left, and the yearly price. */
export async function GET() {
  if (!features.subscriptions) return Response.json({ error: "Subscriptions are off." }, { status: 404 });
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
