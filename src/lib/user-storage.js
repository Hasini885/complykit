/**
 * Keeps each account's data apart in a browser that several people sign in
 * to. The app's stores always read and write their usual keys; when a
 * different account signs in, the previous account's values are put aside
 * under "<key>@<their id>" and the new account's own values are brought back.
 *
 * Data saved before accounts existed belongs to whoever signs in first.
 */

/** Everything the app keeps per person in this browser. */
export const USER_DATA_KEYS = [
  "complykit.portfolio.v1",
  "complykit.checklists.v1",
  "complykit.documents.v1",
  "complykit.documents.firm.v1",
  "complykit.dashboard-fy.v1",
  "complykit.notified.v1",
  "complykit.gst.v1",
  "complykit.tasks.v1",
];

export const OWNER_KEY = "complykit.owner";

const aside = (key, userId) => `${key}@${userId}`;

/** Makes the app's keys hold this account's data. Returns true when it switched accounts. */
export function activateUserStorage(store, userId) {
  const owner = store.getItem(OWNER_KEY);
  if (owner === userId) return false;

  for (const key of USER_DATA_KEYS) {
    // Put the previous account's values aside (data from before accounts: kept for this one).
    if (owner) {
      const current = store.getItem(key);
      if (current === null) store.removeItem(aside(key, owner));
      else store.setItem(aside(key, owner), current);
    }
    if (owner || store.getItem(aside(key, userId)) !== null) {
      const mine = store.getItem(aside(key, userId));
      if (mine === null) store.removeItem(key);
      else store.setItem(key, mine);
      store.removeItem(aside(key, userId));
    }
  }
  store.setItem(OWNER_KEY, userId);
  return true;
}
