import type { PortfolioSnapshot } from "@/lib/portfolio/types";

/**
 * Keeping a signed-in user's data the same on every computer. The copy saved
 * online (under their CA Compliance Tool account) and the copy in this browser are
 * compared when the app opens, and after every change.
 */

/** What is saved online for each account. */
export type AccountData = {
  app: "complykit";
  version: 1;
  /** When this copy was saved (ms since 1970), to tell which copy is newer. */
  updatedAt: number;
  portfolio: PortfolioSnapshot;
  /** Other saved things (checklists, saved documents, firm details), as stored in the browser. */
  extras: Record<string, string>;
};

/** A well-formed copy (what the server accepts and stores). */
export function isAccountData(x: unknown): x is AccountData {
  if (!x || typeof x !== "object") return false;
  const d = x as Record<string, unknown>;
  const p = d.portfolio as Record<string, unknown> | undefined;
  return (
    d.app === "complykit" &&
    d.version === 1 &&
    typeof d.updatedAt === "number" &&
    Number.isFinite(d.updatedAt) &&
    !!p &&
    Array.isArray(p.clients) &&
    Array.isArray(p.directors) &&
    !!d.extras &&
    typeof d.extras === "object" &&
    Object.values(d.extras as object).every((v) => typeof v === "string")
  );
}

/**
 * What to do when the app opens (or after a change):
 *  - "push": nothing is saved online yet, or only this computer has changes since the last sync.
 *  - "pull": the online copy is newer and this computer has nothing unsynced.
 *  - "ask": both sides have data and this computer has never synced (or both changed):
 *           the user chooses which copy to keep, so nothing is lost silently.
 *  - "none": already in step.
 */
export function syncPlan(
  local: { lastSyncedAt: number | null; changedSinceSync: boolean; hasData: boolean },
  remote: { updatedAt: number } | null,
): "push" | "pull" | "ask" | "none" {
  if (!remote) return local.hasData ? "push" : "none";
  const remoteNewer = remote.updatedAt > (local.lastSyncedAt ?? 0);
  if (local.lastSyncedAt === null) return local.hasData ? "ask" : "pull";
  if (remoteNewer && local.changedSinceSync) return "ask";
  if (remoteNewer) return "pull";
  return local.changedSinceSync ? "push" : "none";
}
