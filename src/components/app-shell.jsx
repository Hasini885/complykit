"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PortfolioProvider } from "@/components/portfolio/portfolio-provider";
import { AccountSyncProvider } from "@/components/sync/account-sync";
import { SubscriptionBanner } from "@/components/billing/subscription-banner";
import { activateUserStorage } from "@/lib/user-storage";
import { offlineUserFor } from "@/lib/offline-user";
import { features } from "@/config/site";
import { cn } from "@/lib/utils";
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

/** True while the browser says there is no internet connection. */
function useOffline() {
  return React.useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => {
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
      };
    },
    () => !navigator.onLine,
    () => false,
  );
}

/** Sign-in has not loaded after a few seconds (a very weak connection). */
function useSlow(waiting, ms = 6000) {
  const [slow, setSlow] = React.useState(false);
  React.useEffect(() => {
    if (!waiting) return;
    const t = window.setTimeout(() => setSlow(true), ms);
    return () => window.clearTimeout(t);
  }, [waiting, ms]);
  return waiting && slow;
}

/** Spreadsheet pages use the whole screen width. */
const FULL_WIDTH = /^\/(gst|gst\/returns|tasks)$/;

export function AppShell({ children }) {
  const { isLoaded, user } = useUser();
  const pathname = usePathname();
  const fullWidth = FULL_WIDTH.test(pathname);
  const offline = useOffline();
  const slow = useSlow(!isLoaded);

  // No internet: sign-in cannot load, so open the account that last signed in
  // on this computer (its data is already in this browser). See lib/offline-user.
  const offlineMode = !isLoaded && (offline || slow);
  const offlineUser = React.useMemo(() => {
    if (!offlineMode) return null;
    try {
      return offlineUserFor(window.localStorage);
    } catch {
      return null;
    }
  }, [offlineMode]);
  const userId = user?.id ?? offlineUser;

  // Back online after opening offline: reload so sign-in loads and the changes are saved.
  React.useEffect(() => {
    if (!offlineUser) return;
    const back = () => window.location.reload();
    window.addEventListener("online", back);
    return () => window.removeEventListener("online", back);
  }, [offlineUser]);

  // With subscriptions off there is nothing to check: the app opens straight away.
  const subscription = useSubscription(features.subscriptions ? (user?.id ?? null) : null);
  const checked = !features.subscriptions || subscription.checked || !!offlineUser;
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

  if (!userId || readyFor !== userId || !checked) {
    if (offlineMode) return <OfflineSignedOut />;
    return <div className="min-h-full" aria-busy="true" />;
  }

  return (
    // Keyed by account, so a different sign-in starts fresh with its own data.
    <PortfolioProvider key={userId}>
      <AccountSyncProvider userId={userId} offline={!user}>
        <div className="relative isolate flex min-h-dvh flex-col">
          {!user ? (
            <p className="bg-amber-500/15 px-4 py-2 text-center text-sm font-medium text-amber-800 print:hidden dark:text-amber-200">
              You&apos;re offline. You can keep working: changes stay on this computer and are saved to your account
              when the internet is back.
            </p>
          ) : null}
          {/* Header, banner and footer carry print:hidden themselves, so printing
              (reports, "Save as PDF") shows the page content only. */}
          <SiteHeader />
          {billing ? <SubscriptionBanner access={billing.access} price={billing.yearlyPrice} /> : null}
          <main
            className={cn(
              "mx-auto w-full flex-1 px-4 py-8 sm:px-6 lg:py-10 print:max-w-none print:p-0",
              fullWidth ? "max-w-none lg:px-6" : "max-w-7xl lg:px-8",
            )}
          >
            {children}
          </main>
          <SiteFooter />
        </div>
      </AccountSyncProvider>
    </PortfolioProvider>
  );
}

/** Offline and nobody has signed in on this computer before: nothing to open. */
function OfflineSignedOut() {
  return (
    <div className="grid min-h-dvh place-items-center p-4">
      <div className="max-w-md rounded-3xl border-2 border-dashed border-primary/30 p-8 text-center">
        <h1 className="font-heading text-2xl font-bold">You&apos;re offline</h1>
        <p className="mt-3 text-muted-foreground">
          Sign in once with the internet on, and the app will open on this computer even without internet after that.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 rounded-full bg-primary px-5 py-2 font-semibold text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
