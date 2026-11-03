import { dueDates, type DueRule, type RecurringDueDate } from "@/data/due-dates";
import { relaxationFor } from "@/data/fee-relaxations";
import {
  addDays,
  addMonths,
  agmDeadline,
  daysBetween,
  financialYearEnd,
  firstFinancialYearEnd,
  makeDate,
  midnight,
  today,
  type CompanyType,
  formatDate,
  parseIsoDate,
} from "@/lib/dates";

export type ResolvedDueDate = {
  source: RecurringDueDate;
  /** Null for cadence obligations, which have no single date. */
  due: Date | null;
  /** Cadence text, or the half-year a dated entry covers. */
  qualifier: string | null;
  /** Set when this company type is treated differently from the default. */
  overrideReason: string | null;
  /** True where the date was derived from the statutory last date for the AGM. */
  anchoredOnAssumedAgm: boolean;
  /** The financial year this obligation belongs to (year of its 31 March). */
  fyEndingYear: number;
  /** Set where the deadline has been met: the date it was filed. */
  filedOn?: Date | null;
  /** The SRN of that filing, where one was recorded. */
  srn?: string | null;
  /** An MCA relaxation for this filing, e.g. "Extended to 31 Dec 2026 by …". */
  relief?: string | null;
  /**
   * The date the Act itself gives, where an MCA circular has moved the
   * effective due date (`due`) later. Absent when no extension applies.
   */
  statutoryDue?: Date | null;
  /**
   * Set when the user changed this one occurrence's date for convenience:
   * the date it had before (statutory, or as extended by a circular).
   */
  originalDue?: Date | null;
  /** The user's note on why the date was changed. */
  customNote?: string | null;
};

/**
 * Facts from a company's saved profile that decide whether an obligation
 * applies at all. Absent (the generic calendar), everything that applies to
 * the entity type is shown.
 */
export type CompanyFacts = {
  listed: boolean;
  msmeDuesOver45Days: boolean;
  /**
   * Financial year (year of its 31 March) whose AGM appointed the current
   * auditor. The appointment runs for five years, so ADT-1 recurs every fifth
   * year from here. Null when unknown: ADT-1 is then left out rather than
   * shown as a false every-year filing.
   */
  auditorAppointedAtAgmFy: number | null;
  /** Term of the current auditor in years (1 to 5); ADT-1 recurs when it ends. */
  auditorTermYears: number;
  /**
   * DIR-3 KYC is personal to each director, so a company calendar shows it
   * per director (src/lib/portfolio/schedule.ts) instead of as one company row.
   */
  kycHandledPerDirector: boolean;
  /** Ticked on the company profile: DPT-3 is filed only when it is. */
  filesDpt3: boolean;
  /** False when the profile marks ADT-1 as not applicable; absent means it applies. */
  filesAdt1?: boolean;
  /** False when the profile marks INC-20A as not applicable; absent means it applies. */
  filesInc20a?: boolean;
  /**
   * The Board meeting that appointed the first auditor (Section 139(6)), where
   * recorded. The first-auditor row then shows ADT-1 due 15 days after it,
   * rather than the 30-day deadline to make the appointment.
   */
  firstAuditorAppointedOn?: Date | null;
  /** Private company within the small-company limits, or an OPC: files MGT-7A. */
  smallCompany: boolean;
  /** A transfer-pricing report is due, moving the ITR to 30 November. */
  transferPricing: boolean;
  /** An LLP whose accounts are audited files its ITR by 31 October, else 31 August. */
  llpTaxAudit: boolean;
};

/** INC-20A applies to companies incorporated on or after this date. */
export const INC_20A_FROM = new Date(2018, 10, 2);

/** Auditor appointment term under Section 139(1). */
export const AUDITOR_TERM_YEARS = 5;

export type ResolveOptions = {
  companyType: CompanyType;
  /** Calendar year in which the financial year ends, e.g. 2026 for FY 2025-26. */
  fyEndingYear: number;
  /** Actual AGM date for THIS financial year, where known. Absent, the statutory last date is used. */
  agmDate?: Date | null;
  /**
   * The AGM actually held for the previous financial year. Section 96 allows
   * no more than fifteen months between two AGMs, which can bring this year's
   * last date forward of the usual six months.
   */
  previousAgmDate?: Date | null;
  /** The company's own profile, where there is one. */
  facts?: CompanyFacts;
  /**
   * Date of incorporation. Drives the first-year rules: the nine-month first
   * AGM under Section 96, and the one-time duties counted from incorporation.
   * Absent, those rules are simply skipped rather than guessed at.
   */
  incorporatedOn?: Date | null;
  /** Overridable for tests; defaults to today. */
  asOf?: Date;
};

/**
 * True when the working financial year IS the company's first one — the case
 * where Section 96 allows nine months for the AGM instead of six.
 */
export function isFirstFinancialYear(opts: ResolveOptions): boolean {
  if (!opts.incorporatedOn) return false;
  return (
    firstFinancialYearEnd(opts.incorporatedOn).getTime() ===
    financialYearEnd(opts.fyEndingYear).getTime()
  );
}

