import { addDays } from "@/lib/dates";
import { sortClients } from "@/lib/portfolio/clients";
import { adtNaReason } from "@/lib/portfolio/auditor";
import type { DuesRow } from "@/lib/portfolio/dues-table";
import { referenceKind } from "@/lib/portfolio/filings";
import type { ReportBucket } from "@/lib/portfolio/report";
import type { Client } from "@/lib/portfolio/types";

/**
 * The filing-status matrix: one row per company, one column per due to file
 * (a form for a financial year, and for half-yearly returns a half), and in
 * each cell whether that company has filed it.
 *
 * Built from the same dues rows as the list view and the downloads, so every
 * view agrees. A company the due does not apply to gets no cell (shown as
 * "—"). DIR-3 KYC, which is per director, folds into one cell per company.
 *
 * ADT-1 always has a column next to each year's AOC-4: in a year whose AGM
 * appoints the auditor it is a due like any other; in the years of a running
 * term the cell says it is not required and names the year it next falls due.
 */

export type MatrixColumn = {
  key: string;
  /** Form code(s) as filed, e.g. "AOC-4" or "MGT-7 / MGT-7A" when companies differ. */
  form: string;
  obligation: string;
  fy: string;
  /**
   * Whether the header needs the year: only when the same form appears for
   * more than one financial year in the sheet. With one year on screen (a
   * year picked, or the report's scope line naming it) it would only repeat.
   */
  showFy: boolean;
  period: string;
  /** Earliest due date in this column, for ordering. */
  firstDue: Date;
};

export type MatrixCell = {
  /** Worst open status, or "completed" once every part is filed. */
  status: ReportBucket;
  /** Earliest open due date (or the due date, once filed). */
  due: Date;
  /** The form this company files for the column (MGT-7 vs MGT-7A, ITR-5 vs ITR-6). */
  form: string;
  /** Parts in the cell: directors, for DIR-3 KYC; else 1. */
  parts: number;
  filedParts: number;
  /** Set when the whole cell is filed by a single filing. */
  filedOn: Date | null;
  srn: string;
  /** Days to the earliest open due (negative when overdue). */
  days: number;
  /**
   * Set when nothing is due this year although the form applies to the
   * company, e.g. ADT-1 while the auditor's term runs: says why.
   */
  notRequired?: string;
  /** The dues in the cell (one, or one per director for DIR-3 KYC), to mark filed. */
  rows: DuesRow[];
  /**
   * The date the due originally fell on, where it has since moved — by an
   * MCA or CBDT extension, or by a date the user set. `due` is then the
   * extended date. Null when the due is on its original date.
   */
  originalDue: Date | null;
  /** True when the user set the extended date themselves. */
  manualDue: boolean;
};

export type MatrixRow = {
  clientId: string;
  company: string;
  cin: string;
  cells: Record<string, MatrixCell>;
};

export type FilingMatrix = { columns: MatrixColumn[]; rows: MatrixRow[] };

const STATUS_RANK: Record<ReportBucket, number> = { overdue: 0, "due-soon": 1, upcoming: 2, completed: 3 };

export function columnKey(r: DuesRow): string {
  // MGT-7 and MGT-7A are separate forms with separate columns.
  const id = r.sourceId === "mgt-7" && r.form === "MGT-7A" ? "mgt-7a" : r.sourceId;
  return `${id}|${r.fyEndingYear}|${r.period}`;
}

export function buildFilingMatrix(rows: DuesRow[], clients: Client[]): FilingMatrix {
  const columns = new Map<string, Omit<MatrixColumn, "showFy"> & { forms: Set<string> }>();
  const cells = new Map<string, Map<string, DuesRow[]>>();

  for (const r of rows) {
    const key = columnKey(r);
    const col = columns.get(key);
    // "ITR-7 / ITR-6" counts as two forms, so the header lists each once.
    const forms = r.form.split(" / ");
    if (col) {
      forms.forEach((f) => col.forms.add(f));
      if (r.due.getTime() < col.firstDue.getTime()) col.firstDue = r.due;
    } else {
      columns.set(key, {
        key,
        form: r.form,
        forms: new Set(forms),
        obligation:
          r.sourceId === "dir-3-kyc"
            ? "Director KYC"
            : r.sourceId === "dir-12-cessation"
              ? "Director cessation"
            : r.form === "MGT-7A"
              ? "Annual return (small company / OPC)"
              : r.obligation,
        fy: r.fy,
        period: r.period,
        firstDue: r.due,
      });
    }
    const byClient = cells.get(r.clientId) ?? new Map<string, DuesRow[]>();
    byClient.set(key, [...(byClient.get(key) ?? []), r]);
    cells.set(r.clientId, byClient);
  }

  addAdtStatus(rows, clients, columns, cells);
  addAnnualReturnStatus(rows, columns, cells);

  const named = [...columns.values()].map(({ forms, ...c }) => ({ ...c, form: [...forms].sort().join(" / ") }));
  const yearsPerForm = new Map<string, Set<string>>();
  for (const c of named) {
    const id = `${c.form}|${c.period}`;
    yearsPerForm.set(id, (yearsPerForm.get(id) ?? new Set()).add(c.fy));
  }
  // ADT-1 is neither yearly nor one-time, so it has its own place: after every
  // other form (by date among themselves), no more prominent than the rest.
  const isAdt = (c: { key: string }) => c.key.startsWith(`${ADT_ID}|`);
  const orderedColumns = named
    .map((c) => ({ ...c, showFy: yearsPerForm.get(`${c.form}|${c.period}`)!.size > 1 }))
    .sort(
      (a, b) =>
        Number(isAdt(a)) - Number(isAdt(b)) ||
        a.firstDue.getTime() - b.firstDue.getTime() ||
        a.form.localeCompare(b.form),
    );

  const matrixRows = sortClients(clients).map<MatrixRow>((client) => {
    const mine = cells.get(client.id) ?? new Map<string, DuesRow[]>();
    const out: Record<string, MatrixCell> = {};
    for (const [key, parts] of mine) out[key] = cellFor(parts);
    return { clientId: client.id, company: client.name, cin: client.cin, cells: out };
  });

  return { columns: orderedColumns, rows: matrixRows };
}

