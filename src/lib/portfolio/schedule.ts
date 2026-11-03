import { dueDates } from "@/data/due-dates";
import {
  addDays,
  firstFinancialYearEnd,
  formatDate,
  makeDate,
  midnight,
  parseIsoDate,
  today,
  type CompanyType,
} from "@/lib/dates";
import {
  AUDITOR_TERM_YEARS,
  resolveDueDates,
  type CompanyFacts,
  type ResolvedDueDate,
} from "@/lib/resolve-due-dates";
import { agmFyOf, applicabilityProfileFor } from "@/lib/portfolio/clients";
import { isSmallByFigures } from "@/lib/applicability";

/** Tax audit under Section 44AB: turnover over ₹1 crore (higher limits for mostly-digital receipts aside). */
const LLP_TAX_AUDIT_TURNOVER = 1_00_00_000;
import { applyFilings } from "@/lib/portfolio/filings";
import { applyDueOverrides } from "@/lib/portfolio/due-overrides";
import {
  dinAt,
  financialYearEndYear,
  firstKycDueDate,
  KYC_CYCLE_YEARS,
  KYC_DUE_DAY,
  KYC_DUE_MONTH,
  KYC_LATE_FEE,
} from "@/lib/portfolio/directors";
import { CESSATION_REASONS, type Client, type Director } from "@/lib/portfolio/types";

/**
 * One company's compliance schedule, worked out from its own profile.
 *
 * Nothing here is a fixed date. Every year is recomputed from the company's
 * facts: its type and incorporation date, the AGM actually held for each
 * year, the year its auditor was appointed, its MSME and listing position,
 * and each of its directors' DIN allotment dates. Today's date only decides
 * which slice of that schedule is current, so the calendar rolls into the
 * next year on its own.
 */

/* ------------------------------------------------------------------ */
/* Facts from the profile                                              */
/* ------------------------------------------------------------------ */

/** Every AGM on record, keyed by the financial year it was held for. */
export function agmDatesByFy(client: Client): Map<number, Date> {
  const out = new Map<number, Date>();
  for (const iso of [...(client.agmHistory ?? []), client.lastAgmOn ?? ""]) {
    const d = iso ? parseIsoDate(iso) : null;
    if (d) out.set(agmFyOf(d), d);
  }
  return out;
}

/** Year of the 31 March that closes the company's first financial year. */
export function firstFyEndingYear(client: Client): number | null {
  const inc = parseIsoDate(client.incorporatedOn);
  return inc ? firstFinancialYearEnd(inc).getFullYear() : null;
}

/**
 * The year whose AGM appointed the current auditor. Saved explicitly where
 * the auditor changed; otherwise the first AGM appointed one for five years,
 * so the cycle runs from the first financial year.
 */
export function auditorAnchorFy(client: Client): number | null {
  const first = firstFyEndingYear(client);
  const saved = client.auditorAppointedAtAgmFy ?? null;
  // No AGM can come before the company's first: an earlier year is a slip.
  if (saved !== null && first !== null) return Math.max(saved, first);
  return saved ?? first;
}

/** Term of the current auditor in years, 1 to 5 (Section 139(1)). */
export function auditorTermOf(client: Client): number {
  return Math.min(AUDITOR_TERM_YEARS, Math.max(1, Math.trunc(client.auditorTermYears || AUDITOR_TERM_YEARS)));
}

/**
 * The first financial year, from `fromFy` on, whose AGM appoints an auditor
 * and so needs ADT-1: the year the current term runs out.
 */
export function nextAdtFy(client: Client, fromFy: number): number | null {
  const anchor = auditorAnchorFy(client);
  if (anchor === null) return null;
  const term = auditorTermOf(client);
  return anchor + Math.max(0, Math.ceil((fromFy - anchor) / term)) * term;
}

export function factsFor(client: Client): CompanyFacts {
  return {
    listed: client.listed ?? false,
    msmeDuesOver45Days: client.msmeDuesOver45Days ?? false,
    auditorAppointedAtAgmFy: auditorAnchorFy(client),
    auditorTermYears: client.auditorTermYears ?? AUDITOR_TERM_YEARS,
    kycHandledPerDirector: true,
    filesDpt3: client.filesDpt3 ?? false,
    filesAdt1: client.filesAdt1 ?? true,
    filesInc20a: client.filesInc20a ?? true,
    firstAuditorAppointedOn:
      client.auditorType === "first" && client.firstAuditorAppointedOn ? parseIsoDate(client.firstAuditorAppointedOn) : null,
    smallCompany: isSmallByFigures(applicabilityProfileFor(client)),
    transferPricing: client.transferPricing ?? false,
    llpTaxAudit: client.type === "llp" && (client.turnover ?? 0) > LLP_TAX_AUDIT_TURNOVER,
  };
}

/* ------------------------------------------------------------------ */
/* Director KYC, per director                                          */
/* ------------------------------------------------------------------ */

const KYC_SOURCE = dueDates.find((d) => d.id === "dir-3-kyc")!;

