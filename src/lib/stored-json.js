"use client";

import * as React from "react";

/**
 * A JSON value kept in this browser's storage under `key`, shared by every
 * component that reads the same key. The account sync saves these keys online
 * (see USER_DATA_KEYS and account-sync), so the same login sees them anywhere.
 *
 * `fallback` must be a constant (defined outside the component).
 */
const listeners = new Set();

function subscribe(onChange) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readRaw(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function parse(raw, fallback) {
  if (!raw) return fallback;
  try {
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

export function useStoredJson(key, fallback) {
  // Undefined while rendering on the server, so a page can show a placeholder until the browser's copy is read.
  const raw = React.useSyncExternalStore(
    subscribe,
    () => readRaw(key),
    () => undefined,
  );
  const value = React.useMemo(() => parse(raw, fallback), [raw, fallback]);
  const update = React.useCallback(
    (next) => {
      const current = parse(readRaw(key), fallback);
      const v = typeof next === "function" ? next(current) : next;
      try {
        window.localStorage.setItem(key, JSON.stringify(v));
      } catch {
        // Storage full or blocked: the change lasts for this visit only.
      }
      listeners.forEach((l) => l());
    },
    [key, fallback],
  );
  return [value, update, raw !== undefined];
}
