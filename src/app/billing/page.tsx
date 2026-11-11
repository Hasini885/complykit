import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Scale } from "lucide-react";

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
      <div aria-hidden className="pastel-wash pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px]" />
      <div className="w-full max-w-md space-y-5 rounded-3xl border bg-card p-6 shadow-card sm:p-7">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 via-violet-500 to-pink-400 text-white shadow-md shadow-violet-500/30"
          >
            <Scale className="size-5" />
          </span>
          <div>
            <p className="font-heading text-xl font-bold tracking-tight">{site.name}</p>
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
