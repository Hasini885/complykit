import { dueDates } from "@/data/due-dates";
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
  formatDate,
  parseIsoDate,
} from "@/lib/dates";

/** INC-20A applies to companies incorporated on or after this date. */
export const INC_20A_FROM = new Date(2018, 10, 2);

/** Auditor appointment term under Section 139(1). */
export const AUDITOR_TERM_YEARS = 5;

/**
 * True when the working financial year IS the company's first one — the case
 * where Section 96 allows nine months for the AGM instead of six.
 */
export function isFirstFinancialYear(opts) {
  if (!opts.incorporatedOn) return false;
  return firstFinancialYearEnd(opts.incorporatedOn).getTime() === financialYearEnd(opts.fyEndingYear).getTime();
}

/**
 * Last date for this year's AGM: six months from the year end (nine for the
 * first AGM), and never more than fifteen months after the previous AGM.
 */
export function statutoryAgmDate(opts) {
  const isFirst = isFirstFinancialYear(opts);
  const sixMonths = agmDeadline(financialYearEnd(opts.fyEndingYear), isFirst);
  if (isFirst || !opts.previousAgmDate) return sixMonths;
  const fifteen = addMonths(opts.previousAgmDate, 15);
  return fifteen.getTime() < sixMonths.getTime() ? fifteen : sixMonths;
}

/** Whether the company's own facts rule an obligation in or out for this year. */
function appliesOnFacts(source, opts) {
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
      // Section 139(1): the first AGM appoints the subsequent auditor, so its ADT-1 is always due.
      // The annual table shows it under the year after (see buildAnnualDuesRows).
      if (isFirstFinancialYear(opts)) return true;
      const anchor = facts.auditorAppointedAtAgmFy;
      if (anchor === null) return false;
      const yearsOn = opts.fyEndingYear - anchor;
      const term = Math.min(AUDITOR_TERM_YEARS, Math.max(1, Math.trunc(facts.auditorTermYears || AUDITOR_TERM_YEARS)));
      return yearsOn >= 0 && yearsOn % term === 0;
    }
    case "first-auditor":
      // Its own switch; the ADT-1 after an AGM (above) is not affected by it.
      return facts.filesFirstAdt1 !== false && facts.filesAdt1 !== false;
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
function adjustOnFacts(source, opts) {
  const facts = opts.facts;
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
function withExtension(formId, fyEndingYear, due, auditCase = true) {
  const found = relaxationFor(formId, fyEndingYear);
  const r = found && (!found.auditCasesOnly || auditCase) ? found : null;
  const until = r ? parseIsoDate(r.feeFreeUntil) : null;
  // Where the Act's own date is already the later one (a first AGM, say, or a
  // transfer-pricing return), the circular gives nothing, so nothing is said.
  if (!r || !until || due === null || until.getTime() <= due.getTime()) {
    return { due, relief: null, statutoryDue: null, extendedBy: null };
  }
  const withoutFee = r.extendsDueDate ? "" : " without additional fee";
  return {
    due: until,
    relief: `Extended to ${formatDate(until)}${withoutFee} by ${r.circular}. Statutory due date ${formatDate(due)}.`,
    statutoryDue: due,
    extendedBy: `${r.circular}${r.extendsDueDate ? "" : ", without additional fee"}`,
  };
}

function resolveRule(rule, opts) {
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
          due: rule.months !== undefined ? addMonths(fyEnd, rule.months) : addDays(fyEnd, rule.days ?? 0),
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
export function resolveDueDates(opts) {
  const asOf = opts.asOf ? midnight(opts.asOf) : today();

  const applicable = dueDates.filter((d) => {
    if (!d.appliesTo.includes(opts.companyType)) return false;
    if (!appliesOnFacts(d, opts)) return false;
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

    return resolveRule(rule, opts).map((r) => ({
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
export function groupByMonth(items) {
  const groups = new Map();
  const undated = [];

  for (const item of items) {
    if (!item.due) {
      undated.push(item);
      continue;
    }
    const key = `${item.due.getFullYear()}-${String(item.due.getMonth()).padStart(2, "0")}`;
    const label = item.due.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    if (!groups.has(key)) groups.set(key, { label, items: [] });
    groups.get(key).items.push(item);
  }

  return {
    months: [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v),
    undated,
  };
}
