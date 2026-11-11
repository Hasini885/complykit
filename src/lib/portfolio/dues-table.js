import { daysBetween, financialYearLabel, formatDate, isoDate, midnight, today } from "@/lib/dates";
import { typeLabel } from "@/lib/portfolio/clients";
import { bucketFor, buildPortfolioReport } from "@/lib/portfolio/report";
import { financialYearEndYear } from "@/lib/portfolio/directors";
import {
  POST_INCORPORATION_FORMS,
  auditorAnchorFy,
  firstFyEndingYear,
  postIncorporationItems,
  resolveClientYear,
} from "@/lib/portfolio/schedule";
export const STATUS_LABEL = {
  overdue: "Overdue",
  "due-soon": "Due within 30 days",
  upcoming: "Upcoming",
  completed: "Filed",
};

export function buildDuesRows(clients, directors, asOf = today(), opts = {}) {
  const source = buildPortfolioReport(clients, directors, { asOf, fyEndingYear: opts.fyEndingYear }).sections.flatMap(
    (s) => s.items,
  );
  const seen = new Set();
  return (
    source
      .filter((r) => !opts.filingsOnly || r.item.source.formCode !== null)
      .map(toDuesRow)
      // Within one year a duty counted from incorporation can repeat; keep one.
      .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
      .sort(byDueThenCompany)
  );
}

export const DUES_SECTION_TITLE = {
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
export function buildAnnualDuesRows(clients, directors, asOf = today(), opts = {}) {
  const fy = opts.fyEndingYear ?? null;
  const on = midnight(asOf);
  const fyNow = financialYearEndYear(on);
  const rows = buildDuesRows(clients, directors, asOf, { filingsOnly: true, fyEndingYear: fy }).filter(
    (r) => !POST_INCORPORATION_FORMS.includes(r.sourceId),
  );
  const firstOf = new Map(clients.map((c) => [c.id, firstFyEndingYear(c)]));
  const isFirstAdt = (r) => r.sourceId === "adt-1" && r.item?.fyEndingYear === firstOf.get(r.clientId);
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
export function postIncorporationRows(clients, asOf = today()) {
  const on = midnight(asOf);
  return clients
    .flatMap((client) =>
      postIncorporationItems(client)
        .filter((item) => item.due !== null)
        .map((item) => toDuesRow({ client, item, bucket: bucketFor(item, on), days: daysBetween(on, item.due) })),
    )
    .sort(byDueThenCompany);
}

function toDuesRow(r) {
  return {
    id: `${r.client.id}|${r.item.source.id}|${r.item.fyEndingYear}|${r.item.qualifier ?? ""}|${isoDate(r.item.due)}`,
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
    due: r.item.due,
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

function byDueThenCompany(a, b) {
  return (
    a.due.getTime() - b.due.getTime() || a.company.localeCompare(b.company) || a.obligation.localeCompare(b.obligation)
  );
}

export const ALL_DUES = { status: "all", clientId: "all", query: "" };

export function filterDuesRows(rows, f) {
  const q = f.query.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (f.clientId === "all" || r.clientId === f.clientId) &&
      (f.status === "all" || (f.status === "open" ? r.status !== "completed" : r.status === f.status)) &&
      (q === "" ||
        [r.company, r.cin, r.obligation, r.form, r.section, r.srn, r.fy].some((v) => v.toLowerCase().includes(q))),
  );
}

/** "12d overdue", "Due today", "In 33d", or empty once filed. */
export function daysLabel(r) {
  if (r.status === "completed") return "";
  if (r.days < 0) return `${-r.days}d overdue`;
  if (r.days === 0) return "Due today";
  return `In ${r.days}d`;
}

/** Order matters: when and how urgent first, then who and what, then the detail. */
export const DUES_COLUMNS = [
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

export function duesFileName(asOf, ext) {
  return `cacompliancetool-all-dues-${isoDate(asOf)}.${ext}`;
}

/**
 * The same calendar date at UTC midnight. Excel stores dates without a time
 * zone and the writer converts with getTime(), so a local-midnight date in
 * India (UTC+5:30) would otherwise land on the previous day.
 */
export function asExcelDate(d) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}
