import { daysBetween, financialYearLabel, midnight, today } from "@/lib/dates";
import type { ResolvedDueDate } from "@/lib/resolve-due-dates";
import { financialYearEndYear } from "@/lib/portfolio/directors";
import { clientSchedule } from "@/lib/portfolio/schedule";
import type { Client, Director } from "@/lib/portfolio/types";

/**
 * Compliance health for one client: how many of its dated obligations around
 * today are NOT overdue.
 *
 * The obligations come from the company's rolling schedule (schedule.ts), so
 * they span financial years: in October the previous year's AOC-4 and MGT-7
 * count alongside this year's returns, and the window moves on every day.
 *
 * Cadence obligations (Board meeting rhythm) have no single date and are
 * deliberately excluded from the fraction — "0/6" should count filings, not a
 * standing requirement that never resolves to done or not-done here.
 *
 * Only DIR-3 KYC records an actual filing date. For everything else "healthy"
 * means "not overdue", not "confirmed complete", which the UI says plainly.
 */
export type ClientHealth = {
  client: Client;
  /** The financial year running today. */
  fyEndingYear: number;
  fyLabel: string;
  /** Dated obligations in the rolling window (cadence items excluded). */
  dated: ResolvedDueDate[];
  overdue: ResolvedDueDate[];
  dueSoon: ResolvedDueDate[];
  onTrack: number;
  total: number;
  /** 0-100. 100 when there is nothing dated at all (nothing to be behind on). */
  score: number;
  /** The single most urgent item to show in a "next due" column. */
  next: ResolvedDueDate | null;
};

export function currentWorkingFyEndingYear(asOf: Date = today()): number {
  return financialYearEndYear(asOf);
}

export function computeClientHealth(
  client: Client,
  asOf: Date = today(),
  directors: Director[] = [],
): ClientHealth {
  const reference = midnight(asOf);
  const fyEndingYear = currentWorkingFyEndingYear(reference);

  const dated = clientSchedule(client, directors, reference).filter((r) => r.due !== null);
  const open = dated.filter((r) => !r.filedOn);
  const overdue = open.filter((r) => r.due!.getTime() < reference.getTime());
  const dueSoon = open.filter((r) => {
    const days = daysBetween(reference, r.due!);
    return days >= 0 && days <= 30;
  });

  const total = dated.length;
  const onTrack = total - overdue.length;
  const score = total === 0 ? 100 : Math.round((onTrack / total) * 100);

  // Most urgent first: the earliest overdue item if any, else the soonest upcoming open one.
  const next =
    overdue.length > 0
      ? overdue[0]
      : (open.find((r) => r.due!.getTime() >= reference.getTime()) ?? null);

  return {
    client,
    fyEndingYear,
    fyLabel: financialYearLabel(fyEndingYear),
    dated,
    overdue,
    dueSoon,
    onTrack,
    total,
    score,
    next,
  };
}

export type HealthTone = "good" | "warn" | "bad";

export function healthTone(health: ClientHealth): HealthTone {
  if (health.overdue.length > 0) return "bad";
  if (health.dueSoon.length > 0) return "warn";
  return "good";
}

/** True where the client needs attention within the next 30 days, overdue or not. */
export function needsAction(health: ClientHealth): boolean {
  return health.overdue.length > 0 || health.dueSoon.length > 0;
}
