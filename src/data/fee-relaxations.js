import { parseIsoDate } from "@/lib/dates";

export const FEE_RELAXATIONS = [
  {
    id: "gc-02-2026-dpt3",
    formIds: ["dpt-3"],
    fyEndingYear: 2026,
    feeFreeUntil: "2026-07-31",
    circular: "MCA General Circular No. 02/2026 (19 June 2026)",
    summary: "No additional fee if the FY 2025–26 DPT-3 is filed by 31 Jul 2026",
  },
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
export function relaxationFor(formId, fyEndingYear) {
  if (!formId) return null;
  return FEE_RELAXATIONS.find((r) => r.fyEndingYear === fyEndingYear && r.formIds.includes(formId)) ?? null;
}

/** True when a filing on `filedOn` is inside the relaxation's fee-free window. */
export function waivesFee(relaxation, filedOn) {
  const until = parseIsoDate(relaxation.feeFreeUntil);
  return until !== null && filedOn.getTime() <= until.getTime();
}