function activeOn(director: Director, clientId: string, date: Date): boolean {
  return director.directorships.some((ds) => {
    if (ds.clientId !== clientId) return false;
    const from = parseIsoDate(ds.appointedOn);
    const to = ds.cessationOn ? parseIsoDate(ds.cessationOn) : null;
    return (!from || from.getTime() <= date.getTime()) && (!to || to.getTime() >= date.getTime());
  });
}

/**
 * DIR-3 KYC rows for one financial year: one per director of this company
 * whose own three-year cycle falls due on 30 June of that year.
 */
export function kycItemsFor(
  client: Client,
  directors: Director[],
  fyEndingYear: number,
  companyType: CompanyType,
): ResolvedDueDate[] {
  if (!KYC_SOURCE.appliesTo.includes(companyType)) return [];
  const linked = directors.filter((d) => d.directorships.some((ds) => ds.clientId === client.id));

  if (linked.length === 0) {
    return [
      {
        source: KYC_SOURCE,
        due: null,
        qualifier:
          "Add this company's directors (in its Company Master Data or the Director Master) to see each one's KYC date. It falls once every three financial years, counted from the year the DIN was allotted.",
        overrideReason: null,
        anchoredOnAssumedAgm: false,
        fyEndingYear,
      },
    ];
  }

  const due = makeDate(fyEndingYear, KYC_DUE_MONTH, KYC_DUE_DAY);
  const previousDue = makeDate(fyEndingYear - KYC_CYCLE_YEARS, KYC_DUE_MONTH, KYC_DUE_DAY);
  const items: ResolvedDueDate[] = [];

  for (const director of linked) {
    const allotted = parseIsoDate(director.dinAllottedOn);
    if (!allotted || !activeOn(director, client.id, due)) continue;
    const firstYear = firstKycDueDate(allotted).getFullYear();
    const yearsOn = fyEndingYear - firstYear;
    if (yearsOn < 0 || yearsOn % KYC_CYCLE_YEARS !== 0) continue;

    // A filing counts towards the first due date on or after it.
    const filed = director.lastKycFiledOn ? parseIsoDate(director.lastKycFiledOn) : null;
    const filedOn =
      filed && filed.getTime() <= due.getTime() && filed.getTime() > previousDue.getTime()
        ? filed
        : null;

    items.push({
      source: {
        ...KYC_SOURCE,
        id: `dir-3-kyc:${director.id}`,
        title: `Director KYC — ${director.name}`,
        note: `DIN ${dinAt(director, client.id)}. Due once every three financial years by 30 June, counted from the year the DIN was allotted (${formatDate(allotted)}). Missing it deactivates the DIN and costs ₹${KYC_LATE_FEE.toLocaleString("en-IN")} to restore.`,
      },
      due,
      qualifier: null,
      overrideReason: null,
      anchoredOnAssumedAgm: false,
      fyEndingYear,
      filedOn,
      srn: filedOn ? (director.lastKycSrn ?? null) : null,
    });
  }
  return items;
}

/* ------------------------------------------------------------------ */
/* DIR-12 when a director ceases                                       */
/* ------------------------------------------------------------------ */

/** Days after a cessation within which the company files DIR-12 (Rule 15 / Section 168). */
export const DIR12_DAYS = 30;

/**
 * A director who ceased at this company in this financial year: the company
 * files DIR-12 within 30 days of the cessation. Each cessation is its own
 * row (keyed by director), so it is marked filed with its SRN like any form.
 * An LLP reports a change of partners on Form 4 instead, so none is shown.
 */
export function dir12ItemsFor(
  client: Client,
  directors: Director[],
  fyEndingYear: number,
  companyType: CompanyType,
): ResolvedDueDate[] {
  if (companyType === "llp") return [];
  const items: ResolvedDueDate[] = [];
  for (const director of directors) {
    for (const ds of director.directorships) {
      if (ds.clientId !== client.id || !ds.cessationOn) continue;
      const ceased = parseIsoDate(ds.cessationOn);
      if (!ceased || financialYearEndYear(ceased) !== fyEndingYear) continue;
      const reason = CESSATION_REASONS.find((r) => r.value === ds.cessationReason);
      items.push({
        source: {
          id: `dir-12-cessation:${director.id}`,
          title: `Director cessation — ${director.name}`,
          formId: "dir-12",
          formCode: "DIR-12",
          section: reason && reason.section !== "—" ? reason.section : "Section 168",
          category: "One-time",
          appliesTo: ["private", "public", "opc", "section8"],
          rule: { kind: "from-incorporation", days: DIR12_DAYS },
          note: `${director.name} (DIN ${dinAt(director, client.id)}) ceased on ${formatDate(ceased)}${reason ? ` — ${reason.label.toLowerCase()}` : ""}. The company files DIR-12 within ${DIR12_DAYS} days of the cessation.`,
        },
        due: addDays(ceased, DIR12_DAYS),
        qualifier: null,
        overrideReason: null,
        anchoredOnAssumedAgm: false,
        fyEndingYear,
      });
    }
  }
  return items;
}