/**
 * Last date for this year's AGM: six months from the year end (nine for the
 * first AGM), and never more than fifteen months after the previous AGM.
 */
export function statutoryAgmDate(opts: ResolveOptions): Date {
  const isFirst = isFirstFinancialYear(opts);
  const sixMonths = agmDeadline(financialYearEnd(opts.fyEndingYear), isFirst);
  if (isFirst || !opts.previousAgmDate) return sixMonths;
  const fifteen = addMonths(opts.previousAgmDate, 15);
  return fifteen.getTime() < sixMonths.getTime() ? fifteen : sixMonths;
}

/** Whether the company's own facts rule an obligation in or out for this year. */
function appliesOnFacts(source: RecurringDueDate, opts: ResolveOptions): boolean {
  const facts = opts.facts;
  if (!facts) return true;
  switch (source.id) {
    case "msme-1":
      return facts.msmeDuesOver45Days;
    case "pas-6":
      // Listed companies reconcile capital under SEBI rules instead.
      return !facts.listed;
    case "adt-1": {
      if (facts.filesAdt1 === false) return false;
      // Section 139(1): the first AGM appoints the auditor, so its ADT-1 is always due.
      if (isFirstFinancialYear(opts)) return true;
      const anchor = facts.auditorAppointedAtAgmFy;
      if (anchor === null) return false;
      const yearsOn = opts.fyEndingYear - anchor;
      const term = Math.min(AUDITOR_TERM_YEARS, Math.max(1, Math.trunc(facts.auditorTermYears || AUDITOR_TERM_YEARS)));
      return yearsOn >= 0 && yearsOn % term === 0;
    }
    case "first-auditor":
      // The first auditor's ADT-1, so the same switch rules it out.
      return facts.filesAdt1 !== false;
    case "dir-3-kyc":
      return !facts.kycHandledPerDirector;
    case "dpt-3":
      return facts.filesDpt3;
    case "inc-20a":
      if (facts.filesInc20a === false) return false;
      return opts.incorporatedOn ? opts.incorporatedOn.getTime() >= INC_20A_FROM.getTime() : false;
    default:
      return true;
  }
}

/**
 * Where the company's own facts change which form, or which date, applies:
 * MGT-7A for a small company or OPC; ITR-5 for an LLP; the ITR on 30 November
 * with a transfer-pricing report, or 31 October for an audited LLP.
 */
function adjustOnFacts(
  source: RecurringDueDate,
  opts: ResolveOptions,
): { source: RecurringDueDate; rule?: DueRule; because?: string } {
  const facts = opts.facts;
  if (source.id === "first-auditor" && facts?.firstAuditorAppointedOn && opts.incorporatedOn) {
    // Rule 4(2) of the Audit Rules: ADT-1 within 15 days of the appointment.
    const days = daysBetween(midnight(opts.incorporatedOn), midnight(facts.firstAuditorAppointedOn)) + 15;
    return {
      source: {
        ...source,
        title: "File ADT-1 for the first auditor",
        note: "The Board appointed the first auditor (Section 139(6)), who holds office until the first AGM. ADT-1 is filed within 15 days of that Board meeting.",
      },
      rule: { kind: "from-incorporation", days },
    };
  }
  if (source.id === "mgt-7" && facts) {
    const abridged = facts.smallCompany || opts.companyType === "opc";
    return { source: { ...source, formCode: abridged ? "MGT-7A" : "MGT-7", formId: abridged ? "mgt-7a" : "mgt-7" } };
  }
  if (source.id === "itr") {
    if (opts.companyType === "llp") {
      const ltd = { ...source, formCode: "ITR-5" };
      if (facts?.llpTaxAudit) {
        return {
          source: ltd,
          rule: { kind: "fixed", month: 10, day: 31 },
          because: "Turnover over ₹1 crore: the accounts are audited, so ITR-5 is due by 31 October.",
        };
      }
      return { source: ltd };
    }
    if (opts.companyType === "section8") {
      // Registered under Section 12A for the income-tax exemption: ITR-7.
      return { source: { ...source, formCode: "ITR-7 / ITR-6" } };
    }
    if (facts?.transferPricing) {
      return {
        source,
        rule: { kind: "fixed", month: 11, day: 30 },
        because: "A transfer-pricing report (Form 3CEB) is required, so ITR-6 is due by 30 November.",
      };
    }
  }
  return { source };
}

/**
 * Applies an MCA circular that extends a filing season: the effective due date
 * becomes the circular's last date (never earlier than the statutory one), and
 * the statutory date is kept alongside it for reference.
 */
function withExtension(
  formId: string | null,
  fyEndingYear: number,
  due: Date | null,
  auditCase = true,
): Pick<ResolvedDueDate, "due" | "relief" | "statutoryDue"> {
  const found = relaxationFor(formId, fyEndingYear);
  const r = found && (!found.auditCasesOnly || auditCase) ? found : null;
  const until = r ? parseIsoDate(r.feeFreeUntil) : null;
  if (!r || !until || due === null) return { due, relief: null, statutoryDue: null };
  if (until.getTime() <= due.getTime()) {
    return { due, relief: `${r.summary} (${r.circular})`, statutoryDue: null };
  }
  return {
    due: until,
    relief: `Extended to ${formatDate(until)}${r.extendsDueDate ? "" : " without additional fee"} by ${r.circular}. Statutory due date ${formatDate(due)}.`,
    statutoryDue: due,
  };
}

