import { today } from "@/lib/dates";
import type { IcsEvent } from "@/lib/ics";
import { buildDuesRows, type DuesRow } from "@/lib/portfolio/dues-table";
import type { Client, Director } from "@/lib/portfolio/types";

/**
 * Reminders a week before each due.
 *
 * Everything lives in the browser, so there is no server to send an email
 * while the app is closed. Two routes cover that between them:
 *  - in the app: the header bell, and a desktop notification if allowed;
 *  - outside it: calendar events carrying a 7-day alarm, so the admin's own
 *    calendar (Outlook, Apple, Google) does the reminding.
 */

export const REMIND_DAYS_BEFORE = 7;

/**
 * Reminders cover forms to file only. Meeting dates with no e-form — the AGM's
 * last date, the first Board meeting — are not notified; they stay on the
 * Compliance Calendar.
 */
const FILINGS_ONLY = { filingsOnly: true } as const;

export type Reminders = {
  /** Not filed, due today or within the next week — the reminder window. */
  dueThisWeek: DuesRow[];
  /** Not filed and already past the due date. */
  overdue: DuesRow[];
};

export function remindersFor(
  clients: Client[],
  directors: Director[],
  asOf: Date = today(),
): Reminders {
  const open = buildDuesRows(clients, directors, asOf, FILINGS_ONLY).filter((r) => r.status !== "completed");
  return {
    dueThisWeek: open.filter((r) => r.days >= 0 && r.days <= REMIND_DAYS_BEFORE),
    overdue: open.filter((r) => r.days < 0).sort((a, b) => a.days - b.days),
  };
}

/** Every open due from today on, as calendar events that alarm a week ahead. */
export function reminderCalendarEvents(
  clients: Client[],
  directors: Director[],
  asOf: Date = today(),
): IcsEvent[] {
  return buildDuesRows(clients, directors, asOf, FILINGS_ONLY)
    .filter((r) => r.status !== "completed" && r.days >= 0)
    .map((r) => ({
      // Stable, so importing an updated file replaces rather than duplicates.
      uid: `${r.id}@complykit`,
      title: `${r.company} — ${r.obligation}${r.form ? ` (${r.form})` : ""}`,
      date: r.due,
      description: [
        `${r.company} (${r.cin})`,
        `${r.obligation}${r.form ? `, ${r.form}` : ""} for ${r.fy}${r.period ? `, ${r.period}` : ""}.`,
        `Provision: ${r.section}.`,
        r.basis ? "Counted from the statutory last date for the AGM; record the actual AGM to firm it up." : "",
        "Mark it filed with its SRN in CA Compliance Tool once done.",
      ]
        .filter(Boolean)
        .join("\n"),
      remindDaysBefore: REMIND_DAYS_BEFORE,
    }));
}

/* ------------------------------------------------------------------ */
/* Desktop notifications: which dues have already been notified        */
/* ------------------------------------------------------------------ */

/** Due rows not yet announced. Ids include the due date, so a moved date notifies again. */
export function notYetNotified(rows: DuesRow[], notified: ReadonlySet<string>): DuesRow[] {
  return rows.filter((r) => !notified.has(r.id));
}

/** Keeps the stored set from growing forever: only ids still in the window survive. */
export function pruneNotified(notified: ReadonlySet<string>, current: DuesRow[]): Set<string> {
  const live = new Set(current.map((r) => r.id));
  return new Set([...notified].filter((id) => live.has(id)));
}

/** "Due today", "Due tomorrow", "Due in 5 days". */
export function dueInWords(days: number): string {
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}