const ADT_ID = "adt-1";
const NOT_REQUIRED = "|not-required";

type ColumnMap = Map<string, Omit<MatrixColumn, "showFy"> & { forms: Set<string> }>;
type CellMap = Map<string, Map<string, DuesRow[]>>;

/** Adds a column (if missing) next to `beside`, due `shiftDays` from it. */
function ensureColumn(
  columns: ColumnMap,
  key: string,
  beside: DuesRow,
  form: string,
  obligation: string,
  shiftDays: number,
) {
  if (columns.has(key)) return;
  const near = columns.get(columnKey(beside))!;
  columns.set(key, {
    key,
    form,
    forms: new Set([form]),
    obligation,
    fy: beside.fy,
    period: "",
    firstDue: addDays(near.firstDue, shiftDays),
  });
}

/** A grey "not required" cell for a company, saying why. */
function notRequiredCell(cells: CellMap, key: string, from: DuesRow, form: string, sourceId: string, why: string) {
  const mine = cells.get(from.clientId);
  if (!mine || mine.has(key)) return;
  mine.set(key, [
    {
      ...from,
      id: `${from.clientId}|${key}${NOT_REQUIRED}`,
      sourceId,
      form,
      filedOn: null,
      srn: "",
      basis: why,
      item: undefined,
    },
  ]);
}

/**
 * For every year with an AOC-4 column, makes sure ADT-1 has one too, and
 * gives each company that files AOC-4 but has no ADT-1 due that year a
 * "not required" cell naming the year its next ADT-1 falls due.
 */
function addAdtStatus(rows: DuesRow[], clients: Client[], columns: ColumnMap, cells: CellMap) {
  const byId = new Map(clients.map((c) => [c.id, c]));
  for (const aoc of rows.filter((r) => r.sourceId === "aoc-4" && r.period === "")) {
    const key = `${ADT_ID}|${aoc.fyEndingYear}|`;
    // Due 15 days after the AGM, ahead of AOC-4's 30: sort it just before.
    ensureColumn(columns, key, aoc, "ADT-1", "Notice of auditor appointment", -15);
    const client = byId.get(aoc.clientId);
    if (!client) continue;
    notRequiredCell(
      cells,
      key,
      { ...aoc, obligation: "Notice of auditor appointment", section: "Section 139(1)" },
      "ADT-1",
      ADT_ID,
      // Inside the auditor's term: covered by the ADT-1 already filed.
      client.filesAdt1 === false ? "not applicable (company master)" : adtNaReason(client),
    );
  }
}

/**
 * MGT-7 and MGT-7A get a column each. MGT-7A's is always shown beside the
 * year's annual return; a company filing the other form gets a "not
 * required" cell there saying which one it files and why.
 */
function addAnnualReturnStatus(rows: DuesRow[], columns: ColumnMap, cells: CellMap) {
  for (const r of rows.filter((x) => x.sourceId === "mgt-7")) {
    const small = r.form === "MGT-7A";
    const keyA = `mgt-7a|${r.fyEndingYear}|${r.period}`;
    const keyFull = `mgt-7|${r.fyEndingYear}|${r.period}`;
    ensureColumn(columns, keyA, r, "MGT-7A", "Annual return (small company / OPC)", 0);
    const other = small ? keyFull : keyA;
    if (!columns.has(other)) continue;
    notRequiredCell(
      cells,
      other,
      { ...r, obligation: small ? "Annual return" : "Annual return (small company / OPC)" },
      small ? "MGT-7" : "MGT-7A",
      small ? "mgt-7" : "mgt-7a",
      small ? "files MGT-7A (small company / OPC)" : "files MGT-7 (not a small company or OPC)",
    );
  }
}

