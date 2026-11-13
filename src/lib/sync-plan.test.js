import assert from "node:assert/strict";
import test from "node:test";

import { isAccountData, syncPlan } from "@/lib/sync-plan";
import { emptySnapshot } from "@/lib/portfolio/types";

test("which copy wins", () => {
  const fresh = { lastSyncedAt: null, changedSinceSync: false, hasData: false };
  assert.equal(syncPlan(fresh, { updatedAt: 5 }), "pull", "another computer, after login: takes the saved data");
  assert.equal(syncPlan({ ...fresh, hasData: true }, null), "push", "the first save of this account");
  assert.equal(syncPlan(fresh, null), "none", "nothing anywhere yet");
  assert.equal(syncPlan({ ...fresh, hasData: true }, { updatedAt: 5 }), "pull", "both have data: the account wins");
  const synced = { lastSyncedAt: 5, changedSinceSync: false, hasData: true };
  assert.equal(syncPlan(synced, { updatedAt: 5 }), "none");
  assert.equal(syncPlan(synced, { updatedAt: 8 }), "pull", "changed on another computer");
  assert.equal(syncPlan({ ...synced, changedSinceSync: true }, { updatedAt: 5 }), "push", "changed here");
  assert.equal(
    syncPlan({ ...synced, changedSinceSync: true }, { updatedAt: 8 }),
    "pull",
    "changed on both: the account wins",
  );
});

test("the server accepts only CA Compliance Tool data", () => {
  const good = { app: "complykit", version: 1, updatedAt: 1, portfolio: emptySnapshot(), extras: { a: "b" } };
  assert.equal(isAccountData(good), true);
  assert.equal(isAccountData({ ...good, app: "other" }), false);
  assert.equal(isAccountData({ ...good, extras: { a: 1 } }), false);
  assert.equal(isAccountData({ ...good, portfolio: { clients: "x" } }), false);
  assert.equal(isAccountData(null), false);
});
