import type { CompanyType } from "@/lib/dates";

/**
 * Applicability rules engine for the Companies Act, 2013.
 *
 * UNVERIFIED SEED DATA — thresholds are amended by notification. Every figure
 * below needs checking against the current Rules before this goes live. Two
 * items (Cost Records & Audit, MSME-1 when unflagged) are deliberately never
 * resolved to a hard yes/no here — see their comments for why.
 *
 * All monetary inputs are plain rupees, not crore, so the UI can show a number
 * exactly as a user would type it from a balance sheet.
 */

const CR = 10_000_000; // 1 crore in rupees

export type CompanyProfile = {
  entityType: CompanyType;
  listed: boolean;
  paidUpCapital: number;
  turnover: number;
  netWorth: number;
  /** Net profit for the preceding financial year. */
  netProfit: number;
  borrowings: number;
  deposits: number;
  msmeDuesOver45Days: boolean;
  securitiesInDemat: boolean;
};

export function emptyProfile(): CompanyProfile {
  return {
    entityType: "private",
    listed: false,
    paidUpCapital: 0,
    turnover: 0,
    netWorth: 0,
    netProfit: 0,
    borrowings: 0,
    deposits: 0,
    msmeDuesOver45Days: false,
    securitiesInDemat: false,
  };
}

export type ApplicabilityStatus = "applicable" | "review" | "not-applicable";

export type ApplicabilityCategory =
  | "Accounts & Audit"
  | "Annual Filings"
  | "Board & Governance"
  | "Directors / KMP";

export const APPLICABILITY_CATEGORIES: ApplicabilityCategory[] = [
  "Accounts & Audit",
  "Annual Filings",
  "Board & Governance",
  "Directors / KMP",
];

export type ApplicabilityResult = {
  id: string;
  title: string;
  category: ApplicabilityCategory;
  status: ApplicabilityStatus;
  refs: string[];
  reason: string;
};

/* ------------------------------------------------------------------ */
/* Threshold tests — each isolated so it can be unit-tested on its own */
/* ------------------------------------------------------------------ */

/**
 * Section 2(85): a private company, not a holding or subsidiary of another
 * company, with paid-up capital and turnover both within the limit.
 *
 * The profile form has no holding/subsidiary field, so this tests only the
 * two figures — the reason text says so wherever it matters, rather than
 * silently assuming the company is standalone.
 */
export function isSmallByFigures(p: CompanyProfile): boolean {
  return (
    p.entityType === "private" &&
    p.paidUpCapital <= SMALL_COMPANY_LIMITS.paidUpCapital &&
    p.turnover <= SMALL_COMPANY_LIMITS.turnover
  );
}

/**
 * Rule 2(1)(t), Companies (Specification of Definitions Details) Rules, as
 * amended by G.S.R. 880(E) with effect from 1 December 2025 (previously
 * ₹4 crore and ₹40 crore).
 */
export const SMALL_COMPANY_LIMITS = { paidUpCapital: 10 * CR, turnover: 100 * CR } as const;

/** Section 135: net worth, turnover or net profit crosses the trigger. */
export function csrApplies(p: CompanyProfile): boolean {
  return p.netWorth >= 500 * CR || p.turnover >= 1000 * CR || p.netProfit >= 5 * CR;
}

/** Section 138, Rule 13. */
export function internalAuditApplies(p: CompanyProfile): boolean {
  if (p.listed) return true;
  if (p.entityType === "public") {
    return p.paidUpCapital >= 50 * CR || p.turnover >= 200 * CR || p.borrowings >= 100 * CR || p.deposits >= 25 * CR;
  }
  if (p.entityType === "private") {
    return p.turnover >= 200 * CR || p.borrowings >= 100 * CR;
  }
  return false;
}

/** Section 204, Rule 9. */
export function secretarialAuditApplies(p: CompanyProfile): boolean {
  if (p.listed) return true;
  if (p.entityType === "public") {
    return p.paidUpCapital >= 50 * CR || p.turnover >= 250 * CR || p.borrowings >= 100 * CR;
  }
  return p.borrowings >= 100 * CR;
}

/** Section 149(1) proviso, Rule 3 — at least one woman director. */
export function womanDirectorApplies(p: CompanyProfile): boolean {
  if (p.listed) return true;
  return p.entityType === "public" && (p.paidUpCapital >= 100 * CR || p.turnover >= 300 * CR);
}

/**
 * Section 149(4), Rule 4 — at least two independent directors.
 * Rule 6 mirrors this threshold for the Audit Committee and NRC.
 */
export function independentDirectorsApply(p: CompanyProfile): boolean {
  if (p.listed && p.entityType === "public") return true;
  if (p.entityType !== "public") return false;
  return p.paidUpCapital >= 10 * CR || p.turnover >= 100 * CR || p.borrowings + p.deposits > 50 * CR;
}

