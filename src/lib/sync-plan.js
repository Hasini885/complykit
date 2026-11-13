/** A well-formed copy (what the server accepts and stores). */
export function isAccountData(x) {
  if (!x || typeof x !== "object") return false;
  const d = x;
  const p = d.portfolio;
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
    Object.values(d.extras).every((v) => typeof v === "string")
  );
}

/**
 * What to do when the app opens (or after a change):
 *  - "push": nothing is saved online yet, or only this computer has changes since the last sync.
 *  - "pull": the online copy is newer and this computer has nothing unsynced.
 *  - "none": already in step.
 *
 * The account's saved copy always wins (owner's rule, 2026-11-13): when this
 * computer has never synced, or both sides changed, the saved copy replaces
 * this computer's data. There is no "which copy?" question any more.
 */
export function syncPlan(local, remote) {
  if (!remote) return local.hasData ? "push" : "none";
  if (local.lastSyncedAt === null) return "pull";
  if (remote.updatedAt > local.lastSyncedAt) return "pull";
  return local.changedSinceSync ? "push" : "none";
}
