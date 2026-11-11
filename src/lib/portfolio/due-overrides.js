import { parseIsoDate } from "@/lib/dates";
import { filingKey } from "@/lib/portfolio/filings";
/**
 * One-off due dates chosen by the user for their own convenience.
 *
 * An override is tied to one occurrence — an obligation for one financial
 * year (and half-year), the same key as a filing — so changing this year's
 * AOC-4 date leaves next year's AOC-4 on its usual date. The date the law
 * gives is kept alongside as `originalDue`, so it is never lost from view.
 */

export function applyDueOverrides(items, client) {
  const byKey = new Map((client.dueOverrides ?? []).map((o) => [o.key, o]));
  if (byKey.size === 0) return items;
  return items.map((item) => {
    if (item.due === null) return item;
    const o = byKey.get(filingKey(item));
    const date = o ? parseIsoDate(o.date) : null;
    if (!o || !date) return item;
    return { ...item, due: date, originalDue: item.due, customNote: o.note || null };
  });
}

/** The company with this occurrence's date set (replacing any earlier one-off date for it). */
export function withDueOverride(client, key, input, now = new Date()) {
  const record = { key, date: input.date, note: input.note?.trim() || undefined };
  const others = (client.dueOverrides ?? []).filter((o) => o.key !== key);
  return { ...client, dueOverrides: [...others, record], updatedAt: now.toISOString() };
}

/** Back to the usual date for this occurrence. */
export function withoutDueOverride(client, key, now = new Date()) {
  return {
    ...client,
    dueOverrides: (client.dueOverrides ?? []).filter((o) => o.key !== key),
    updatedAt: now.toISOString(),
  };
}

/** Keeps only well-formed records from storage. */
export function cleanDueOverrides(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (o) => !!o && typeof o.key === "string" && typeof o.date === "string" && parseIsoDate(o.date) !== null,
  );
}

/** A reason the chosen date cannot be used, or null. */
export function checkOverrideDate(date) {
  return parseIsoDate(date) ? null : "Choose a valid date.";
}
