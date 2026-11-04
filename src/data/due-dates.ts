/**
 * Recurring statutory due dates.
 *
 * UNVERIFIED SEED DATA — must be reviewed by a practising CA/CS before launch.
 * Dates are extended by MCA circular more often than any other item in this
 * toolkit. Check the current position before relying on a date here.
 *
 * Each entry describes HOW its date is derived rather than hard-coding a date,
 * so the tracker recomputes for any financial year. Where a company type is
 * treated differently — notably the One Person Company, which holds no annual
 * general meeting — the difference is expressed as an override rather than as
 * prose the reader has to notice.
 */

import type { CompanyType } from "@/lib/dates";

export const DUE_DATE_CATEGORIES = [
  "Annual filing",
  "Income tax",
  "Meeting",
  "Half-yearly",
  "KYC",
  "One-time",
] as const;

export type DueDateCategory = (typeof DUE_DATE_CATEGORIES)[number];

/** How a due date is derived. */
export type DueRule =
  /** A calendar date in the year following the financial year end. */
  | { kind: "fixed"; month: number; day: number; yearOffset?: number }
  /** Two calendar dates a year. */
  | { kind: "half-yearly"; dates: { month: number; day: number; yearOffset?: number; covers: string }[] }
  /** Counted from the annual general meeting (its statutory last date, absent an actual one). */
  | { kind: "from-agm"; days: number }
  /** Counted from the close of the financial year. */
  | { kind: "from-fy-end"; days?: number; months?: number }
  /** Counted from the date of incorporation — one-time, first-year obligations. */
  | { kind: "from-incorporation"; days: number }
  /** No single date — a cadence requirement. */
  | { kind: "cadence"; description: string };

export type RecurringDueDate = {
  id: string;
  title: string;
  /** Form id in src/data/forms.ts, where one exists. */
  formId: string | null;
  formCode: string | null;
  section: string;
  category: DueDateCategory;
  appliesTo: CompanyType[];
  rule: DueRule;
  /** Rules that replace the default for a particular company type. */
  overrides?: Partial<Record<CompanyType, { rule: DueRule; because: string }>>;
  /**
   * Only include this obligation when the company was incorporated within
   * this many days. Used for one-time first-year duties that would otherwise
   * clutter every established company's calendar forever.
   */
  onlyWithinDaysOfIncorporation?: number;
  note: string;
};

/*
 * The AGM's own last date is deliberately not listed as a due (removed at the
 * owner's request). It is still worked out — statutoryAgmDate() in
 * src/lib/resolve-due-dates.ts — because AOC-4, MGT-7 and ADT-1 count from it.
 */
