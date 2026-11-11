import { features } from "@/config/site";
import { currentUser } from "@clerk/nextjs/server";

import { isAdminEmail } from "@/lib/admin-users";
import { checkPrice } from "@/lib/billing";
import { saveBillingConfig } from "@/lib/billing-server";

/** The owner sets the yearly price (whole rupees, GST included). Admins only. */
export async function PUT(request: Request) {
  if (!features.subscriptions) return Response.json({ error: "Subscriptions are off." }, { status: 404 });
  const me = await currentUser();
  if (!isAdminEmail(me?.primaryEmailAddress?.emailAddress, process.env.ADMIN_EMAILS)) {
    return Response.json({ error: "Not allowed." }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as { yearlyPrice?: unknown };
  const problem = checkPrice(body.yearlyPrice);
  if (problem) return Response.json({ error: problem }, { status: 400 });
  const config = { yearlyPrice: body.yearlyPrice as number, updatedAt: Date.now() };
  try {
    await saveBillingConfig(config);
    return Response.json({ ok: true, config });
  } catch (error) {
    console.error("billing config save failed", error);
    return Response.json({ error: "Could not save the price." }, { status: 503 });
  }
}
