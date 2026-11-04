import { daysBetween, financialYearLabel, formatDate, isoDate, midnight, today } from "@/lib/dates";
import { typeLabel } from "@/lib/portfolio/clients";
import { bucketFor, buildPortfolioReport, type ReportBucket, type ReportItem } from "@/lib/portfolio/report";
import { financialYearEndYear } from "@/lib/portfolio/directors";
import {
  POST_INCORPORATION_FORMS,
  auditorAnchorFy,
  firstFyEndingYear,
  postIncorporationItems,
  resolveClientYear,
} from "@/lib/portfolio/schedule";
import type { ResolvedDueDate } from "@/lib/resolve-due-dates";
import type { Client, Director } from "@/lib/portfolio/types";

/**
 * Every due of every company as flat rows: the spreadsheet view on the
 * dashboard, and the same rows exported to Excel and PDF. One definition of
 * the rows and columns, so the screen and both files always agree.
 */

export type DuesRow = {
  /** Stable across renders and exports. */
  id: string;
  clientId: string;
  /** The obligation, without any per-director suffix (DIR-3 KYC rows share "dir-3-kyc"). */
  sourceId: string;
  fyEndingYear: number;
  company: string;
  cin: string;
  entity: string;
  obligation: string;
  form: string;
  section: string;
  fy: string;
  /** The half-year a half-yearly return covers, else empty. */
  period: string;
  due: Date;
  status: ReportBucket;
  /** Negative when overdue. */
  days: number;
  filedOn: Date | null;
  srn: string;
  /** "Assumed AGM" where no AGM is on record for that year, and any MCA fee relief. */
  basis: string;
  /** The resolved due behind the row, so the screen can mark it filed. Not exported. */
  item?: ResolvedDueDate;
};

export const STATUS_LABEL: Record<ReportBucket, string> = {
  overdue: "Overdue",
  "due-soon": "Due within 30 days",
  upcoming: "Upcoming",
  completed: "Filed",
};

export type DuesRowOptions = {
  /**
   * Only obligations with an e-form to file. Dates that are only to watch —
   * the first Board meeting — are left out, as in the
   * all-dues sheet and its downloads. The calendar and reminders keep them.
   */
  filingsOnly?: boolean;
  /**
   * One financial year (the calendar year its 31 March falls in) instead of
   * the rolling window: every dated due that belongs to that year, however
   * long ago or far ahead it falls. Null or absent keeps the rolling window.
   */
  fyEndingYear?: number | null;
};

export function buildDuesRows(
  clients: Client[],
  directors: Director[],
  asOf: Date = today(),
  opts: DuesRowOptions = {},
): DuesRow[] {
  const source = buildPortfolioReport(clients, directors, { asOf, fyEndingYear: opts.fyEndingYear })
    .sections.flatMap((s) => s.items);
  const seen = new Set<string>();
  return source
    .filter((r) => !opts.filingsOnly || r.item.source.formCode !== null)
    .map(toDuesRow)
    // Within one year a duty counted from incorporation can repeat; keep one.
    .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
    .sort(byDueThenCompany);
}

/** The two parts of the dashboard. */
export type DuesSection = "post-incorporation" | "annual";

export const DUES_SECTION_TITLE: Record<DuesSection, string> = {
  "post-incorporation": "Post incorporation compliance",
  annual: "Annual compliance",
};

/**
 * The annual part: everything except the post incorporation forms. The ADT-1
 * from the company's first AGM (the first subsequent auditor) is held in the
 * year after that AGM's financial year: the year it is actually filed in, as
 * the first year belongs to the first auditor. There it shows filed or due
 * for as long as that year is in view, never dropping back to NA.
 */
export function buildAnnualDuesRows(
  clients: Client[],
  directors: Director[],
  asOf: Date = today(),
  opts: { fyEndingYear?: number | null } = {},
): DuesRow[] {
  const fy = opts.fyEndingYear ?? null;
  const on = midnight(asOf);
  const fyNow = financialYearEndYear(on);
  const rows = buildDuesRows(clients, directors, asOf, { filingsOnly: true, fyEndingYear: fy }).filter(
    (r) => !POST_INCORPORATION_FORMS.includes(r.sourceId),
  );
  const firstOf = new Map(clients.map((c) => [c.id, firstFyEndingYear(c)]));
  const isFirstAdt = (r: DuesRow) => r.sourceId === "adt-1" && r.item?.fyEndingYear === firstOf.get(r.clientId);
  const held = clients.flatMap((client) => {
    const first = firstOf.get(client.id) ?? null;
    if (first === null || auditorAnchorFy(client) !== first) return [];
    const shown = first + 1;
    const inView =
      fy !== null
        ? fy === shown
        : (shown >= fyNow - 1 && shown <= fyNow) || rows.some((r) => r.clientId === client.id && isFirstAdt(r));
    if (!inView) return [];
    const item = resolveClientYear(client, [], first, { asOf: on }).find((i) => i.source.id === "adt-1");
    if (!item?.due) return [];
    const row = toDuesRow({ client, item, bucket: bucketFor(item, on), days: daysBetween(on, item.due) });
    return [{ ...row, fyEndingYear: shown, fy: financialYearLabel(shown) }];
  });
  return [...rows.filter((r) => !isFirstAdt(r)), ...held].sort(byDueThenCompany);
}

