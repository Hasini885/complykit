import { findSection, type ActSection } from "@/data/sections";

/**
 * "What happens if I get this wrong": the penalty for each common default,
 * as numbers the estimator can compute with.
 *
 * Figures are those in force after the Companies (Amendment) Acts of 2019 and
 * 2020, which moved most procedural defaults from criminal fines to penalties
 * adjudicated by the Registrar under Section 454. The prose for each section
 * lives once, in src/data/sections.ts; the numbers here must agree with it
 * (a test checks the caps appear in that text).
 */

/** One party's exposure: a fixed amount, plus a daily amount, up to a cap. */
export type Liability = {
  /** Fixed amount (₹). */
  base: number;
  /** Further amount for each day the default continues (₹). */
  perDay: number;
  /**
   * The daily amount starts on day 1 ("for every day during which the default
   * continues") or day 2 ("for each day after the first").
   */
  perDayFrom: 1 | 2;
  /** Maximum (₹), or null when the Act sets none. */
  cap: number | null;
};

export type PenaltyRule =
  /** Adjudicated penalty: what the Registrar levies. Section 446B halves it for small companies etc. */
  | { type: "penalty"; company: Liability | null; officer: Liability | null }
  /**
   * Criminal fine on prosecution: the court sets the amount between the
   * minimum and the maximum. Section 446B does not apply to fines.
   */
  | {
      type: "fine";
      company: { min: number; max: number; perDayMax?: number } | null;
      officer: { min: number; max: number; perDayMax?: number } | null;
      imprisonment?: string;
    };

export type PenaltyViolation = {
  id: string;
  label: string;
  /** Bare section number, resolved against src/data/sections.ts. */
  sectionNumber: string;
  /** The section that actually prescribes the penalty, where it is another one. */
  penaltySection?: string;
  formCode?: string;
  rule: PenaltyRule;
};

const daily = (base: number, perDay: number, cap: number | null, perDayFrom: 1 | 2 = 2): Liability => ({
  base,
  perDay,
  perDayFrom,
  cap,
});
const flat = (amount: number): Liability => ({ base: amount, perDay: 0, perDayFrom: 1, cap: null });

export const PENALTY_VIOLATIONS: PenaltyViolation[] = [
  {
    id: "late-aoc4",
    label: "Late or non-filing of financial statements",
    sectionNumber: "137",
    penaltySection: "137(3)",
    formCode: "AOC-4",
    rule: { type: "penalty", company: daily(10_000, 100, 2_00_000), officer: daily(10_000, 100, 50_000) },
  },
  {
    id: "late-mgt7",
    label: "Late or non-filing of the annual return",
    sectionNumber: "92",
    penaltySection: "92(5)",
    formCode: "MGT-7",
    rule: { type: "penalty", company: daily(10_000, 100, 2_00_000), officer: daily(10_000, 100, 50_000) },
  },
  {
    id: "auditor-default",
    label: "Default in the auditor appointment or rotation provisions",
    sectionNumber: "139",
    penaltySection: "147(1)",
    formCode: "ADT-1",
    rule: {
      type: "fine",
      company: { min: 25_000, max: 5_00_000 },
      officer: { min: 10_000, max: 1_00_000 },
    },
  },
  {
    id: "resolutions-not-filed",
    label: "Failure to file a resolution required to be filed",
    sectionNumber: "117",
    penaltySection: "117(2)",
    formCode: "MGT-14",
    rule: { type: "penalty", company: daily(10_000, 100, 2_00_000), officer: daily(10_000, 100, 50_000) },
  },
  {
    id: "board-meeting-default",
    label: "Failure to give notice of a Board meeting",
    sectionNumber: "173",
    penaltySection: "173(4)",
    rule: { type: "penalty", company: null, officer: flat(25_000) },
  },
  {
    id: "registered-office-default",
    label: "Default on the registered office requirements",
    sectionNumber: "12",
    penaltySection: "12(8)",
    formCode: "INC-22",
    rule: {
      type: "penalty",
      company: daily(0, 1_000, 1_00_000, 1),
      officer: daily(0, 1_000, 1_00_000, 1),
    },
  },
  {
    id: "commencement-default",
    label: "Failure to file the commencement of business declaration",
    sectionNumber: "10A",
    penaltySection: "10A(2)",
    formCode: "INC-20A",
    rule: { type: "penalty", company: flat(50_000), officer: daily(0, 1_000, 1_00_000, 1) },
  },
  {
    id: "sbo-default",
    label: "Failure to maintain or file the significant beneficial owner register",
    sectionNumber: "90",
    penaltySection: "90(11)",
    formCode: "BEN-2",
    rule: { type: "penalty", company: daily(1_00_000, 500, 5_00_000), officer: daily(25_000, 200, 1_00_000) },
  },
  {
    id: "agm-not-held",
    label: "Failure to hold the annual general meeting",
    sectionNumber: "96",
    penaltySection: "99",
    rule: {
      type: "fine",
      company: { min: 0, max: 1_00_000, perDayMax: 5_000 },
      officer: { min: 0, max: 1_00_000, perDayMax: 5_000 },
    },
  },
  {
    id: "board-report-default",
    label: "Deficiency in the Board's Report",
    sectionNumber: "134",
    penaltySection: "134(8)",
    rule: { type: "penalty", company: flat(3_00_000), officer: flat(50_000) },
  },
];

