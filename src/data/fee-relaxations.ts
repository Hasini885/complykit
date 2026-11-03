import { parseIsoDate } from "@/lib/dates";

/**
 * MCA circulars that waive the additional fee for a filing season.
 *
 * The calendar treats the circular's last date as the effective due date for
 * the forms and year it covers (the statutory date is kept alongside it). The
 * AGM itself is not extended. Filed after that last date, the additional fee
 * is reckoned from the original statutory due date. Add each new circular
 * here; the late-fee calculator and every due-date view read this list.
 */

export type FeeRelaxation = {
  id: string;
  /** Form ids from src/data/forms.ts this covers. */
  formIds: string[];
  /** The financial year whose filings it covers (year of its 31 March). */
  fyEndingYear: number;
  /** ISO date: filed on or before this, no additional fee. */
  feeFreeUntil: string;
  circular: string;
  /** Shown beside affected dues and in the calculator. */
  summary: string;
  /** Only for entities whose accounts are audited (an LLP below the tax-audit limit is left out). */
  auditCasesOnly?: boolean;
  /** True where the circular extends the due date itself, not just the additional fee. */
  extendsDueDate?: boolean;
};

export const FEE_RELAXATIONS: FeeRelaxation[] = [
  {
    id: "gc-05-2026-aoc4",
    formIds: ["aoc-4", "aoc-4-cfs"],
    fyEndingYear: 2026,
    feeFreeUntil: "2026-12-31",
    circular: "MCA General Circular No. 05/2026 (24 October 2026)",
    summary: "No additional fee if FY 2025–26 financial statements are filed by 31 Dec 2026",
  },
  {
    id: "gc-05-2026-mgt7",
    formIds: ["mgt-7", "mgt-7a"],
    fyEndingYear: 2026,
    feeFreeUntil: "2027-01-31",
    circular: "MCA General Circular No. 05/2026 (24 October 2026)",
    summary: "No additional fee if the FY 2025–26 annual return is filed by 31 Jan 2027",
  },
  {
    // Income tax: matched on the obligation id "itr" (there is no MCA form).
    id: "cbdt-07-2026-itr",
    formIds: ["itr"],
    fyEndingYear: 2026,
    feeFreeUntil: "2026-11-21",
    circular: "CBDT Circular No. 07/2026 (28 September 2026)",
    summary: "FY 2025–26 return for audit cases extended to 21 Nov 2026",
    auditCasesOnly: true,
    extendsDueDate: true,
  },
];

/** The relaxation covering this form for this financial year, if any. */
export function relaxationFor(formId: string | null, fyEndingYear: number): FeeRelaxation | null {
  if (!formId) return null;
  return FEE_RELAXATIONS.find((r) => r.fyEndingYear === fyEndingYear && r.formIds.includes(formId)) ?? null;
}

/** True when a filing on `filedOn` is inside the relaxation's fee-free window. */
export function waivesFee(relaxation: FeeRelaxation, filedOn: Date): boolean {
  const until = parseIsoDate(relaxation.feeFreeUntil);
  return until !== null && filedOn.getTime() <= until.getTime();
}
