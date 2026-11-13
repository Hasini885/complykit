/**
 * Opening the app without internet. Sign-in (Clerk) cannot load offline, so
 * the app remembers who last signed in on this computer and, with no
 * connection, opens that account's data, which is already in this browser.
 * Signing out forgets it, so a signed-out computer never opens anyone's data.
 */

import { OWNER_KEY } from "@/lib/user-storage";

export const OFFLINE_USER_KEY = "complykit.offline-user.v1";

/** Called while signed in, online. */
export function rememberOfflineUser(store, userId) {
  if (store.getItem(OFFLINE_USER_KEY) !== userId) store.setItem(OFFLINE_USER_KEY, userId);
}

/** Called once sign-in has loaded and nobody is signed in. */
export function forgetOfflineUser(store) {
  store.removeItem(OFFLINE_USER_KEY);
}

/**
 * The account to open offline, or null. Only when the browser's data
 * currently belongs to that same account (never another person's put-aside copy).
 */
export function offlineUserFor(store) {
  const id = store.getItem(OFFLINE_USER_KEY);
  return id && store.getItem(OWNER_KEY) === id ? id : null;
}
