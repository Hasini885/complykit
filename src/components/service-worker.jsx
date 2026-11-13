"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";

import { allNavItems } from "@/config/navigation";
import { forgetOfflineUser, rememberOfflineUser } from "@/lib/offline-user";

const WARMED_KEY = "complykit.sw-warmed";

/** Sends a message to the active service worker, if there is one. */
async function tell(msg) {
  try {
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage(msg);
  } catch {
    // No service worker: nothing to do.
  }
}

/**
 * Registers the service worker (public/sw.js) and keeps offline use in step
 * with sign-in. Production only, so local development never serves stale files.
 *  - Signed in, online: remember the account for offline use, and once per
 *    browser session keep a copy of every tool page so they all open offline.
 *  - Signed out: forget the account and the kept pages.
 */
export function ServiceWorker() {
  const { isLoaded, user } = useUser();
  const userId = user?.id ?? null;
  const on = process.env.NODE_ENV === "production";

  useEffect(() => {
    if (!on || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, [on]);

  useEffect(() => {
    if (!isLoaded) return;
    try {
      if (userId) rememberOfflineUser(localStorage, userId);
      else forgetOfflineUser(localStorage);
    } catch {
      // Storage blocked: offline use is simply unavailable.
    }
    if (!on || !("serviceWorker" in navigator)) return;
    if (!userId) {
      void tell({ type: "clear" });
      return;
    }
    try {
      if (sessionStorage.getItem(WARMED_KEY) === userId) return;
      sessionStorage.setItem(WARMED_KEY, userId);
    } catch {
      // Fall through and warm anyway.
    }
    void tell({ type: "warm", paths: allNavItems.map((i) => i.href) });
  }, [isLoaded, userId, on]);

  return null;
}
