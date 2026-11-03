/**
 * Pure date arithmetic for statutory deadlines.
 *
 * All dates are local midnight. Nothing here reads the clock except
 * `today()`, so every calculation is deterministic and testable.
 */

export type CompanyType = "private" | "public" | "opc" | "section8" | "llp";

export const COMPANY_TYPES: { value: CompanyType; label: string; short: string }[] = [
  { value: "private", label: "Private Limited Company", short: "Private Ltd" },
  { value: "public", label: "Public Limited Company", short: "Public Ltd" },
  { value: "opc", label: "One Person Company", short: "OPC" },
  { value: "section8", label: "Section 8 Company", short: "Section 8" },
  { value: "llp", label: "Limited Liability Partnership", short: "LLP" },
];

export function midnight(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setHours(0, 0, 0, 0);
  return x;
}

export function today(): Date {
  return midnight(new Date());
}

export function makeDate(year: number, month1: number, day: number): Date {
  // month1 is 1-indexed, the way statutes are written.
  const d = new Date(year, month1 - 1, day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(d: Date, n: number): Date {
  const x = midnight(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Month arithmetic that clamps to the end of a short month (31 Mar + 6 => 30 Sep). */
export function addMonths(d: Date, n: number): Date {
  const src = midnight(d);
  const target = new Date(src.getFullYear(), src.getMonth() + n, 1);
  const lastDayOfTarget = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(src.getDate(), lastDayOfTarget));
  target.setHours(0, 0, 0, 0);
  return target;
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((midnight(to).getTime() - midnight(from).getTime()) / 86_400_000);
}

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function parseIsoDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, da] = m;
  const d = makeDate(Number(y), Number(mo), Number(da));
  // Reject impossible dates that JS would silently roll over (e.g. 2026-02-31).
  if (d.getFullYear() !== Number(y) || d.getMonth() + 1 !== Number(mo) || d.getDate() !== Number(da)) {
    return null;
  }
  return d;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));

export function formatDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export function monthName(monthIndex0: number): string {
  return MONTHS[monthIndex0];
}

/* ------------------------------------------------------------------ */
/* Financial year                                                      */
/* ------------------------------------------------------------------ */

/** The Indian financial year ends 31 March. */
export function financialYearEnd(endingYear: number): Date {
  return makeDate(endingYear, 3, 31);
}

/** "FY 2025–26" for the year ending 31 March 2026. */
export function financialYearLabel(endingYear: number): string {
  return `FY ${endingYear - 1}–${String(endingYear).slice(2)}`;
}

/**
 * First financial year end under Section 2(41).
 *
 * The financial year ends on 31 March. Where a company is incorporated on or
 * after 1 January of a year, its first financial year runs to 31 March of the
 * FOLLOWING year. Worked through, both limbs give the same answer in every
 * case: 31 March of the year after the year of incorporation.
 *
 *   incorporated 18 Jul 2019 -> next 31 March is 2020        -> 31 Mar 2020
 *   incorporated 15 Feb 2026 -> next 31 March is 2026, but
 *                               the proviso pushes it on     -> 31 Mar 2027
 *
 * The distinction still matters to the reader, which is what
 * `hasLongFirstFinancialYear` reports: a company incorporated in January to
 * March gets a first financial year of up to fifteen months, where one
 * incorporated in July gets about nine.
 */
export function firstFinancialYearEnd(incorporation: Date): Date {
  return financialYearEnd(incorporation.getFullYear() + 1);
}

/** True where Section 2(41) stretches the first financial year past twelve months. */
export function hasLongFirstFinancialYear(incorporation: Date): boolean {
  return incorporation.getMonth() <= 2; // January, February or March
}

/* ------------------------------------------------------------------ */
/* Deadlines                                                           */
/* ------------------------------------------------------------------ */

/**
 * Last date for an annual general meeting under Section 96.
 * First AGM: nine months from the close of the first financial year.
 * Subsequent: six months from the close of the financial year.
 */
export function agmDeadline(fyEnd: Date, isFirst: boolean): Date {
  return addMonths(fyEnd, isFirst ? 9 : 6);
}

export type Urgency = "overdue" | "due-soon" | "upcoming";

export function urgency(due: Date, reference: Date = today()): Urgency {
  const days = daysBetween(reference, due);
  if (days < 0) return "overdue";
  if (days <= 30) return "due-soon";
  return "upcoming";
}

