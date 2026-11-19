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
 * Each page's tab name: the page's own heading, so a tab reads the same as
 * the page it opens (menu titles like "Dashboard" or "Client Register" are
 * ambiguous out of their tool's menu). Add new pages here.
 */
export const TAB_TITLES = {
  "/dashboard": "Dashboard",
  "/mca": "MCA Dashboard",
  "/portfolio": "Company Master Data",
  "/portfolio/report": "Compliance Report",
  "/directors": "Director Master",
  "/consultants": "Consultant Master",
  "/late-fee": "Late Fee Calculator",
  "/gst": "GST Client Register",
  "/gst/returns": "GST Return Filing Status",
  "/gst/guide": "GST Helper Guide",
  "/documents": "Document Generator",
  "/bank-statement": "Bank Statement to Excel",
  "/tasks": "Task Manager",
  "/due-dates": "Due Date Tracker",
  "/applicability": "What Applies To Me?",
  "/beyond-roc": "Beyond-ROC Calendar",
  "/checklists": "Compliance Checklists",
  "/incorporation": "Incorporation Toolkit",
  "/sections": "Section Reference",
  "/tools": "Fee & Penalty Calculators",
  "/admin/users": "Users",
};

/**
 * The tab's label: its name in TAB_TITLES, else the menu title (exact path,
 * then the closest parent page), else made from the path.
 * `items` is a list of { title, href }.
 */
export function tabTitle(path, items) {
  if (TAB_TITLES[path]) return TAB_TITLES[path];
  const exact = items.find((i) => i.href === path);
  if (exact) return exact.title;
  const parent = items
    .filter((i) => i.href !== "/" && path.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  const rest = path.split("/").filter(Boolean);
  if (parent) return `${parent.title} · ${words(rest[rest.length - 1])}`;
  return rest.map(words).join(" · ") || "Home";
}
