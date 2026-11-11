import assert from "node:assert/strict";
import test from "node:test";

import { activateUserStorage, USER_DATA_KEYS } from "@/lib/user-storage";

function memory(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
  };
}
const PORTFOLIO = USER_DATA_KEYS[0];

test("data saved before accounts belongs to the first account that signs in", () => {
  const s = memory({ [PORTFOLIO]: "old" });
  activateUserStorage(s, "asha");
  assert.equal(s.getItem(PORTFOLIO), "old");
});

test("two accounts in one browser each see only their own data", () => {
  const s = memory();
  activateUserStorage(s, "asha");
  s.setItem(PORTFOLIO, "asha's companies");
  activateUserStorage(s, "bala");
  assert.equal(s.getItem(PORTFOLIO), null, "Bala starts empty");
  s.setItem(PORTFOLIO, "bala's companies");
  activateUserStorage(s, "asha");
  assert.equal(s.getItem(PORTFOLIO), "asha's companies");
  activateUserStorage(s, "bala");
  assert.equal(s.getItem(PORTFOLIO), "bala's companies");
  assert.equal(activateUserStorage(s, "bala"), false, "same account: nothing to do");
});
