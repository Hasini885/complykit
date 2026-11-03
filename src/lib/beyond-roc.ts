import { daysBetween, makeDate, today } from "@/lib/dates";

/**
 * Resolver for the Beyond-ROC calendar: regulators outside the Companies Act
 * whose deadlines recur on a fixed day of the month/quarter/year, computed
 * from today's date rather than from any one client's financial year.
 */

export type BeyondRocRule =
  /** Same day, every month. The "following month" framing lives in the item's schedule text. */
  | { kind: "monthly"; day: number }
  /** A different day/month is due after each of the four quarters (Q4/annual often differs). */
  | { kind: "quarterly"; quarters: { endMonth: number; dueMonth: number; dueDay: number }[] }
  /**
   * One fixed calendar date a year. `extensions` moves a single year's date
   * where a circular has extended it (e.g. CBDT extending the ITR date).
   */
  | { kind: "annual"; month: number; day: number; extensions?: DateExtension[] }
  /** No recurring date — triggered by an event. */
  | { kind: "event" };

/** A one-off extension of one occurrence: `replaces` (ISO) becomes `to` (ISO). */
export type DateExtension = { replaces: string; to: string; source: string };

/**
 * Next occurrence of an annual date, honouring one-off extensions: an
 * extended occurrence counts until its extended date, even after the
 * original date has passed.
 */
export function nextAnnualWithExtensions(
  month: number,
  day: number,
  extensions: DateExtension[],
  asOf: Date = today(),
): Date {
  const candidates: Date[] = [];
  for (const y of [asOf.getFullYear() - 1, asOf.getFullYear(), asOf.getFullYear() + 1]) {
    const normal = makeDate(y, month, day);
    const iso = `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const ext = extensions.find((e) => e.replaces === iso);
    const [ey, em, ed] = ext ? ext.to.split("-").map(Number) : [];
    candidates.push(ext ? makeDate(ey, em, ed) : normal);
  }
  return candidates.filter((d) => d.getTime() >= asOf.getTime()).sort((a, b) => a.getTime() - b.getTime())[0];
}

/** The extension that applies to this due date, if any. */
export function extensionFor(rule: BeyondRocRule, due: Date | null): DateExtension | null {
  if (rule.kind !== "annual" || !rule.extensions || !due) return null;
  const iso = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`;
  return rule.extensions.find((e) => e.to === iso) ?? null;
}

/** Next occurrence of `day` of the month, on or after `asOf`. */
export function nextMonthlyOccurrence(day: number, asOf: Date = today()): Date {
  const candidate = makeDate(asOf.getFullYear(), asOf.getMonth() + 1, day);
  return candidate.getTime() >= asOf.getTime() ? candidate : makeDate(asOf.getFullYear(), asOf.getMonth() + 2, day);
}

/** Next occurrence of a fixed month/day, on or after `asOf`. */
export function nextAnnualOccurrence(month: number, day: number, asOf: Date = today()): Date {
  const candidate = makeDate(asOf.getFullYear(), month, day);
  return candidate.getTime() >= asOf.getTime() ? candidate : makeDate(asOf.getFullYear() + 1, month, day);
}

/**
 * Next occurrence of a quarterly rule, on or after `asOf`.
 *
 * Builds every quarter's due date across a two-year window and picks the
 * earliest one still ahead, so an item whose Q4 due date lands months after
 * the others (as most annual/Q4 variants do) resolves correctly without
 * special-casing the wraparound.
 */
export function nextQuarterlyOccurrence(
  quarters: { endMonth: number; dueMonth: number; dueDay: number }[],
  asOf: Date = today(),
): Date {
  const candidates: Date[] = [];
  for (const y of [asOf.getFullYear() - 1, asOf.getFullYear(), asOf.getFullYear() + 1]) {
    for (const q of quarters) {
      // dueMonth may fall in the year after endMonth (e.g. a Dec quarter due in Jan/May).
      const dueYear = q.dueMonth < q.endMonth ? y + 1 : y;
      candidates.push(makeDate(dueYear, q.dueMonth, q.dueDay));
    }
  }
  const upcoming = candidates
    .filter((d) => d.getTime() >= asOf.getTime())
    .sort((a, b) => a.getTime() - b.getTime());
  return upcoming[0];
}

export function resolveBeyondRocDue(rule: BeyondRocRule, asOf: Date = today()): Date | null {
  switch (rule.kind) {
    case "monthly":
      return nextMonthlyOccurrence(rule.day, asOf);
    case "annual":
      return rule.extensions?.length
        ? nextAnnualWithExtensions(rule.month, rule.day, rule.extensions, asOf)
        : nextAnnualOccurrence(rule.month, rule.day, asOf);
    case "quarterly":
      return nextQuarterlyOccurrence(rule.quarters, asOf);
    case "event":
      return null;
  }
}

export function daysRemaining(due: Date, asOf: Date = today()): number {
  return daysBetween(asOf, due);
}