/** Section 177 & 178, Rule 6 — Audit Committee and Nomination & Remuneration Committee. */
export function auditCommitteeApplies(p: CompanyProfile): boolean {
  return independentDirectorsApply(p);
}

/** Section 203, Rule 8 — whole-time KMP (MD/manager or CEO, CS, CFO). */
export function wholeTimeKmpApplies(p: CompanyProfile): boolean {
  return p.listed || (p.entityType === "public" && p.paidUpCapital >= 10 * CR);
}

/** Rule 8A, Companies (Appointment and Remuneration of Managerial Personnel) Rules. */
export function wholeTimeCsApplies(p: CompanyProfile): boolean {
  return p.paidUpCapital >= 10 * CR;
}

/** Companies (Filing of Documents and Forms in XBRL) Rules, 2015. */
export function xbrlApplies(p: CompanyProfile): boolean {
  return p.listed || p.paidUpCapital >= 5 * CR || p.turnover >= 100 * CR;
}

/** Section 92(2), Rule 11(2) — annual return certified by a PCS in MGT-8. */
export function mgt8Applies(p: CompanyProfile): boolean {
  return p.listed || p.paidUpCapital >= 10 * CR || p.turnover >= 50 * CR;
}

/**
 * Rule 9A (unlisted public companies) and Rule 9B (private companies that are
 * not small companies) — the MCA mandate to hold and transact securities in
 * dematerialised form. Listed companies are outside this specific rule; they
 * sit under SEBI's depository regulations instead.
 */
export function dematMandateApplies(p: CompanyProfile): boolean {
  if (p.listed) return false;
  if (p.entityType === "public") return true; // Rule 9A: every unlisted public company
  if (p.entityType === "private") return !isSmallForRule9B(p); // Rule 9B
  return false;
}

/**
 * Rule 9B fixes small-company status as at 31 March 2023, under the limits in
 * force then (₹4 crore paid-up, ₹40 crore turnover) — not today's higher
 * limits. A company that was not small then stays bound (deadline 30 June 2025,
 * G.S.R. 131(E)). The profile holds current figures, so this is an
 * approximation: check the company's 31 March 2023 figures before advising.
 */
export function isSmallForRule9B(p: CompanyProfile): boolean {
  return p.entityType === "private" && p.paidUpCapital <= 4 * CR && p.turnover <= 40 * CR;
}

/* ------------------------------------------------------------------ */
/* The engine                                                          */
/* ------------------------------------------------------------------ */

function isCompany(p: CompanyProfile): boolean {
  return p.entityType !== "llp";
}

