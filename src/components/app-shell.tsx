"use client";

import * as React from "react";
import { useUser } from "@clerk/nextjs";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { UnverifiedDataBanner } from "@/components/unverified-data-banner";
import { PortfolioProvider } from "@/components/portfolio/portfolio-provider";
import { AccountSyncProvider } from "@/components/sync/account-sync";
import { activateUserStorage } from "@/lib/user-storage";

/**
 * Single-column shell: top navigation, full-width content, footer. All
 * navigation lives in SiteHeader.
 *
 * Before anything reads saved data, this browser's storage is switched to the
 * signed-in account's own data, so people sharing a computer never see each
 * other's companies. That account's data is then saved online under the
 * login, so it is the same on every computer.
 */
export function AppShell({ children, banner }: { children: React.ReactNode; banner?: React.ReactNode }) {
  const { isLoaded, user } = useUser();
  const userId = user?.id ?? null;

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

  if (!isLoaded || !user || readyFor !== user.id) {
    return <div className="min-h-full" aria-busy="true" />;
  }

  return (
    // Keyed by account, so a different sign-in starts fresh with its own data.
    <PortfolioProvider key={user.id}>
      <AccountSyncProvider userId={user.id}>
        <div className="relative isolate flex min-h-full flex-col">
          <div aria-hidden className="pastel-wash pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] print:hidden" />
          {/* Header, banner and footer carry print:hidden themselves, so printing
              (reports, "Save as PDF") shows the page content only. */}
          <SiteHeader />
          <UnverifiedDataBanner />
          {banner}
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8 lg:py-10 print:max-w-none print:p-0">
            {children}
          </main>
          <SiteFooter />
        </div>
      </AccountSyncProvider>
    </PortfolioProvider>
  );
}