/* ------------------------------------------------------------------ */
/* Computing it                                                        */
/* ------------------------------------------------------------------ */

/** Section 446B caps for the reduced penalty. */
export const S446B_CAP = { company: 2_00_000, officer: 1_00_000 } as const;

export type ComputedLiability = {
  /** The penalty before any Section 446B relief. */
  full: number;
  /** After Section 446B, where it applies; else equal to `full`. */
  payable: number;
  /** How the figure was built, for display. */
  workings: string;
  capped: boolean;
};

export function computeLiability(l: Liability, days: number, smallCompany: boolean, party: "company" | "officer"): ComputedLiability {
  const d = Math.max(0, Math.trunc(days));
  const dailyDays = Math.max(0, d - (l.perDayFrom - 1));
  const raw = l.base + l.perDay * dailyDays;
  const full = l.cap === null ? raw : Math.min(raw, l.cap);
  const capped = l.cap !== null && raw > l.cap;
  const payable = smallCompany ? Math.min(Math.floor(full / 2), S446B_CAP[party]) : full;

  const parts: string[] = [];
  if (l.base) parts.push(fmt(l.base));
  if (l.perDay) {
    parts.push(
      `${fmt(l.perDay)} × ${dailyDays} day${dailyDays === 1 ? "" : "s"}${l.perDayFrom === 2 ? " (after the first)" : ""}`,
    );
  }
  let workings = parts.join(" + ") || fmt(0);
  if (capped) workings += `, capped at ${fmt(l.cap!)}`;
  if (smallCompany) workings += `; halved under s.446B (max ${fmt(S446B_CAP[party])})`;
  return { full, payable, workings, capped };
}

export type PenaltyEstimate =
  | {
      type: "penalty";
      company: ComputedLiability | null;
      officer: ComputedLiability | null;
    }
  | {
      type: "fine";
      company: { min: number; max: number } | null;
      officer: { min: number; max: number } | null;
      imprisonment?: string;
    };

/** The exposure after `days` of continuing default. */
export function estimatePenalty(rule: PenaltyRule, days: number, smallCompany: boolean): PenaltyEstimate {
  if (rule.type === "penalty") {
    return {
      type: "penalty",
      company: rule.company ? computeLiability(rule.company, days, smallCompany, "company") : null,
      officer: rule.officer ? computeLiability(rule.officer, days, smallCompany, "officer") : null,
    };
  }
  const range = (p: { min: number; max: number; perDayMax?: number } | null) =>
    p ? { min: p.min, max: p.max + (p.perDayMax ?? 0) * Math.max(0, Math.trunc(days)) } : null;
  return { type: "fine", company: range(rule.company), officer: range(rule.officer), imprisonment: rule.imprisonment };
}

function fmt(n: number): string {
  return `₹${new Intl.NumberFormat("en-IN").format(n)}`;
}

/* ------------------------------------------------------------------ */

export type ResolvedPenalty = {
  violation: PenaltyViolation;
  section: ActSection;
};

export function resolvePenalty(id: string): ResolvedPenalty | null {
  const violation = PENALTY_VIOLATIONS.find((v) => v.id === id);
  if (!violation) return null;
  const section = findSection(violation.sectionNumber);
  if (!section) return null;
  return { violation, section };
}