function resolveRule(
  rule: DueRule,
  opts: ResolveOptions,
): { due: Date | null; qualifier: string | null; usedAssumedAgm: boolean }[] {
  const fyEnd = financialYearEnd(opts.fyEndingYear);

  switch (rule.kind) {
    case "fixed":
      return [
        {
          due: makeDate(opts.fyEndingYear + (rule.yearOffset ?? 0), rule.month, rule.day),
          qualifier: null,
          usedAssumedAgm: false,
        },
      ];

    case "half-yearly":
      return rule.dates.map((d) => ({
        due: makeDate(opts.fyEndingYear + (d.yearOffset ?? 0), d.month, d.day),
        qualifier: d.covers,
        usedAssumedAgm: false,
      }));

    case "from-fy-end":
      return [
        {
          due:
            rule.months !== undefined
              ? addMonths(fyEnd, rule.months)
              : addDays(fyEnd, rule.days ?? 0),
          qualifier: null,
          usedAssumedAgm: false,
        },
      ];

    case "from-incorporation":
      return opts.incorporatedOn
        ? [{ due: addDays(opts.incorporatedOn, rule.days), qualifier: null, usedAssumedAgm: false }]
        : [];

    case "from-agm": {
      const assumed = !opts.agmDate;
      const anchor = opts.agmDate ?? statutoryAgmDate(opts);
      return [{ due: addDays(anchor, rule.days), qualifier: null, usedAssumedAgm: assumed }];
    }

    case "cadence":
      return [{ due: null, qualifier: rule.description, usedAssumedAgm: false }];
  }
}

/**
 * Resolves every recurring obligation that applies to a company type into
 * concrete dates for the chosen financial year.
 *
 * Sorted by date, with cadence obligations (which have no date) last.
 */
export function resolveDueDates(opts: ResolveOptions): ResolvedDueDate[] {
  const asOf = opts.asOf ? midnight(opts.asOf) : today();

  const applicable = dueDates.filter((d) => {
    if (!d.appliesTo.includes(opts.companyType)) return false;
    if (!appliesOnFacts(d, opts)) return false;
    // The first auditor, once appointed: ADT-1 belongs to the year of that
    // Board meeting, shown then and only then (not tied to the 30-day window).
    const appointed = d.id === "first-auditor" ? opts.facts?.firstAuditorAppointedOn : null;
    if (appointed) {
      const fy = appointed.getMonth() <= 2 ? appointed.getFullYear() : appointed.getFullYear() + 1;
      return fy === opts.fyEndingYear && !!opts.incorporatedOn;
    }
    // One-time first-year duties drop off once their window has passed, and
    // never appear at all for a company whose incorporation date is unknown.
    if (d.onlyWithinDaysOfIncorporation !== undefined) {
      if (!opts.incorporatedOn) return false;
      const age = daysBetween(midnight(opts.incorporatedOn), asOf);
      if (age < 0 || age > d.onlyWithinDaysOfIncorporation) return false;
    }
    return true;
  });

  const resolved = applicable.flatMap((base) => {
    const override = base.overrides?.[opts.companyType];
    const adjusted = adjustOnFacts(base, opts);
    const source = adjusted.source;
    const rule = adjusted.rule ?? override?.rule ?? source.rule;

    return resolveRule(rule, opts).map<ResolvedDueDate>((r) => ({
      source,
      qualifier: r.qualifier,
      overrideReason: adjusted.because ?? override?.because ?? null,
      anchoredOnAssumedAgm: r.usedAssumedAgm,
      fyEndingYear: opts.fyEndingYear,
      ...withExtension(
        source.formId ?? source.id,
        opts.fyEndingYear,
        r.due,
        // Every company is audited; an LLP only above the tax-audit limit.
        opts.companyType !== "llp" || opts.facts?.llpTaxAudit === true,
      ),
    }));
  });

  return resolved.sort((a, b) => {
    if (a.due === null && b.due === null) return 0;
    if (a.due === null) return 1;
    if (b.due === null) return -1;
    return a.due.getTime() - b.due.getTime();
  });
}

/** Groups dated obligations by calendar month, preserving date order. */
export function groupByMonth(items: ResolvedDueDate[]) {
  const groups = new Map<string, { label: string; items: ResolvedDueDate[] }>();
  const undated: ResolvedDueDate[] = [];

  for (const item of items) {
    if (!item.due) {
      undated.push(item);
      continue;
    }
    const key = `${item.due.getFullYear()}-${String(item.due.getMonth()).padStart(2, "0")}`;
    const label = item.due.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    if (!groups.has(key)) groups.set(key, { label, items: [] });
    groups.get(key)!.items.push(item);
  }

  return {
    months: [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v),
    undated,
  };
}