/**
 * The post incorporation part: each company's first auditor ADT-1 and INC-20A,
 * for any year and however old, so one that was never filed stays in view.
 */
export function postIncorporationRows(clients: Client[], asOf: Date = today()): DuesRow[] {
  const on = midnight(asOf);
  return clients
    .flatMap((client) =>
      postIncorporationItems(client)
        .filter((item) => item.due !== null)
        .map((item) =>
          toDuesRow({ client, item, bucket: bucketFor(item, on), days: daysBetween(on, item.due!) }),
        ),
    )
    .sort(byDueThenCompany);
}

function toDuesRow(r: ReportItem): DuesRow {
  return {
    id: `${r.client.id}|${r.item.source.id}|${r.item.fyEndingYear}|${r.item.qualifier ?? ""}|${isoDate(r.item.due!)}`,
    clientId: r.client.id,
    sourceId: r.item.source.id.split(":")[0],
    fyEndingYear: r.item.fyEndingYear,
    company: r.client.name,
    cin: r.client.cin,
    entity: typeLabel(r.client.type),
    obligation: r.item.source.title,
    form: r.item.source.formCode ?? "",
    section: r.item.source.section,
    fy: financialYearLabel(r.item.fyEndingYear),
    period: r.item.qualifier ?? "",
    due: r.item.due!,
    status: r.bucket,
    days: r.days,
    filedOn: r.item.filedOn ?? null,
    srn: r.item.srn ?? "",
    basis: [
      r.item.originalDue ? `Own date (usual ${formatDate(r.item.originalDue)})` : "",
      r.item.anchoredOnAssumedAgm ? "Assumed AGM" : "",
      r.item.relief && r.bucket !== "completed" ? r.item.relief : "",
    ]
      .filter(Boolean)
      .join(" · "),
    item: r.item,
  };
}

function byDueThenCompany(a: DuesRow, b: DuesRow): number {
  return (
    a.due.getTime() - b.due.getTime() ||
    a.company.localeCompare(b.company) ||
    a.obligation.localeCompare(b.obligation)
  );
}

export type DuesFilter = {
  status: "all" | "open" | ReportBucket;
  clientId: "all" | string;
  query: string;
};

export const ALL_DUES: DuesFilter = { status: "all", clientId: "all", query: "" };

export function filterDuesRows(rows: DuesRow[], f: DuesFilter): DuesRow[] {
  const q = f.query.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (f.clientId === "all" || r.clientId === f.clientId) &&
      (f.status === "all" || (f.status === "open" ? r.status !== "completed" : r.status === f.status)) &&
      (q === "" ||
        [r.company, r.cin, r.obligation, r.form, r.section, r.srn, r.fy].some((v) =>
          v.toLowerCase().includes(q),
        )),
  );
}

/** "12d overdue", "Due today", "In 33d", or empty once filed. */
export function daysLabel(r: DuesRow): string {
  if (r.status === "completed") return "";
  if (r.days < 0) return `${-r.days}d overdue`;
  if (r.days === 0) return "Due today";
  return `In ${r.days}d`;
}

/** Column definitions shared by the grid and both exports. */
export type DuesColumn = {
  key: string;
  header: string;
  /** Approximate width in characters (Excel) — the PDF scales from it. */
  width: number;
  /** Plain text, for the grid's tooltip, the PDF and searching. */
  text: (r: DuesRow) => string;
};

/** Order matters: when and how urgent first, then who and what, then the detail. */
export const DUES_COLUMNS: DuesColumn[] = [
  { key: "due", header: "Due date", width: 13, text: (r) => formatDate(r.due) },
  { key: "status", header: "Status", width: 18, text: (r) => STATUS_LABEL[r.status] },
  { key: "days", header: "Days", width: 13, text: daysLabel },
  { key: "company", header: "Company", width: 34, text: (r) => r.company },
  { key: "obligation", header: "Obligation", width: 38, text: (r) => r.obligation },
  { key: "form", header: "Form", width: 14, text: (r) => r.form },
  { key: "fy", header: "FY", width: 12, text: (r) => r.fy },
  { key: "period", header: "Period", width: 18, text: (r) => r.period },
  { key: "filedOn", header: "Filed on", width: 13, text: (r) => (r.filedOn ? formatDate(r.filedOn) : "") },
  { key: "srn", header: "SRN / Ack. no.", width: 17, text: (r) => r.srn },
  { key: "cin", header: "CIN / LLPIN", width: 24, text: (r) => r.cin },
  { key: "entity", header: "Type", width: 12, text: (r) => r.entity },
  { key: "section", header: "Provision", width: 22, text: (r) => r.section },
  { key: "basis", header: "Note", width: 40, text: (r) => r.basis },
];

export function duesFileName(asOf: Date, ext: "xlsx" | "pdf"): string {
  return `complykit-all-dues-${isoDate(asOf)}.${ext}`;
}

/**
 * The same calendar date at UTC midnight. Excel stores dates without a time
 * zone and the writer converts with getTime(), so a local-midnight date in
 * India (UTC+5:30) would otherwise land on the previous day.
 */
export function asExcelDate(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}