export function relativeLabel(due: Date, reference: Date = today()): string {
  const days = daysBetween(reference, due);
  if (days === 0) return "due today";
  if (days < 0) return `${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"} overdue`;
  return `in ${days} ${days === 1 ? "day" : "days"}`;
}

/* ------------------------------------------------------------------ */
/* Incorporation timeline                                              */
/* ------------------------------------------------------------------ */

export type TimelineItem = {
  id: string;
  title: string;
  due: Date;
  section: string;
  formCode: string | null;
  detail: string;
  /** True where the date depends on an assumption stated in `detail`. */
  assumed: boolean;
};

/**
 * Everything that follows from a single incorporation date.
 *
 * Where a deadline depends on the AGM, the statutory last date for the AGM is
 * used as the anchor and the item is flagged `assumed` — an AGM held earlier
 * pulls all of them forward.
 */
export function incorporationTimeline(incorporation: Date): TimelineItem[] {
  const inc = midnight(incorporation);
  const fyEnd = firstFinancialYearEnd(inc);
  const agm = agmDeadline(fyEnd, true);

  const items: TimelineItem[] = [
    {
      id: "first-board-meeting",
      title: "Hold the first Board meeting",
      due: addDays(inc, 30),
      section: "Section 173(1)",
      formCode: null,
      detail:
        "The first meeting of the Board must be held within 30 days of the date of incorporation. Notice goes to every director at the address in the register.",
      assumed: false,
    },
    {
      id: "first-auditor",
      title: "Appoint the first statutory auditor",
      due: addDays(inc, 30),
      section: "Section 139(6)",
      formCode: null,
      detail:
        "The Board appoints the first auditor within 30 days of incorporation. If the Board fails to do so, the members must appoint within 90 days at an extraordinary general meeting.",
      assumed: false,
    },
    {
      id: "first-auditor-members",
      title: "Backstop: members appoint the first auditor",
      due: addDays(inc, 90),
      section: "Section 139(6) proviso",
      formCode: null,
      detail:
        "Only relevant if the Board missed the 30-day window. The members then have until this date to appoint at an extraordinary general meeting.",
      assumed: false,
    },
    {
      id: "inc-22",
      title: "Verify the registered office in INC-22",
      due: addDays(inc, 30),
      section: "Section 12",
      formCode: "INC-22",
      detail:
        "Required within 30 days of incorporation if the registered office was not already declared in the incorporation application.",
      assumed: false,
    },
    {
      id: "inc-20a",
      title: "File the declaration of commencement of business",
      due: addDays(inc, 180),
      section: "Section 10A",
      formCode: "INC-20A",
      detail:
        "Until this is filed the company cannot commence business or exercise borrowing powers. Applies to a company incorporated with share capital.",
      assumed: false,
    },
    {
      id: "first-fy-end",
      title: "First financial year closes",
      due: fyEnd,
      section: "Section 2(41)",
      formCode: null,
      detail:
        hasLongFirstFinancialYear(inc)
          ? "Incorporated between 1 January and 31 March, so Section 2(41) runs the first financial year on to 31 March of the following year — a first year of up to fifteen months."
          : "The financial year ends on 31 March. This is the first close for the company.",
      assumed: false,
    },
    {
      id: "first-agm",
      title: "Hold the first annual general meeting",
      due: agm,
      section: "Section 96",
      formCode: null,
      detail:
        "Nine months from the close of the first financial year. The Registrar cannot extend the time for a first annual general meeting, unlike later ones.",
      assumed: false,
    },
    {
      id: "first-adt-1",
      title: "File ADT-1 for the auditor appointed at the AGM",
      due: addDays(agm, 15),
      section: "Section 139(1)",
      formCode: "ADT-1",
      detail:
        "Fifteen days from the annual general meeting. Counted here from the statutory last date for that meeting.",
      assumed: true,
    },
    {
      id: "first-aoc-4",
      title: "File the first financial statements",
      due: addDays(agm, 30),
      section: "Section 137",
      formCode: "AOC-4",
      detail:
        "Thirty days from the annual general meeting. Counted here from the statutory last date for that meeting.",
      assumed: true,
    },
    {
      id: "first-mgt-7",
      title: "File the first annual return",
      due: addDays(agm, 60),
      section: "Section 92",
      formCode: "MGT-7",
      detail:
        "Sixty days from the annual general meeting, in MGT-7A if the company is a small company or One Person Company. Counted here from the statutory last date for that meeting.",
      assumed: true,
    },
  ];

  return items.sort((a, b) => a.due.getTime() - b.due.getTime());
}