export const dueDates: RecurringDueDate[] = [
  {
    id: "first-board-meeting",
    title: "First Board meeting",
    formId: null,
    formCode: null,
    section: "Section 173(1)",
    category: "One-time",
    appliesTo: ["private", "public", "opc", "section8"],
    rule: { kind: "from-incorporation", days: 30 },
    onlyWithinDaysOfIncorporation: 30,
    note: "Within 30 days of incorporation. A One Person Company with a single director records the resolution in the minutes book instead of holding a meeting. Shown only while the company is newly incorporated — it drops off the calendar once that window has passed.",
  },
  {
    id: "first-auditor",
    title: "File ADT-1 for the first auditor",
    formId: "adt-1",
    formCode: "ADT-1",
    section: "Section 139(6)",
    category: "One-time",
    appliesTo: ["private", "public", "opc", "section8"],
    rule: { kind: "from-incorporation", days: 45 },
    // Stays on the calendar for 90 days past the deadline, so a missed one shows as overdue.
    onlyWithinDaysOfIncorporation: 135,
    note: "Due 45 days from incorporation: the Board appoints the first auditor within 30 days, and ADT-1 is filed within 15 days of that appointment. Shown on the calendar while the company is newly incorporated; it stays under Post incorporation compliance until filed.",
  },
  {
    id: "board-meetings",
    title: "Board meetings for the year",
    formId: null,
    formCode: null,
    section: "Section 173",
    category: "Meeting",
    appliesTo: ["private", "public", "opc", "section8"],
    rule: {
      kind: "cadence",
      description: "Four meetings a year, with no more than 120 days between two consecutive meetings",
    },
    overrides: {
      opc: {
        rule: {
          kind: "cadence",
          description: "Two meetings a year, one in each half, with at least 90 days between them",
        },
        because: "A One Person Company follows the reduced cadence, as does a small or dormant company.",
      },
    },
    note: "A One Person Company with a single director records the resolution in the minutes book instead of holding a meeting.",
  },
  {
    id: "aoc-4",
    title: "Financial statements",
    formId: "aoc-4",
    formCode: "AOC-4",
    section: "Section 137",
    category: "Annual filing",
    appliesTo: ["private", "public", "opc", "section8"],
    rule: { kind: "from-agm", days: 30 },
    overrides: {
      opc: {
        rule: { kind: "from-fy-end", days: 180 },
        because:
          "A One Person Company holds no annual general meeting, so the 180-day limb in the proviso to Section 137(1) applies instead.",
      },
    },
    note: "Where no annual general meeting is held, the 30 days run from the last date on which it ought to have been held.",
  },
  {
    id: "mgt-7",
    title: "Annual return",
    formId: "mgt-7",
    formCode: "MGT-7 / MGT-7A",
    section: "Section 92",
    category: "Annual filing",
    appliesTo: ["private", "public", "opc", "section8"],
    rule: { kind: "from-agm", days: 60 },
    note: "MGT-7A where the company is a One Person Company or a small company. For a One Person Company the period runs from the date on which the annual general meeting would otherwise have been due.",
  },
  {
    id: "adt-1",
    title: "Subsequent auditor appointment",
    formId: "adt-1",
    formCode: "ADT-1",
    section: "Section 139(1)",
    category: "Annual filing",
    appliesTo: ["private", "public", "opc", "section8"],
    rule: { kind: "from-agm", days: 15 },
    note: "Only due in a year in which an auditor is actually appointed or re-appointed. Where a five-year term is running, there is nothing to file.",
  },
  {
    id: "inc-20a",
    title: "Declaration for commencement of business",
    formId: "inc-20a",
    formCode: "INC-20A",
    section: "Section 10A",
    category: "One-time",
    appliesTo: ["private", "public", "opc", "section8"],
    rule: { kind: "from-incorporation", days: 180 },
    // Stays on the calendar for 90 days past the deadline, so a missed one shows as overdue.
    onlyWithinDaysOfIncorporation: 270,
    note: "Within 180 days of incorporation, every company with share capital incorporated on or after 2 November 2018 declares that subscribers have paid for their shares. Until it is filed the company cannot commence business or borrow. Default: ₹50,000 on the company and ₹1,000 a day on each officer (up to ₹1,00,000), and the Registrar may strike the company off.",
  },
  {
    id: "itr",
    title: "Income tax return",
    formId: null,
    formCode: "ITR-6",
    section: "Section 139(1), Income-tax Act",
    category: "Income tax",
    appliesTo: ["private", "public", "opc", "section8", "llp"],
    rule: { kind: "fixed", month: 10, day: 31 },
    overrides: {
      llp: {
        rule: { kind: "fixed", month: 8, day: 31 },
        because:
          "An LLP whose accounts are not audited files ITR-5 by 31 August; an audited LLP by 31 October.",
      },
    },
    note: "Every company files ITR-6 by 31 October following the financial year, as its accounts are audited; 30 November where a transfer-pricing report (Form 3CEB) is required. Returns for FY 2025-26 are filed under the Income-tax Act, 1961; from tax year 2026-27 the Income-tax Act, 2025 applies, so confirm the form number then. Late filing attracts a fee under Section 234F and interest under Section 234A.",
  },
  {
    id: "dpt-3",
    title: "Return of deposits",
    formId: "dpt-3",
    formCode: "DPT-3",
    section: "Rule 16, Deposit Rules",
    category: "Annual filing",
    appliesTo: ["private", "public", "opc", "section8"],
    rule: { kind: "fixed", month: 6, day: 30 },
    note: "Position as at 31 March, including receipts that are exempt from being treated as deposits. A NIL return is still a filing.",
  },
  {
    id: "dir-3-kyc",
    title: "Director KYC",
    formId: "dir-3-kyc",
    formCode: "DIR-3 KYC",
    section: "Rule 12A",
    category: "KYC",
    appliesTo: ["private", "public", "opc", "section8", "llp"],
    rule: { kind: "fixed", month: 6, day: 30 },
    note: "Due once every three financial years by 30 June, not annually — the cycle runs from the financial year the DIN was allotted. Shown here in every year because whether it falls due depends on the individual, not the company. Missing it deactivates the number and costs ₹5,000 to restore.",
  },
  {
    id: "msme-1",
    title: "Dues to micro and small enterprises",
    formId: "msme-1",
    formCode: "MSME-1",
    section: "Order under Section 405",
    category: "Half-yearly",
    appliesTo: ["private", "public", "opc", "section8"],
    rule: {
      kind: "half-yearly",
      dates: [
        { month: 10, day: 31, yearOffset: -1, covers: "April to September" },
        { month: 4, day: 30, covers: "October to March" },
      ],
    },
    note: "Only amounts owed to micro and small suppliers, outstanding beyond 45 days. Medium enterprises are outside this return. From 1 April 2025 a micro enterprise is one with investment up to ₹2.5 crore and turnover up to ₹10 crore, and a small enterprise up to ₹25 crore and ₹100 crore (S.O. 1364(E)), so more suppliers now count.",
  },
  {
    id: "pas-6",
    title: "Reconciliation of share capital",
    formId: "pas-6",
    formCode: "PAS-6",
    section: "Rule 9A(8), PAS Rules",
    category: "Half-yearly",
    appliesTo: ["public"],
    rule: {
      kind: "half-yearly",
      dates: [
        { month: 11, day: 29, yearOffset: -1, covers: "April to September" },
        { month: 5, day: 30, covers: "October to March" },
      ],
    },
    note: "Applies to unlisted public companies. Sixty days from the close of each half-year.",
  },
  {
    id: "llp-11",
    title: "LLP annual return",
    formId: "llp-form-11",
    formCode: "LLP Form 11",
    section: "Section 35, LLP Act",
    category: "Annual filing",
    appliesTo: ["llp"],
    rule: { kind: "fixed", month: 5, day: 30 },
    note: "Within 60 days of the close of the financial year, which for an LLP is always 31 March.",
  },
  {
    id: "llp-8",
    title: "LLP statement of account and solvency",
    formId: "llp-form-8",
    formCode: "LLP Form 8",
    section: "Section 34(3), LLP Act",
    category: "Annual filing",
    appliesTo: ["llp"],
    rule: { kind: "fixed", month: 10, day: 30 },
    note: "Within 30 days from the end of six months after the financial year close.",
  },
];
