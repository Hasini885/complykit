import type { Metadata } from "next";
import { BrandWordmark, LogoMark } from "@/components/brand-logo";
import Link from "next/link";
import { redirect } from "next/navigation";

import { site } from "@/config/site";
import { BillingPanel } from "@/components/billing/billing-panel";
import { currentAccess, razorpayConfigured } from "@/lib/billing-server";

export const metadata: Metadata = { title: "Subscription" };
export const dynamic = "force-dynamic";

/** The subscription page: trial or plan status, and the yearly payment. */
export default async function BillingPage() {
  const found = await currentAccess();
  if (!found) redirect("/sign-in?redirect_url=/billing");
  const { access, config } = found;

  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="w-full max-w-md space-y-5 rounded-3xl border bg-card p-6 shadow-card sm:p-7">
        <div className="flex items-center gap-3">
          <LogoMark className="size-11" />
          <div>
            <BrandWordmark name={site.name} className="block text-base" />
            <p className="text-sm text-muted-foreground">Subscription</p>
          </div>
        </div>

        <BillingPanel
          access={access}
          price={config.yearlyPrice}
          payable={config.yearlyPrice > 0 && razorpayConfigured()}
        />

        {access.allowed ? (
          <Link href="/dashboard" className="block text-center text-xs text-muted-foreground hover:text-foreground">
            Back to the dashboard
          </Link>
        ) : null}
      </div>
    </main>
  );
}
