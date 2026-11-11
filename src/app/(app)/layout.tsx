import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SubscriptionBanner } from "@/components/billing/subscription-banner";
import { currentAccess } from "@/lib/billing-server";

// Access depends on the signed-in account and today's date: never cached.
export const dynamic = "force-dynamic";

/**
 * Every tool page gets the app chrome: top nav, company switcher, footer.
 * After the free month, an account without a paid-up year is sent to /billing.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const found = await currentAccess();
  if (found && !found.access.allowed) redirect("/billing");
  return (
    <AppShell banner={found ? <SubscriptionBanner access={found.access} price={found.config.yearlyPrice} /> : null}>
      {children}
    </AppShell>
  );
}
