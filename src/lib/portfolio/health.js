import { daysBetween, financialYearLabel, midnight, today } from "@/lib/dates";
import { financialYearEndYear } from "@/lib/portfolio/directors";
import { clientSchedule } from "@/lib/portfolio/schedule";
export function currentWorkingFyEndingYear(asOf = today()) {
  return financialYearEndYear(asOf);
}

export function computeClientHealth(client, asOf = today(), directors = []) {
  const reference = midnight(asOf);
  const fyEndingYear = currentWorkingFyEndingYear(reference);

  const dated = clientSchedule(client, directors, reference).filter((r) => r.due !== null);
  const open = dated.filter((r) => !r.filedOn);
  const overdue = open.filter((r) => r.due.getTime() < reference.getTime());
  const dueSoon = open.filter((r) => {
    const days = daysBetween(reference, r.due);
    return days >= 0 && days <= 30;
  });

  const total = dated.length;
  const onTrack = total - overdue.length;
  const score = total === 0 ? 100 : Math.round((onTrack / total) * 100);

  // Most urgent first: the earliest overdue item if any, else the soonest upcoming open one.
  const next = overdue.length > 0 ? overdue[0] : (open.find((r) => r.due.getTime() >= reference.getTime()) ?? null);

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

export function healthTone(health) {
  if (health.overdue.length > 0) return "bad";
  if (health.dueSoon.length > 0) return "warn";
  return "good";
}

/** True where the client needs attention within the next 30 days, overdue or not. */
export function needsAction(health) {
  return health.overdue.length > 0 || health.dueSoon.length > 0;
}
