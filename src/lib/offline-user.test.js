import assert from "node:assert/strict";
import { test } from "node:test";

import { forgetOfflineUser, offlineUserFor, rememberOfflineUser } from "@/lib/offline-user";
import { activateUserStorage } from "@/lib/user-storage";

function memoryStore() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

test("opens the last signed-in account offline", () => {
  const s = memoryStore();
  activateUserStorage(s, "user_a");
  rememberOfflineUser(s, "user_a");
  assert.equal(offlineUserFor(s), "user_a");
});

test("nobody remembered: nothing opens offline", () => {
  const s = memoryStore();
  activateUserStorage(s, "user_a");
  assert.equal(offlineUserFor(s), null);
});

test("after sign-out nothing opens offline", () => {
  const s = memoryStore();
  activateUserStorage(s, "user_a");
  rememberOfflineUser(s, "user_a");
  forgetOfflineUser(s);
  assert.equal(offlineUserFor(s), null);
});

test("never opens an account whose data is put aside", () => {
  const s = memoryStore();
  activateUserStorage(s, "user_a");
  rememberOfflineUser(s, "user_a");
  activateUserStorage(s, "user_b"); // someone else signed in on this browser
  assert.equal(offlineUserFor(s), null);
});
