/**
 * The GST client register and monthly return status (brought over from the
 * GST Register browser extension). Portal passwords are never kept here.
 */

export const GST_KEY = "complykit.gst.v1";
export const EMPTY_GST = Object.freeze({ clients: [], status: {} });
export const GST_LOGIN_URL = "https://services.gst.gov.in/services/login";

/** 15 characters: state code, PAN, entity number, Z, check character. */
export const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** Monthly due days: GSTR-1 by the 11th, GSTR-3B by the 20th. */
export const GST_DUE_DAYS = { g1: 11, g3b: 20 };

export const CLIENT_FIELDS = ["name", "signatory", "email", "mobile", "gstin", "user", "reg", "deact", "folder"];

export function newGstClient(id) {
  return { id, name: "", signatory: "", email: "", mobile: "", gstin: "", user: "", reg: "", deact: "", folder: "" };
}

export function normaliseGstin(v) {
  return String(v ?? "")
    .toUpperCase()
    .replace(/\s+/g, "");
}

/** One client's status for a month; older data kept a single value for both returns. */
export function statusOf(status, month, id) {
  const v = status?.[month]?.[id];
  if (typeof v === "string") return { g1: v, g3b: v, remarks: "", assigned: "" };
  return {
    g1: v?.g1 === "filed" ? "filed" : "notfiled",
    g3b: v?.g3b === "filed" ? "filed" : "notfiled",
    remarks: v?.remarks ?? "",
    assigned: v?.assigned ?? "",
  };
}

/** The data with one field of one client's status for a month changed. */
export function withStatus(data, month, id, field, value) {
  const current = statusOf(data.status, month, id);
  return {
    ...data,
    status: { ...data.status, [month]: { ...(data.status[month] ?? {}), [id]: { ...current, [field]: value } } },
  };
}

/** Listed for month "YYYY-MM" from its registration month up to its deactivation month. */
export function activeIn(client, month) {
  return (!client.deact || client.deact.slice(0, 7) >= month) && (!client.reg || client.reg.slice(0, 7) <= month);
}

/** Clients for the month, and how many have filed both GSTR-1 and GSTR-3B. */
export function monthSummary(data, month) {
  const list = data.clients.filter((c) => activeIn(c, month));
  const filed = list.filter((c) => {
    const s = statusOf(data.status, month, c.id);
    return s.g1 === "filed" && s.g3b === "filed";
  }).length;
  return { total: list.length, filed, notFiled: list.length - filed };
}

/**
 * Reads a backup from the GST Register extension ({ clients, status }).
 * Passwords in it are dropped: the site never stores portal passwords.
 */
export function fromBackup(json, makeId) {
  const clients = (Array.isArray(json?.clients) ? json.clients : []).map((c) => {
    const out = newGstClient(typeof c?.id === "string" && c.id ? c.id : makeId());
    for (const f of CLIENT_FIELDS) if (typeof c?.[f] === "string") out[f] = c[f];
    out.gstin = normaliseGstin(out.gstin);
    return out;
  });
  const ids = new Set(clients.map((c) => c.id));
  const status = {};
  for (const [month, byId] of Object.entries(json?.status ?? {})) {
    if (!/^\d{4}-\d{2}$/.test(month) || typeof byId !== "object" || byId === null) continue;
    for (const id of Object.keys(byId)) {
      if (!ids.has(id)) continue;
      (status[month] ??= {})[id] = statusOf(json.status, month, id);
    }
  }
  return { clients, status };
}

export function monthLabel(month) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
}

export function shiftMonth(month, by) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function currentMonth(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
