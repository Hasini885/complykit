import { financialYearLabel, formatDate, parseIsoDate } from "@/lib/dates";
import { auditorAnchorFy, auditorTermOf, firstFyEndingYear, resolveClientYear } from "@/lib/portfolio/schedule";
import type { Client } from "@/lib/portfolio/types";

/** "10/10/2025": the day/month/year style the ADT-1 note is written in. */
function dmy(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/**
 * ADT-1 for a subsequent auditor. Not a one-time form like INC-20A, nor an
 * every-year one: the auditor is appointed at an AGM for up to five years
 * (Section 139(1)), ADT-1 is filed once for that appointment, and it falls
 * due again only at the AGM where the term ends. The years in between are
 * "NA" — covered by the one ADT-1 already filed.
 */

export type AuditorTerm = {
  /** SRN of the ADT-1 filed for this appointment, where recorded. */
  srn: string;
  /** When that ADT-1 was filed. */
  filedOn: Date | null;
  /** Financial year whose AGM made the appointment. */
  fromFy: number;
  /** Years appointed for (1 to 5). */
  years: number;
  /** Financial year whose AGM ends the term (and appoints again: next ADT-1). */
  untilFy: number;
  /** That AGM counted from the company's first: "the 6th AGM". Null when the incorporation date is unknown. */
  untilAgmNumber: number | null;
  /** When the next ADT-1 falls due: 15 days after that AGM (its statutory last date where none is recorded). */
  nextDue: Date | null;
};

/** The current auditor's term, or null when no appointment year can be worked out. */
export function auditorTerm(client: Client, asOf?: Date): AuditorTerm | null {
  const fromFy = auditorAnchorFy(client);
  if (fromFy === null) return null;
  const years = auditorTermOf(client);
  const untilFy = fromFy + years;
  const first = firstFyEndingYear(client);
  const next = resolveClientYear(client, [], untilFy, { asOf }).find((i) => i.source.id === "adt-1");
  return {
    srn: client.adt1Srn ?? "",
    filedOn: client.adt1FiledOn ? parseIsoDate(client.adt1FiledOn) : null,
    fromFy,
    years,
    untilFy,
    untilAgmNumber: first !== null ? untilFy - first + 1 : null,
    nextDue: next?.due ?? null,
  };
}

/** "6th" */
export function ordinal(n: number): string {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
}

/**
 * Why ADT-1 is NA in a year inside the term: "As per SRN AB1234567 filed
 * dated 10/10/2025, next due 15/10/2028" (with whatever of that is known).
 */
export function adtNaReason(client: Client, asOf?: Date): string {
  const term = auditorTerm(client, asOf);
  if (!term) return "auditor's term running";
  const filed = term.srn
    ? `As per SRN ${term.srn}${term.filedOn ? ` filed dated ${dmy(term.filedOn)}` : ""}`
    : term.filedOn
      ? `As per ADT-1 filed dated ${dmy(term.filedOn)}`
      : "Auditor's term running";
  const next = term.nextDue ? `next due ${dmy(term.nextDue)}` : `next ADT-1 for ${financialYearLabel(term.untilFy)}`;
  return `${filed}, ${next}`;
}

/**
 * The plain-words summary shown with the ADT-1 entry: appointed at the AGM
 * for one year, up to the conclusion of the Nth AGM, next ADT-1 due then.
 */
export function auditorTermSummary(client: Client, asOf?: Date): string | null {
  const term = auditorTerm(client, asOf);
  if (!term) return null;
  const until = term.untilAgmNumber
    ? `the conclusion of the ${ordinal(term.untilAgmNumber)} AGM (for ${financialYearLabel(term.untilFy)})`
    : `the conclusion of the AGM for ${financialYearLabel(term.untilFy)}`;
  const next = term.nextDue ? `, so the next ADT-1 is due by ${formatDate(term.nextDue)}` : "";
  const between = term.years > 1 ? ` ADT-1 is NA for the ${term.years - 1} year${term.years === 2 ? "" : "s"} in between.` : "";
  return `Appointed at the AGM for ${financialYearLabel(term.fromFy)} for ${term.years} year${term.years === 1 ? "" : "s"}, up to ${until}${next}.${between}`;
}
