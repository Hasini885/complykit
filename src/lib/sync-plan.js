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
 *  - "ask": both sides have data and this computer has never synced (or both changed):
 *           the user chooses which copy to keep, so nothing is lost silently.
 *  - "none": already in step.
 */
export function syncPlan(local, remote) {
  if (!remote) return local.hasData ? "push" : "none";
  const remoteNewer = remote.updatedAt > (local.lastSyncedAt ?? 0);
  if (local.lastSyncedAt === null) return local.hasData ? "ask" : "pull";
  if (remoteNewer && local.changedSinceSync) return "ask";
  if (remoteNewer) return "pull";
  return local.changedSinceSync ? "push" : "none";
}
