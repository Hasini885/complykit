import type { BeyondRocRule } from "@/lib/beyond-roc";

/**
 * Compliance obligations outside the Companies Act, 2013 — GST, income tax and
 * TDS, labour law, SEBI LODR and FEMA/RBI.
 *
 * ALL registration-dependent: every row here applies only where the entity
 * actually holds the relevant registration (GST, EPF/ESI code, a listing, an
 * FEMA-reportable transaction). Nothing here is checked against a client's
 * actual registrations — this is a reference calendar, not a filter.
 *
 * Reviewed October 2026 against: the Income-tax Act, 2025 and Income-tax
 * Rules, 2026 (in force 1 April 2026; new TDS/TCS form numbers from tax year
 * 2026-27), CBDT Circular 07/2026 (tax audit and audit-case ITR extended for
 * FY 2025-26), the four Labour Codes (in force 21 November 2025), SEBI
 * integrated filing, and the FEMA (Borrowing and Lending) (First Amendment)
 * Regulations, 2026 (event-based ECB-2). These sit outside the Companies Act
 * sections this project otherwise specialises in.
 * `confidence: "review"` marks a row researched for this build with a lower
 * bar of certainty than the rest: verify it against the source portal before
 * relying on it. See the per-row `note` for what specifically to check.
 */

export type BeyondRocCategory =
  | "GST"
  | "Income Tax & TDS"
  | "Labour (PF/ESI/PT)"
  | "SEBI LODR"
  | "FEMA/RBI";

export const BEYOND_ROC_CATEGORIES: BeyondRocCategory[] = [
  "GST",
  "Income Tax & TDS",
  "Labour (PF/ESI/PT)",
  "SEBI LODR",
  "FEMA/RBI",
];

export type Frequency = "Monthly" | "Quarterly" | "Half-yearly" | "Annual" | "Event-driven";

export type BeyondRocItem = {
  id: string;
  formCode: string;
  title: string;
  category: BeyondRocCategory;
  frequency: Frequency;
  /** Plain-language rule, shown verbatim in the table. */
  scheduleText: string;
  rule: BeyondRocRule;
  reference: string;
  /** "verified" = well-established figure; "review" = researched for this build, confirm before launch. */
  confidence: "verified" | "review";
  note?: string;
};

