"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PortfolioProvider } from "@/components/portfolio/portfolio-provider";
import { AccountSyncProvider } from "@/components/sync/account-sync";
import { SubscriptionBanner } from "@/components/billing/subscription-banner";
import { activateUserStorage } from "@/lib/user-storage";
import { features } from "@/config/site";
/**
 * The subscription, checked once when the app opens (the shell stays mounted
 * while moving between pages). An account whose free month or paid year has
 * run out is sent to /billing. If the check cannot be made, the app opens.
 */
function useSubscription(userId) {
  const router = useRouter();
  const [state, setState] = React.useState({ for: null, billing: null });
  React.useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetch("/api/billing", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((billing) => {
        if (cancelled) return;
        if (billing && !billing.access.allowed) router.replace("/billing");
        else setState({ for: userId, billing });
      });
    return () => {
      cancelled = true;
    };
  }, [userId, router]);
  return { checked: state.for === userId, billing: state.billing };
}

export function AppShell({ children }) {
  const { isLoaded, user } = useUser();
  const userId = user?.id ?? null;
  // With subscriptions off there is nothing to check: the app opens straight away.
  const subscription = useSubscription(features.subscriptions ? userId : null);
  const checked = !features.subscriptions || subscription.checked;
  const billing = features.subscriptions ? subscription.billing : null;

  // Switch storage to this account before the data is read. Safe to repeat:
  // it does nothing when the account is already the active one.
  const readyFor = React.useMemo(() => {
    if (!userId || typeof window === "undefined") return null;
    try {
      activateUserStorage(window.localStorage, userId);
    } catch {
      // Storage blocked: the app still works for this visit.
    }
    return userId;
  }, [userId]);

  if (!isLoaded || !user || readyFor !== user.id || !checked) {
    return <div className="min-h-full" aria-busy="true" />;
  }

  return (
    // Keyed by account, so a different sign-in starts fresh with its own data.
    <PortfolioProvider key={user.id}>
      <AccountSyncProvider userId={user.id}>
        <div className="relative isolate flex min-h-dvh flex-col">
          {/* Header, banner and footer carry print:hidden themselves, so printing
              (reports, "Save as PDF") shows the page content only. */}
          <SiteHeader />
          {billing ? <SubscriptionBanner access={billing.access} price={billing.yearlyPrice} /> : null}
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8 lg:py-10 print:max-w-none print:p-0">
            {children}
          </main>
          <SiteFooter />
        </div>
      </AccountSyncProvider>
    </PortfolioProvider>
  );
}