export function evaluateApplicability(p: CompanyProfile): ApplicabilityResult[] {
  const small = isSmallByFigures(p);
  const results: ApplicabilityResult[] = [];

  if (!isCompany(p)) {
    // An LLP sits entirely outside the Companies Act — say so once, plainly,
    // rather than working through twenty items that all resolve to "no".
    return [
      {
        id: "llp-notice",
        title: "This profile is an LLP",
        category: "Annual Filings",
        status: "review",
        refs: ["LLP Act, 2008"],
        reason:
          "None of the Companies Act, 2013 requirements below apply to an LLP. An LLP instead files Form 8 and Form 11 under the LLP Act — see the Forms library and the Compliance Calendar.",
      },
    ];
  }

  results.push({
    id: "statutory-audit",
    title: "Statutory Audit",
    category: "Accounts & Audit",
    status: "applicable",
    refs: ["Sec 139", "ADT-1"],
    reason: "Mandatory for every company, regardless of size.",
  });

  results.push({
    id: "aoc-4",
    title: "Financial Statements filing (AOC-4)",
    category: "Accounts & Audit",
    status: "applicable",
    refs: ["Sec 137", "AOC-4"],
    reason: "Every company files audited financials with the Registrar, within 30 days of the AGM.",
  });

  {
    const applies = xbrlApplies(p);
    results.push({
      id: "xbrl",
      title: "Filing in XBRL (AOC-4 XBRL)",
      category: "Accounts & Audit",
      status: applies ? "applicable" : "not-applicable",
      refs: ["XBRL Rules 2015", "AOC-4 XBRL"],
      reason: applies
        ? p.listed
          ? "Listed companies (and their Indian subsidiaries) file in XBRL regardless of size."
          : `Paid-up capital or turnover crosses the XBRL trigger (₹5 cr paid-up / ₹100 cr turnover).`
        : "Below XBRL triggers — file ordinary AOC-4.",
    });
  }

  {
    const applies = internalAuditApplies(p);
    results.push({
      id: "internal-audit",
      title: "Internal Audit",
      category: "Accounts & Audit",
      status: applies ? "applicable" : "not-applicable",
      refs: ["Sec 138", "Rule 13"],
      reason: applies
        ? p.listed
          ? "Every listed company must appoint an internal auditor."
          : "A Rule 13 threshold is crossed on paid-up capital, turnover, borrowings or deposits."
        : "Below internal-audit thresholds.",
    });
  }

  // Cost audit is genuinely undecidable from these inputs — it depends on the
  // specific industry (the regulated/non-regulated sector tables under the
  // Companies (Cost Records and Audit) Rules, 2014), which this form does not
  // ask for. It always lands in "review", never a hard yes or no.
  results.push({
    id: "cost-audit",
    title: "Cost Records & Audit",
    category: "Accounts & Audit",
    status: "review",
    refs: ["Sec 148", "CRA-4"],
    reason:
      "Depends on your industry (regulated or non-regulated sector) and turnover — review the specified sectors list in the Cost Records and Audit Rules.",
  });

  {
    const applies = secretarialAuditApplies(p);
    results.push({
      id: "secretarial-audit",
      title: "Secretarial Audit (MR-3)",
      category: "Accounts & Audit",
      status: applies ? "applicable" : "not-applicable",
      refs: ["Sec 204", "Rule 9"],
      reason: applies
        ? p.listed
          ? "Every listed company must annex a secretarial audit report to its Board's Report."
          : "A Rule 9 threshold is crossed on paid-up capital, turnover or borrowings."
        : "Secretarial audit not required.",
    });
  }

  results.push({
    id: "annual-return",
    title: `Annual Return (${small || p.entityType === "opc" ? "MGT-7A" : "MGT-7"})`,
    category: "Annual Filings",
    status: "applicable",
    refs: ["Sec 92", small || p.entityType === "opc" ? "MGT-7A" : "MGT-7"],
    reason:
      small || p.entityType === "opc"
        ? "An OPC or small company files the abridged MGT-7A."
        : "Filed in the ordinary MGT-7, within 60 days of the AGM.",
  });

  {
    const applies = mgt8Applies(p);
    results.push({
      id: "mgt-8",
      title: "Annual Return certification by a PCS (MGT-8)",
      category: "Annual Filings",
      status: applies ? "applicable" : "not-applicable",
      refs: ["Sec 92(2)", "MGT-8"],
      reason: applies
        ? "Listed, or paid-up capital of ₹10 cr or turnover of ₹50 cr or more, so the annual return needs a practising company secretary's certificate."
        : "PCS certification of the annual return is not required.",
    });
  }

  results.push({
    id: "dpt-3",
    title: "Return of Deposits (DPT-3)",
    category: "Annual Filings",
    status: "applicable",
    refs: ["Rule 16", "DPT-3"],
    reason: "Every company, other than a government company, files DPT-3 by 30 June — a NIL return if there is nothing to report.",
  });

  {
    const flagged = p.msmeDuesOver45Days;
    results.push({
      id: "msme-1",
      title: "MSME-1 half-yearly return",
      category: "Annual Filings",
      status: flagged ? "applicable" : "not-applicable",
      refs: ["Sec 405", "MSME-1"],
      reason: flagged
        ? "Dues to micro or small suppliers are flagged as outstanding beyond 45 days, so this half-yearly return is due."
        : "Applies only where payments to micro or small suppliers are outstanding beyond 45 days — none are flagged on this profile. Recheck if that changes during the year.",
    });
  }

  {
    const standard = !(small || p.entityType === "opc");
    results.push({
      id: "board-meetings",
      title: "Minimum Board Meetings",
      category: "Board & Governance",
      status: "applicable",
      refs: ["Sec 173"],
      reason: standard
        ? "Four meetings a year, with no more than 120 days between two consecutive meetings."
        : "OPC / small company: at least one per half-year, with a gap of at least 90 days between the two.",
    });
  }

  {
    const applies = auditCommitteeApplies(p);
    results.push({
      id: "audit-committee",
      title: "Audit Committee & NRC",
      category: "Board & Governance",
      status: applies ? "applicable" : "not-applicable",
      refs: ["Sec 177 & 178", "Rule 6"],
      reason: applies
        ? "A Rule 6 threshold is crossed, so both the Audit Committee and the Nomination & Remuneration Committee are required."
        : "Board committees not mandatory.",
    });
  }

  {
    const applies = csrApplies(p);
    results.push({
      id: "csr",
      title: "CSR Committee & 2% spend",
      category: "Board & Governance",
      status: applies ? "applicable" : "not-applicable",
      refs: ["Sec 135"],
      reason: applies
        ? "Net worth, turnover or net profit for the preceding financial year crosses a Section 135 threshold — a CSR Committee and a spend of 2% of average net profits are required."
        : "Below all CSR thresholds. (Note: the Corporate Laws (Amendment) Bill, 2026 proposes raising the net-profit trigger to ₹10 cr. The Joint Parliamentary Committee's report was tabled on 3 August 2026, but the Bill was not passed in the Monsoon Session and is NOT yet law, so the ₹5 cr trigger continues to apply.)",
    });
  }

  {
    const applies = dematMandateApplies(p);
    results.push({
      id: "demat",
      title: "Dematerialisation of securities",
      category: "Board & Governance",
      status: applies ? "applicable" : "not-applicable",
      refs: ["Rule 9A/9B"],
      reason: applies
        ? p.entityType === "public"
          ? "Every unlisted public company must facilitate and use dematerialised securities (Rule 9A)."
          : "A private company that was not a small company on 31 March 2023 (₹4 crore paid-up / ₹40 crore turnover, the limits then) had to demat its securities by 30 June 2025 (Rule 9B). Check the 31 March 2023 figures — these are the current ones."
        : "Small companies (as at 31 March 2023 for Rule 9B), OPCs and listed companies (governed separately under SEBI depository rules) are outside this specific MCA mandate.",
    });
  }

  {
    const mandateApplies = dematMandateApplies(p);
    const status: ApplicabilityStatus = !mandateApplies
      ? "not-applicable"
      : p.securitiesInDemat
        ? "applicable"
        : "review";
    results.push({
      id: "pas-6",
      title: "Reconciliation of Share Capital (PAS-6)",
      category: "Board & Governance",
      status,
      refs: ["Rule 9A(8) r/w 9B", "PAS-6"],
      reason: !mandateApplies
        ? "Applies to unlisted public / non-small private companies whose securities are in demat form — this profile is outside the demat mandate."
        : p.securitiesInDemat
          ? "The demat mandate applies and securities are already in dematerialised form — PAS-6 is due half-yearly."
          : "The demat mandate applies to this profile, but securities are not yet flagged as dematerialised. PAS-6 becomes due once they are.",
    });
  }

  {
    const applies = womanDirectorApplies(p);
    results.push({
      id: "woman-director",
      title: "Woman Director",
      category: "Directors / KMP",
      status: applies ? "applicable" : "not-applicable",
      refs: ["Sec 149(1)", "Rule 3"],
      reason: applies
        ? p.listed
          ? "Every listed company must appoint at least one woman director."
          : "Paid-up capital of ₹100 cr or turnover of ₹300 cr or more, so a woman director is required."
        : "Below the woman-director threshold.",
    });
  }

  {
    const applies = independentDirectorsApply(p);
    results.push({
      id: "independent-directors",
      title: "Independent Directors (at least two)",
      category: "Directors / KMP",
      status: applies ? "applicable" : "not-applicable",
      refs: ["Sec 149(4)", "Rule 4"],
      reason: applies
        ? "A listed public company, or a public company crossing a Rule 4 threshold, so at least two independent directors are required."
        : "Independent directors not mandatory.",
    });
  }

  {
    const applies = wholeTimeKmpApplies(p);
    results.push({
      id: "whole-time-kmp",
      title: "Whole-time KMP (MD/CEO, CS, CFO)",
      category: "Directors / KMP",
      status: applies ? "applicable" : "not-applicable",
      refs: ["Sec 203", "Rule 8"],
      reason: applies
        ? p.listed
          ? "Every listed company must appoint the whole-time key managerial personnel set."
          : "Public company with paid-up capital of ₹10 cr or more."
        : "Whole-time KMP set not mandatory.",
    });
  }

  {
    const applies = wholeTimeCsApplies(p);
    results.push({
      id: "whole-time-cs",
      title: "Whole-time Company Secretary",
      category: "Directors / KMP",
      status: applies ? "applicable" : "not-applicable",
      refs: ["Rule 8A"],
      reason: applies
        ? "Paid-up capital of ₹10 cr or more, so a whole-time company secretary is required."
        : "Below ₹10 cr paid-up — a whole-time CS is not mandatory.",
    });
  }

  results.push({
    id: "dir-3-kyc",
    title: "DIR-3 KYC of all directors",
    category: "Directors / KMP",
    status: "applicable",
    refs: ["Rule 12A", "DIR-3 KYC"],
    reason:
      "Every DIN holder files KYC once every three financial years, by 30 June (w.e.f. 31 March 2026).",
  });

  return results;
}

export function summarise(results: ApplicabilityResult[]) {
  return {
    applicable: results.filter((r) => r.status === "applicable").length,
    review: results.filter((r) => r.status === "review").length,
    notApplicable: results.filter((r) => r.status === "not-applicable").length,
  };
}