export const beyondRocItems: BeyondRocItem[] = [
  /* ---------------- GST ---------------- */
  {
    id: "gstr-1",
    formCode: "GSTR-1",
    title: "Outward supplies return (monthly)",
    category: "GST",
    frequency: "Monthly",
    scheduleText: "11th of the following month",
    rule: { kind: "monthly", day: 11 },
    reference: "CGST Rules",
    confidence: "verified",
    note: "Returns cannot be filed more than three years after their due date (Sections 37(5), 39(11) and 44(2), CGST Act, enforced on the portal from the July 2025 tax period).",
  },
  {
    id: "gstr-3b",
    formCode: "GSTR-3B",
    title: "Summary return and tax payment (monthly)",
    category: "GST",
    frequency: "Monthly",
    scheduleText: "20th of the following month",
    rule: { kind: "monthly", day: 20 },
    reference: "CGST Rules",
    confidence: "verified",
    note: "Returns cannot be filed more than three years after their due date (Sections 37(5), 39(11) and 44(2), CGST Act, enforced on the portal from the July 2025 tax period).",
  },
  {
    id: "gstr-1-qrmp",
    formCode: "GSTR-1 (QRMP)",
    title: "Quarterly return (QRMP scheme)",
    category: "GST",
    frequency: "Quarterly",
    scheduleText: "13th of the month after the quarter",
    rule: {
      kind: "quarterly",
      quarters: [
        { endMonth: 6, dueMonth: 7, dueDay: 13 },
        { endMonth: 9, dueMonth: 10, dueDay: 13 },
        { endMonth: 12, dueMonth: 1, dueDay: 13 },
        { endMonth: 3, dueMonth: 4, dueDay: 13 },
      ],
    },
    reference: "QRMP scheme",
    confidence: "verified",
  },
  {
    id: "cmp-08",
    formCode: "CMP-08",
    title: "Composition — statement-cum-challan",
    category: "GST",
    frequency: "Quarterly",
    scheduleText: "18th of the month after the quarter",
    rule: {
      kind: "quarterly",
      quarters: [
        { endMonth: 6, dueMonth: 7, dueDay: 18 },
        { endMonth: 9, dueMonth: 10, dueDay: 18 },
        { endMonth: 12, dueMonth: 1, dueDay: 18 },
        { endMonth: 3, dueMonth: 4, dueDay: 18 },
      ],
    },
    reference: "Composition scheme",
    confidence: "verified",
  },
  {
    id: "gstr-9",
    formCode: "GSTR-9 / 9C",
    title: "Annual return and reconciliation",
    category: "GST",
    frequency: "Annual",
    scheduleText: "31 December, for the previous financial year",
    rule: { kind: "annual", month: 12, day: 31 },
    reference: "Section 44, CGST Act",
    confidence: "verified",
    note: "GSTR-9 for FY 2025-26 is due 31 December 2026. Returns cannot be filed more than three years after their due date (Sections 37(5), 39(11) and 44(2), CGST Act, enforced on the portal from the July 2025 tax period).",
  },

  /* ---------------- Income Tax & TDS ---------------- */
  {
    id: "tds-return-q1",
    formCode: "Form 138/140/144 (Q1)",
    title: "TDS/TCS quarterly return — Q1 (Apr–Jun)",
    category: "Income Tax & TDS",
    frequency: "Quarterly",
    scheduleText: "31 July",
    rule: { kind: "quarterly", quarters: [{ endMonth: 6, dueMonth: 7, dueDay: 31 }] },
    reference: "Income-tax Act, 2025 and Income-tax Rules, 2026",
    confidence: "review",
    note: "From tax year 2026-27 (quarters from April 2026) TDS statements are filed in the new forms: 138 (salary, formerly 24Q), 140 (other residents, formerly 26Q) and 144 (non-residents, formerly 27Q); TCS in Form 143 (formerly 27EQ), on the same dates. Quarters up to March 2026 stay on the old forms. The due dates are unchanged.",
  },
  {
    id: "tds-return-q2",
    formCode: "Form 138/140/144 (Q2)",
    title: "TDS/TCS quarterly return — Q2 (Jul–Sep)",
    category: "Income Tax & TDS",
    frequency: "Quarterly",
    scheduleText: "31 October",
    rule: { kind: "quarterly", quarters: [{ endMonth: 9, dueMonth: 10, dueDay: 31 }] },
    reference: "Income-tax Act, 2025 and Income-tax Rules, 2026",
    confidence: "review",
    note: "From tax year 2026-27 (quarters from April 2026) TDS statements are filed in the new forms: 138 (salary, formerly 24Q), 140 (other residents, formerly 26Q) and 144 (non-residents, formerly 27Q); TCS in Form 143 (formerly 27EQ), on the same dates. Quarters up to March 2026 stay on the old forms. The due dates are unchanged.",
  },
  {
    id: "tds-return-q3",
    formCode: "Form 138/140/144 (Q3)",
    title: "TDS/TCS quarterly return — Q3 (Oct–Dec)",
    category: "Income Tax & TDS",
    frequency: "Quarterly",
    scheduleText: "31 January",
    rule: { kind: "quarterly", quarters: [{ endMonth: 12, dueMonth: 1, dueDay: 31 }] },
    reference: "Income-tax Act, 2025 and Income-tax Rules, 2026",
    confidence: "review",
    note: "From tax year 2026-27 (quarters from April 2026) TDS statements are filed in the new forms: 138 (salary, formerly 24Q), 140 (other residents, formerly 26Q) and 144 (non-residents, formerly 27Q); TCS in Form 143 (formerly 27EQ), on the same dates. Quarters up to March 2026 stay on the old forms. The due dates are unchanged.",
  },
  {
    id: "tds-return-q4",
    formCode: "Form 138/140/144 (Q4)",
    title: "TDS/TCS quarterly return — Q4 (Jan–Mar)",
    category: "Income Tax & TDS",
    frequency: "Quarterly",
    scheduleText: "31 May",
    rule: { kind: "quarterly", quarters: [{ endMonth: 3, dueMonth: 5, dueDay: 31 }] },
    reference: "Income-tax Act, 2025 and Income-tax Rules, 2026",
    confidence: "review",
    note: "From tax year 2026-27 (quarters from April 2026) TDS statements are filed in the new forms: 138 (salary, formerly 24Q), 140 (other residents, formerly 26Q) and 144 (non-residents, formerly 27Q); TCS in Form 143 (formerly 27EQ), on the same dates. Quarters up to March 2026 stay on the old forms. The due dates are unchanged. The fourth quarter alone gets two months.",
  },
  {
    id: "tds-payment",
    formCode: "Challan 281",
    title: "TDS/TCS deposit (monthly)",
    category: "Income Tax & TDS",
    frequency: "Monthly",
    scheduleText: "7th of the following month (30 April for March)",
    rule: { kind: "monthly", day: 7 },
    reference: "Income-tax Act, 2025 (Section 200 of the 1961 Act)",
    confidence: "review",
    note: "Deposit by the 7th of the following month; tax deducted in March by 30 April. That March exception is not modelled by the monthly rule here, so check it each April.",
  },
  {
    id: "advance-tax-q1",
    formCode: "Challan 280",
    title: "Advance tax — 15% of estimated liability",
    category: "Income Tax & TDS",
    frequency: "Quarterly",
    scheduleText: "15 June",
    rule: { kind: "quarterly", quarters: [{ endMonth: 6, dueMonth: 6, dueDay: 15 }] },
    reference: "Section 408, Income-tax Act, 2025 (Section 211 of the 1961 Act)",
    confidence: "verified",
  },
  {
    id: "advance-tax-q2",
    formCode: "Challan 280",
    title: "Advance tax — 45% cumulative",
    category: "Income Tax & TDS",
    frequency: "Quarterly",
    scheduleText: "15 September",
    rule: { kind: "quarterly", quarters: [{ endMonth: 9, dueMonth: 9, dueDay: 15 }] },
    reference: "Section 408, Income-tax Act, 2025 (Section 211 of the 1961 Act)",
    confidence: "verified",
  },
  {
    id: "advance-tax-q3",
    formCode: "Challan 280",
    title: "Advance tax — 75% cumulative",
    category: "Income Tax & TDS",
    frequency: "Quarterly",
    scheduleText: "15 December",
    rule: { kind: "quarterly", quarters: [{ endMonth: 12, dueMonth: 12, dueDay: 15 }] },
    reference: "Section 408, Income-tax Act, 2025 (Section 211 of the 1961 Act)",
    confidence: "verified",
  },
  {
    id: "advance-tax-q4",
    formCode: "Challan 280",
    title: "Advance tax — 100% cumulative",
    category: "Income Tax & TDS",
    frequency: "Quarterly",
    scheduleText: "15 March",
    rule: { kind: "quarterly", quarters: [{ endMonth: 3, dueMonth: 3, dueDay: 15 }] },
    reference: "Section 408, Income-tax Act, 2025 (Section 211 of the 1961 Act)",
    confidence: "verified",
  },
  {
    id: "tax-audit",
    formCode: "Form 3CA/3CB-3CD",
    title: "Tax audit report",
    category: "Income Tax & TDS",
    frequency: "Annual",
    scheduleText: "30 September, for the preceding financial year (FY 2025-26: extended to 21 October 2026)",
    rule: {
      kind: "annual",
      month: 9,
      day: 30,
      extensions: [{ replaces: "2026-09-30", to: "2026-10-21", source: "CBDT Circular 07/2026" }],
    },
    reference: "Section 44AB, Income-tax Act",
    confidence: "verified",
    note: "CBDT Circular 07/2026 (28 September 2026) extended the FY 2025-26 tax audit report to 21 October 2026. FY 2025-26 is the last year audited under the Income-tax Act, 1961; from tax year 2026-27 the Income-tax Act, 2025 applies.",
  },
  {
    id: "itr-audit-cases",
    formCode: "ITR-6",
    title: "Company income tax return (audit cases)",
    category: "Income Tax & TDS",
    frequency: "Annual",
    scheduleText: "31 October, for the preceding financial year (FY 2025-26: extended to 21 November 2026)",
    rule: {
      kind: "annual",
      month: 10,
      day: 31,
      extensions: [{ replaces: "2026-10-31", to: "2026-11-21", source: "CBDT Circular 07/2026" }],
    },
    reference: "Section 139(1), Income-tax Act",
    confidence: "review",
    note: "CBDT Circular 07/2026 extended the FY 2025-26 return for audit cases to 21 November 2026. Where a transfer-pricing report is required, the date is 30 November. Section 8 companies with Section 12A registration file ITR-7.",
  },

  /* ---------------- Labour (PF/ESI/PT) ---------------- */
  {
    id: "epf-payment",
    formCode: "ECR",
    title: "Provident Fund contribution (monthly)",
    category: "Labour (PF/ESI/PT)",
    frequency: "Monthly",
    scheduleText: "15th of the following month",
    rule: { kind: "monthly", day: 15 },
    reference: "Code on Social Security, 2020 (in force 21 November 2025); formerly the EPF & MP Act, 1952",
    confidence: "verified",
    note: "Under the Labour Codes, 'wages' must be at least 50% of total pay (allowances above half are added back), which raises the PF and ESI base for many salary structures. The monthly due date is unchanged.",
  },
  {
    id: "esi-payment",
    formCode: "ESI Challan",
    title: "ESI contribution (monthly)",
    category: "Labour (PF/ESI/PT)",
    frequency: "Monthly",
    scheduleText: "15th of the following month",
    rule: { kind: "monthly", day: 15 },
    reference: "Code on Social Security, 2020 (in force 21 November 2025); formerly the ESI Act, 1948",
    confidence: "verified",
    note: "Under the Labour Codes, 'wages' must be at least 50% of total pay (allowances above half are added back), which raises the PF and ESI base for many salary structures. The monthly due date is unchanged.",
  },
  {
    id: "professional-tax",
    formCode: "PT Challan",
    title: "Professional tax (monthly)",
    category: "Labour (PF/ESI/PT)",
    frequency: "Monthly",
    scheduleText: "Commonly the 15th of the following month",
    rule: { kind: "monthly", day: 15 },
    reference: "State Professional Tax Act",
    confidence: "review",
    note: "Professional tax is a state subject — the due date, slab and even whether it applies at all varies by state. This row shows a common date, not a specific state's rule. Confirm against the Act of the state the entity operates in.",
  },

  /* ---------------- SEBI LODR (listed companies only) ---------------- */
  {
    id: "lodr-reg33-q",
    formCode: "Reg. 33",
    title: "Quarterly financial results",
    category: "SEBI LODR",
    frequency: "Quarterly",
    scheduleText: "Within 45 days of the quarter end (Q1–Q3)",
    rule: {
      kind: "quarterly",
      quarters: [
        { endMonth: 6, dueMonth: 8, dueDay: 14 },
        { endMonth: 9, dueMonth: 11, dueDay: 14 },
        { endMonth: 12, dueMonth: 2, dueDay: 14 },
      ],
    },
    reference: "Regulation 33, SEBI (LODR) Regulations, 2015",
    confidence: "review",
    note: "Integrated Filing (Financial), within 45 days of each of the first three quarter ends. The Q4/annual result gets 60 days from the financial year end and is shown as a separate row.",
  },
  {
    id: "lodr-reg33-annual",
    formCode: "Reg. 33",
    title: "Annual financial results (Q4)",
    category: "SEBI LODR",
    frequency: "Annual",
    scheduleText: "Within 60 days of the financial year end",
    rule: { kind: "annual", month: 5, day: 30 },
    reference: "Regulation 33, SEBI (LODR) Regulations, 2015",
    confidence: "verified",
  },
  {
    id: "lodr-reg27",
    formCode: "Reg. 27",
    title: "Corporate governance compliance report",
    category: "SEBI LODR",
    frequency: "Quarterly",
    scheduleText: "Within 30 days of the quarter end, in the Integrated Filing (Governance)",
    rule: {
      kind: "quarterly",
      quarters: [
        { endMonth: 6, dueMonth: 7, dueDay: 30 },
        { endMonth: 9, dueMonth: 10, dueDay: 30 },
        { endMonth: 12, dueMonth: 1, dueDay: 30 },
        { endMonth: 3, dueMonth: 4, dueDay: 30 },
      ],
    },
    reference: "Regulation 27(2), SEBI (LODR) Regulations, 2015",
    confidence: "verified",
    note: "Since SEBI's integrated filing framework (circular SEBI/HO/CFD/CFD-PoD-2/CIR/P/2024/185, effective for filings from 31 December 2024), the corporate governance report is part of the quarterly Integrated Filing (Governance), due within 30 days of the quarter end; the older 21-day figure no longer applies.",
  },
  {
    id: "lodr-reg24a",
    formCode: "Reg. 24A",
    title: "Annual secretarial compliance report",
    category: "SEBI LODR",
    frequency: "Annual",
    scheduleText: "Within 60 days of the financial year end",
    rule: { kind: "annual", month: 5, day: 30 },
    reference: "Regulation 24A, SEBI (LODR) Regulations, 2015",
    confidence: "verified",
    note: "Since 1 April 2025 the report must be signed by the secretarial auditor or a peer-reviewed company secretary, and the secretarial auditor is appointed for five-year terms (one term for an individual, two for a firm).",
  },
  {
    id: "lodr-reg7",
    formCode: "Reg. 7(3)",
    title: "Compliance certificate on share transfer facility",
    category: "SEBI LODR",
    frequency: "Half-yearly",
    scheduleText: "Within 30 days of each half-year end (31 March, 30 September)",
    rule: {
      kind: "quarterly",
      quarters: [
        { endMonth: 3, dueMonth: 4, dueDay: 30 },
        { endMonth: 9, dueMonth: 10, dueDay: 30 },
      ],
    },
    reference: "Regulation 7(3), SEBI (LODR) Regulations, 2015",
    confidence: "verified",
  },

  /* ---------------- FEMA/RBI ---------------- */
  {
    id: "fla-return",
    formCode: "FLA",
    title: "Foreign Liabilities and Assets annual return",
    category: "FEMA/RBI",
    frequency: "Annual",
    scheduleText: "15 July, for the preceding financial year",
    rule: { kind: "annual", month: 7, day: 15 },
    reference: "FEMA (Reporting) Regulations",
    confidence: "verified",
    note: "Applies to any entity that has received FDI or made an overseas investment in any prior year, including a year with no fresh transaction. For FY 2025-26 the RBI extended the date to 31 July 2026 as a one-off; plan on 15 July for FY 2026-27. The revised return on audited figures is due by 30 September.",
  },
  {
    id: "ecb-2",
    formCode: "ECB-2",
    title: "External commercial borrowing return (event-based)",
    category: "FEMA/RBI",
    frequency: "Event-driven",
    scheduleText: "Within 7 calendar days after the month in which ECB is drawn or serviced",
    rule: { kind: "event" },
    reference: "FEMA (Borrowing and Lending) (First Amendment) Regulations, 2026; A.P. (DIR Series) Circular No. 23 (18 Feb 2026)",
    confidence: "verified",
    note: "From 16 February 2026 ECB-2 is no longer a monthly return: it is filed only for a month in which ECB proceeds are drawn down or debt is serviced, within 7 calendar days after that month ends. Changes to reported terms go in a Revised Form ECB 1 on the same timeline. Applies only where the entity has an ECB.",
  },
  {
    id: "apr-odi",
    formCode: "APR",
    title: "Annual Performance Report for overseas investment",
    category: "FEMA/RBI",
    frequency: "Annual",
    scheduleText: "31 December, for the preceding financial year",
    rule: { kind: "annual", month: 12, day: 31 },
    reference: "FEMA (Overseas Investment) Rules, 2022",
    confidence: "review",
    note: "Applies only where the entity holds a foreign subsidiary, joint venture or other overseas direct investment. Confirm the exact due date against the current Overseas Investment rules.",
  },
  {
    id: "fc-gpr",
    formCode: "FC-GPR",
    title: "Report of shares allotted to a non-resident",
    category: "FEMA/RBI",
    frequency: "Event-driven",
    scheduleText: "Within 30 days of allotment",
    rule: { kind: "event" },
    reference: "FEMA (Non-Debt Instruments) Rules, 2019",
    confidence: "verified",
  },
  {
    id: "fc-trs",
    formCode: "FC-TRS",
    title: "Report of a share transfer between a resident and a non-resident",
    category: "FEMA/RBI",
    frequency: "Event-driven",
    scheduleText: "Within 60 days of the transfer, or receipt of funds",
    rule: { kind: "event" },
    reference: "FEMA (Non-Debt Instruments) Rules, 2019",
    confidence: "verified",
  },
];
