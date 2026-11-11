"use client";

import * as React from "react";

/**
 * Reads one query-string parameter, reactively, WITHOUT breaking prerendering.
 *
 * Why not Next's `useSearchParams`: on a statically prerendered route it forces
 * the surrounding Suspense boundary to render its fallback at build time, so the
 * page ships "Loading…" to crawlers instead of the 21-row forms table. That is
 * unacceptable for a page whose job is to rank.
 *
 * Why not plain `popstate`: the browser fires it on back/forward only. The App
 * Router navigates with `history.pushState`, so a palette result selected while
 * already on /forms would change the URL and update nothing.
 *
 * So: read `window.location` through `useSyncExternalStore` (server snapshot is
 * null, which keeps hydration honest), and make `pushState`/`replaceState`
 * announce themselves. The patch is installed once, is additive — it always
 * calls the original first and returns its result — and is the same technique
 * router-aware analytics libraries use.
 */

const NAVIGATION_EVENT = "complykit:navigation";
let patched = false;

function patchHistoryOnce() {
  if (patched || typeof window === "undefined") return;
  patched = true;

  ["pushState", "replaceState"].forEach((method) => {
    const original = window.history[method];
    window.history[method] = function patchedHistoryMethod(...args) {
      const result = original.apply(this, args);
      window.dispatchEvent(new Event(NAVIGATION_EVENT));
      return result;
    };
  });
}

function subscribe(onChange) {
  patchHistoryOnce();
  window.addEventListener("popstate", onChange);
  window.addEventListener(NAVIGATION_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(NAVIGATION_EVENT, onChange);
  };
}

export function useUrlParam(name) {
  const getSnapshot = React.useCallback(() => new URLSearchParams(window.location.search).get(name), [name]);
  const getServerSnapshot = React.useCallback(() => null, []);

  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
