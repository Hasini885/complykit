"use client";

import * as React from "react";

/**
 * Per-checklist ticked state, persisted to localStorage.
 *
 * An external store: a module-level cache
 * plus a listener set, read through `useSyncExternalStore` so the server
 * snapshot (everything unticked) matches the first client render with no
 * reset-in-an-effect flash, and multiple mounted consumers (a card's progress
 * bar and the open detail sheet) stay in sync without prop drilling.
 */

const STORAGE_KEY = "complykit.checklists.v1";

type ChecklistState = Record<string, Record<string, boolean>>;

let cache: ChecklistState = {};
let loaded = false;
const listeners = new Set<() => void>();

function readStored(): ChecklistState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function ensureLoaded() {
  if (!loaded) {
    loaded = true;
    cache = readStored();
  }
}

function write() {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    } catch {
      // Quota or private-mode failures are non-fatal; the session keeps working.
    }
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  ensureLoaded();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(checklistId: string): Record<string, boolean> {
  ensureLoaded();
  return cache[checklistId] ?? EMPTY;
}
const EMPTY: Record<string, boolean> = {};

function getServerSnapshot(): Record<string, boolean> {
  return EMPTY;
}

export function setChecklistItem(checklistId: string, itemId: string, checked: boolean) {
  ensureLoaded();
  const current = cache[checklistId] ?? {};
  cache = { ...cache, [checklistId]: { ...current, [itemId]: checked } };
  write();
}

export function clearChecklist(checklistId: string) {
  ensureLoaded();
  const next = { ...cache };
  delete next[checklistId];
  cache = next;
  write();
}

/** Live, persisted ticked state for one checklist: `{ [itemId]: boolean }`. */
export function useChecklistState(checklistId: string): Record<string, boolean> {
  return React.useSyncExternalStore(
    subscribe,
    () => getSnapshot(checklistId),
    getServerSnapshot,
  );
}
