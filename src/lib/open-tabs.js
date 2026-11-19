/**
 * The tab bar under the top bar: every page opened gets a tab, so moving
 * between GST, Tasks, MCA and so on is one click. Pure list logic here; the
 * bar itself is src/components/page-tabs.jsx.
 *
 * A tab is just a page path. The main dashboard is always the first tab and
 * cannot be closed, so there is always somewhere to land.
 */

export const HOME_TAB = "/dashboard";

/** Most tabs kept; opening one more drops the oldest (never the dashboard). */
export const MAX_TABS = 12;

/** Pages that never get a tab (sign-in flow, billing gate). */
const NO_TAB = /^\/(sign-in|sign-up|billing)(\/|$)/;

export function tabbable(path) {
  return typeof path === "string" && path.startsWith("/") && !NO_TAB.test(path);
}

/** Cleans a saved list: valid, unique paths, dashboard first. */
export function normalizeTabs(tabs) {
  const list = Array.isArray(tabs) ? tabs.filter((p) => tabbable(p) && p !== HOME_TAB) : [];
  return [HOME_TAB, ...new Set(list)].slice(0, MAX_TABS);
}

/** The list after visiting `path`: added at the end when new, otherwise unchanged. */
export function openTab(tabs, path) {
  const list = normalizeTabs(tabs);
  if (!tabbable(path) || list.includes(path)) return list;
  const next = [...list, path];
  // Too many: drop the oldest after the dashboard.
  return next.length > MAX_TABS ? [HOME_TAB, ...next.slice(2)] : next;
}

/**
 * Closes `path`. When it was the open page, `go` is where to go next: the tab
 * to its right, else the one to its left. `go` is null when nothing needs to move.
 */
export function closeTab(tabs, path, active) {
  const list = normalizeTabs(tabs);
  const at = list.indexOf(path);
  if (path === HOME_TAB || at === -1) return { tabs: list, go: null };
  const next = list.filter((p) => p !== path);
  const go = path === active ? (next[at] ?? next[at - 1] ?? HOME_TAB) : null;
  return { tabs: next, go };
}

const words = (s) =>
  decodeURIComponent(s)
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

/**
 * The tab's label: the page's menu title when it has one (exact path first,
 * then the closest parent page), otherwise made from the path.
 * `items` is a list of { title, href }.
 */
export function tabTitle(path, items) {
  const exact = items.find((i) => i.href === path);
  if (exact) return exact.title;
  const parent = items
    .filter((i) => i.href !== "/" && path.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  const rest = path.split("/").filter(Boolean);
  if (parent) return `${parent.title} · ${words(rest[rest.length - 1])}`;
  return rest.map(words).join(" · ") || "Home";
}