function cellFor(parts: DuesRow[]): MatrixCell {
  if (parts.length === 1 && parts[0].id.endsWith(NOT_REQUIRED)) {
    const p = parts[0];
    return {
      status: "upcoming",
      due: p.due,
      form: p.form,
      parts: 1,
      filedParts: 0,
      filedOn: null,
      srn: "",
      days: 0,
      notRequired: p.basis,
      rows: [],
      originalDue: null,
      manualDue: false,
    };
  }
  const open = parts.filter((p) => p.status !== "completed");
  const filed = parts.filter((p) => p.status === "completed");
  const worst = [...parts].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])[0];
  const lead = open.length > 0 ? [...open].sort((a, b) => a.due.getTime() - b.due.getTime())[0] : parts[0];
  const single = parts.length === 1 ? parts[0] : null;
  return {
    status: open.length === 0 ? "completed" : worst.status,
    due: lead.due,
    form: parts[0].form,
    parts: parts.length,
    filedParts: filed.length,
    filedOn: single?.filedOn ?? null,
    srn: single?.srn ?? "",
    days: lead.days,
    rows: parts,
    ...movedDue(lead),
  };
}

/** Where a due has moved from its original date, and whether the user moved it. */
function movedDue(r: DuesRow): { originalDue: Date | null; manualDue: boolean } {
  const it = r.item;
  const original = it ? (it.statutoryDue ?? it.originalDue ?? null) : null;
  if (!original || original.getTime() === r.due.getTime()) return { originalDue: null, manualDue: false };
  return { originalDue: original, manualDue: !!it?.originalDue };
}

/**
 * The lines under a filed cell: when it was filed, then its SRN (or, for an
 * ITR, its acknowledgement number). A cell covering several directors gives
 * the latest filing date. The screen, the PDF and Excel all use these.
 */
export function filedLines(c: MatrixCell, formatDate: (d: Date) => string): string[] {
  const dates = c.rows.map((r) => r.filedOn).filter((d): d is Date => d !== null);
  const filedOn = c.filedOn ?? (dates.length ? dates.reduce((a, b) => (a.getTime() > b.getTime() ? a : b)) : null);
  const lines: string[] = [];
  if (filedOn) lines.push(`${c.parts > 1 ? "Last filed on" : "Filed on"} ${formatDate(filedOn)}`);
  if (c.srn) lines.push(`${referenceKind(c.rows[0]?.sourceId ?? "") === "ack" ? "Ack." : "SRN"} ${c.srn}`);
  return lines;
}

/**
 * The date lines under a cell's status: "Original … / Extended …" where the
 * due has moved, else "Due …". The screen and the PDF both use these.
 */
export function dueLines(c: MatrixCell, formatDate: (d: Date) => string): string[] {
  if (!c.originalDue) return [`Due date ${formatDate(c.due)}`];
  return [`Original due date ${formatDate(c.originalDue)}`, `Extended due date ${formatDate(c.due)}`];
}

/** Short text for a cell, for the screen and both downloads. */
export function cellText(c: MatrixCell | undefined, formatDate: (d: Date) => string): string {
  if (!c) return "—";
  if (c.notRequired) return `NA — ${c.notRequired}`;
  const of = c.parts > 1 ? ` (${c.filedParts}/${c.parts})` : "";
  switch (c.status) {
    case "completed":
      return ["Filed" + of, ...dueLines(c, formatDate), ...filedLines(c, formatDate)].join(" · ");
    case "overdue":
      return `Not filed — overdue${of} · due ${formatDate(c.due)}${movedNote(c, formatDate)}`;
    case "due-soon":
      return `Not filed — due ${formatDate(c.due)}${of}${movedNote(c, formatDate)}`;
    case "upcoming":
      return `Not yet due · ${formatDate(c.due)}${of}${movedNote(c, formatDate)}`;
  }
}

function movedNote(c: MatrixCell, formatDate: (d: Date) => string): string {
  if (!c.originalDue) return "";
  return ` (original due date ${formatDate(c.originalDue)}, extended due date ${formatDate(c.due)}${c.manualDue ? " — set manually" : ""})`;
}

/** "AOC-4", "MSME-1 · Apr–Sep", or "AOC-4 · FY 2025–26" where two years of it are shown. */
export function columnTitle(c: MatrixColumn): string {
  const period = c.period ? ` · ${c.period.replace("April to September", "Apr–Sep").replace("October to March", "Oct–Mar")}` : "";
  return `${c.form}${c.showFy ? ` · ${c.fy}` : ""}${period}`;
}