/* ------------------------------------------------------------------ */
/* One year, for one company                                           */
/* ------------------------------------------------------------------ */

export type ClientYearOptions = {
  /** What-if: view the company as a different entity type. */
  companyType?: CompanyType;
  /** What-if: a different AGM date for this one year. Undefined = the one on record. */
  agmDate?: Date | null;
  asOf?: Date;
};

export function resolveClientYear(
  client: Client,
  directors: Director[],
  fyEndingYear: number,
  opts: ClientYearOptions = {},
): ResolvedDueDate[] {
  const agms = agmDatesByFy(client);
  const companyType = opts.companyType ?? client.type;
  const resolved = resolveDueDates({
    companyType,
    fyEndingYear,
    agmDate: opts.agmDate !== undefined ? opts.agmDate : (agms.get(fyEndingYear) ?? null),
    previousAgmDate: agms.get(fyEndingYear - 1) ?? null,
    incorporatedOn: parseIsoDate(client.incorporatedOn),
    facts: factsFor(client),
    asOf: opts.asOf,
  });
  return sortByDue(
    applyDueOverrides(
      [
        ...applyFilings([...resolved, ...dir12ItemsFor(client, directors, fyEndingYear, companyType)], client),
        ...kycItemsFor(client, directors, fyEndingYear, companyType),
      ],
      client,
    ),
  );
}

/* ------------------------------------------------------------------ */
/* Rolling window across years                                         */
/* ------------------------------------------------------------------ */

export type RollingWindow = {
  /** How far back a passed deadline still shows (as overdue, unless filed). */
  lookbackDays: number;
  /** How far ahead to show. */
  horizonDays: number;
};

export const DEFAULT_WINDOW: RollingWindow = { lookbackDays: 90, horizonDays: 365 };

/**
 * Everything falling due around `asOf`, whichever financial year it belongs
 * to. In October the previous year's AOC-4 and MGT-7 are what matter, while
 * this year's half-yearly returns are also running, so one year's slice is
 * never the whole picture.
 *
 * `firstFy` keeps out years before the company existed.
 */
export function rollingDueDates(
  resolveYear: (fyEndingYear: number) => ResolvedDueDate[],
  asOf: Date = today(),
  window: RollingWindow = DEFAULT_WINDOW,
  firstFy: number | null = null,
): ResolvedDueDate[] {
  const now = midnight(asOf);
  const from = addDays(now, -window.lookbackDays).getTime();
  const to = addDays(now, window.horizonDays).getTime();
  const fyNow = financialYearEndYear(now);

  // Standing requirements (Board meeting rhythm) come from the running year,
  // or the first one where a company is incorporated in January to March.
  const cadenceFy = firstFy !== null && firstFy > fyNow ? firstFy : fyNow;

  const seen = new Set<string>();
  const dated: ResolvedDueDate[] = [];
  let undated: ResolvedDueDate[] = [];

  for (let fy = fyNow - 1; fy <= fyNow + 1; fy++) {
    if (firstFy !== null && fy < firstFy) continue;
    const year = resolveYear(fy);
    if (fy === cadenceFy) undated = year.filter((r) => r.due === null);
    for (const r of year) {
      if (!r.due) continue;
      const t = r.due.getTime();
      if (t < from || t > to) continue;
      // One-time duties counted from incorporation come out the same in every year.
      const key = `${r.source.id}@${t}`;
      if (seen.has(key)) continue;
      seen.add(key);
      dated.push(r);
    }
  }
  return [...sortByDue(dated), ...undated];
}

/** The rolling schedule for one company, from its own profile and directors. */
export function clientSchedule(
  client: Client,
  directors: Director[],
  asOf: Date = today(),
  window: RollingWindow = DEFAULT_WINDOW,
  opts: Omit<ClientYearOptions, "asOf" | "agmDate"> = {},
): ResolvedDueDate[] {
  return rollingDueDates(
    (fy) => resolveClientYear(client, directors, fy, { ...opts, asOf }),
    asOf,
    window,
    firstFyEndingYear(client),
  );
}

function sortByDue(items: ResolvedDueDate[]): ResolvedDueDate[] {
  return [...items].sort((a, b) => {
    if (a.due === null && b.due === null) return 0;
    if (a.due === null) return 1;
    if (b.due === null) return -1;
    return a.due.getTime() - b.due.getTime();
  });
}

/**
 * Financial years worth offering in a year picker for this company: from its
 * first year (or three back) to next year. Computed at render time, so the
 * list moves on by itself every April.
 */
export function selectableYears(client: Client | null, asOf: Date = today()): number[] {
  const fyNow = financialYearEndYear(midnight(asOf));
  const first = client ? firstFyEndingYear(client) : null;
  const start = Math.max(fyNow - 3, first ?? -Infinity);
  const end = Math.max(fyNow + 1, first ?? -Infinity);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}
