import { daysBetween } from "@/lib/dates";

/**
 * Section 173 compliance check for a year's Board meetings.
 *
 * Standard cadence: at least four meetings, with no more than 120 days between
 * two consecutive meetings.
 *
 * Reduced cadence (One Person Company, small company, dormant company): at
 * least two meetings, one in each half of the year, with at least 90 days
 * between them.
 */

export type Cadence = "standard" | "reduced";

export type Gap = { from: Date; to: Date; days: number; breach: boolean };

export type BoardMeetingCheck = {
  meetings: Date[];
  cadence: Cadence;
  requiredCount: number;
  countMet: boolean;
  shortBy: number;
  gaps: Gap[];
  longestGap: number | null;
  shortestGap: number | null;
  gapsCompliant: boolean;
  /** Reduced cadence only: one meeting must fall in each half of the year. */
  halvesCovered: boolean | null;
  compliant: boolean;
  notes: string[];
};

export function checkBoardMeetings(input: Date[], cadence: Cadence): BoardMeetingCheck {
  const meetings = [...input].sort((a, b) => a.getTime() - b.getTime());

  const gaps: Gap[] = [];
  for (let i = 1; i < meetings.length; i++) {
    const days = daysBetween(meetings[i - 1], meetings[i]);
    gaps.push({
      from: meetings[i - 1],
      to: meetings[i],
      days,
      // Standard: no gap may EXCEED 120 days.
      // Reduced: meetings must be at least 90 days APART, so a short gap breaches.
      breach: cadence === "standard" ? days > 120 : days < 90,
    });
  }

  const requiredCount = cadence === "standard" ? 4 : 2;
  const countMet = meetings.length >= requiredCount;
  const gapDays = gaps.map((g) => g.days);
  const longestGap = gapDays.length ? Math.max(...gapDays) : null;
  const shortestGap = gapDays.length ? Math.min(...gapDays) : null;
  const gapsCompliant = gaps.every((g) => !g.breach);

  // Reduced cadence: one meeting in each half of the financial year (Apr–Sep, Oct–Mar).
  let halvesCovered: boolean | null = null;
  if (cadence === "reduced" && meetings.length > 0) {
    const inFirstHalf = meetings.some((m) => m.getMonth() >= 3 && m.getMonth() <= 8);
    const inSecondHalf = meetings.some((m) => m.getMonth() >= 9 || m.getMonth() <= 2);
    halvesCovered = inFirstHalf && inSecondHalf;
  }

  const notes: string[] = [];
  if (!countMet) {
    notes.push(
      `Short by ${requiredCount - meetings.length} meeting${
        requiredCount - meetings.length === 1 ? "" : "s"
      } — ${requiredCount} are required.`,
    );
  }
  for (const g of gaps.filter((x) => x.breach)) {
    notes.push(
      cadence === "standard"
        ? `${g.days} days between two meetings exceeds the 120-day limit.`
        : `Only ${g.days} days between two meetings; at least 90 are required.`,
    );
  }
  if (halvesCovered === false) {
    notes.push("Both meetings fall in the same half of the year; one is needed in each half.");
  }
  if (meetings.length > 0 && notes.length === 0) {
    notes.push("Meets the Section 173 requirements on the dates entered.");
  }

  return {
    meetings,
    cadence,
    requiredCount,
    countMet,
    shortBy: Math.max(0, requiredCount - meetings.length),
    gaps,
    longestGap,
    shortestGap,
    gapsCompliant,
    halvesCovered,
    compliant: countMet && gapsCompliant && halvesCovered !== false,
    notes,
  };
}
