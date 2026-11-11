"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  CheckCircle2,
  Download,
  LayoutGrid,
  List,
  Loader2,
  Pencil,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tip } from "@/components/shared/tip";
import { ExcelIcon, PdfIcon } from "@/components/shared/file-type-icon";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SrnChip } from "@/components/shared/srn-chip";
import { MarkFiledDialog } from "@/components/due-dates/mark-filed-dialog";
import { SetDueDatesDialog } from "@/components/dashboard/set-due-dates-dialog";
import { AuditorTermDialog } from "@/components/dashboard/auditor-term-dialog";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { referenceKind } from "@/lib/portfolio/filings";
import { FilingMatrixTable } from "@/components/dashboard/filing-matrix-table";
import { buildFilingMatrix } from "@/lib/portfolio/filing-matrix";
import {
  ALL_DUES,
  DUES_COLUMNS,
  DUES_SECTION_TITLE,
  STATUS_LABEL,
  buildAnnualDuesRows,
  filterDuesRows,
  postIncorporationRows,
  type DuesColumn,
  type DuesFilter,
  type DuesRow,
  type DuesSection,
} from "@/lib/portfolio/dues-table";
import type { ReportBucket } from "@/lib/portfolio/report";
import { financialYearEndYear } from "@/lib/portfolio/directors";
import { financialYearLabel, formatDate } from "@/lib/dates";
import type { Client, Director } from "@/lib/portfolio/types";
import { cn } from "@/lib/utils";

const STATUS_CELL: Record<ReportBucket, string> = {
  overdue: "bg-destructive/10 font-semibold text-destructive",
  "due-soon": "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  upcoming: "text-muted-foreground",
  completed: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
};

const STATUS_TABS: { value: DuesFilter["status"]; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Not filed" },
  { value: "overdue", label: "Overdue" },
  { value: "due-soon", label: "Due ≤ 30 days" },
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Filed" },
];

/** Columns whose natural order is not their text. */
const SORT_VALUE: Partial<Record<string, (r: DuesRow) => number>> = {
  due: (r) => r.due.getTime(),
  days: (r) => r.days,
  filedOn: (r) => r.filedOn?.getTime() ?? Number.POSITIVE_INFINITY,
  status: (r) => ["overdue", "due-soon", "upcoming", "completed"].indexOf(r.status),
};

type Sort = { key: string; dir: 1 | -1 };

/**
 * Spreadsheet view of one part of the dashboard (post incorporation or annual
 * compliance) for every company, filterable and sortable, downloadable as
 * Excel or PDF exactly as filtered.
 */
export function AllDuesGrid({
  section,
  clients,
  directors,
  reference,
  onOpenClient,
  singleCompany = false,
  fy: controlledFy,
  yearControl,
  aside,
}: {
  section: DuesSection;
  clients: Client[];
  directors: Director[];
  reference: Date;
  /** Makes company names clickable (the admin view). */
  onOpenClient?: (clientId: string) => void;
  /** One company's dashboard: no company picker, and the title names it. */
  singleCompany?: boolean;
  /**
   * Set by a page that picks the financial year for everything on it (the
   * admin dashboard): the grid follows it and hides its own year picker.
   */
  fy?: number | null;
  /** The page's own year picker, shown in the toolbar beside the view switch. */
  yearControl?: React.ReactNode;
  /** Shown beside the table on wide screens, its top level with the table's (e.g. the calendar). */
  aside?: React.ReactNode;
}) {
  // Null is the rolling window (90 days back to 12 months ahead); a number is
  // one financial year, by the calendar year its 31 March falls in.
  const [ownFy, setFy] = React.useState<number | null>(null);
  const yearControlled = controlledFy !== undefined;
  const fy = yearControlled ? controlledFy : ownFy;
  const fyOptions = React.useMemo(() => {
    const now = financialYearEndYear(reference);
    return Array.from({ length: 5 }, (_, i) => now + 1 - i);
  }, [reference]);
  const oneTime = section === "post-incorporation";
  const title = DUES_SECTION_TITLE[section];
  const rows = React.useMemo(
    () =>
      oneTime
        ? postIncorporationRows(clients, reference)
        : buildAnnualDuesRows(clients, directors, reference, { fyEndingYear: fy }),
    [oneTime, clients, directors, reference, fy],
  );
  const [filter, setFilter] = React.useState<DuesFilter>(ALL_DUES);
  const [sort, setSort] = React.useState<Sort>({ key: "due", dir: 1 });
  const [busy, setBusy] = React.useState<"xlsx" | "pdf" | null>(null);
  // Recording a filing from the sheet: the row being marked, or (for a cell
  // holding several, e.g. DIR-3 KYC per director) the rows to choose from.
  const [marking, setMarking] = React.useState<DuesRow | null>(null);
  const [choosing, setChoosing] = React.useState<DuesRow[] | null>(null);
  // The bulk due-date dialog: open on a column ("" = let the user pick one).
  const [settingDue, setSettingDue] = React.useState<string | null>(null);
  // An ADT-1 "NA" cell being opened to record the ADT-1: SRN, date of filing, years appointed.
  const [termCell, setTermCell] = React.useState<{ clientId: string; fy: number } | null>(null);

  function openRows(cellRows: DuesRow[]) {
    const markable = cellRows.filter((r) => r.item);
    if (markable.length === 1) setMarking(markable[0]);
    else if (markable.length > 1) setChoosing(markable);
  }
  // "matrix": companies x dues, each cell filed or not. "list": one row per due.
  const [view, setView] = React.useState<"matrix" | "list">("matrix");
  const columns = singleCompany ? DUES_COLUMNS.filter((c) => c.key !== "company") : DUES_COLUMNS;

  const visible = React.useMemo(() => {
    const filtered = filterDuesRows(rows, filter);
    const col = DUES_COLUMNS.find((c) => c.key === sort.key)!;
    const numeric = SORT_VALUE[sort.key];
    return [...filtered].sort((a, b) => {
      const primary = numeric
        ? numeric(a) - numeric(b)
        : col.text(a).localeCompare(col.text(b), undefined, { numeric: true });
      return primary * sort.dir || a.due.getTime() - b.due.getTime();
    });
  }, [rows, filter, sort]);

  // The matrix follows the company filter only; status and search belong to the list.
  const matrix = React.useMemo(() => {
    const scopedClients = filter.clientId === "all" ? clients : clients.filter((c) => c.id === filter.clientId);
    const scopedRows = filterDuesRows(rows, { ...ALL_DUES, clientId: filter.clientId });
    // The running window also shows the years ahead that a filed ADT-1 covers, as NA.
    const adtTermFromFy = !oneTime && fy === null ? financialYearEndYear(reference) : undefined;
    return buildFilingMatrix(scopedRows, scopedClients, { adtTermFromFy });
  }, [rows, clients, filter.clientId, oneTime, fy, reference]);

  const counts = React.useMemo(() => {
    const scoped = filterDuesRows(rows, { ...filter, status: "all" });
    const by = (s: DuesFilter["status"]) => filterDuesRows(scoped, { ...ALL_DUES, status: s }).length;
    return Object.fromEntries(STATUS_TABS.map((t) => [t.value, by(t.value)])) as Record<string, number>;
  }, [rows, filter]);

  function scopeText(): string {
    const company =
      filter.clientId === "all"
        ? "All companies"
        : (clients.find((c) => c.id === filter.clientId)?.name ?? "One company");
    const status = STATUS_TABS.find((t) => t.value === filter.status)!.label;
    return [
      title,
      company,
      oneTime ? "" : fy === null ? "Current window" : financialYearLabel(fy),
      status === "All" ? "All statuses" : status,
      filter.query ? `Search "${filter.query}"` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }

  async function download(kind: "xlsx" | "pdf") {
    if (view === "list" ? visible.length === 0 : matrix.columns.length === 0) return;
    setBusy(kind);
    try {
      const { downloadDuesPdf, downloadDuesXlsx, downloadMatrixPdf } = await import("@/lib/portfolio/dues-export");
      const meta = { asOf: reference, scope: scopeText() };
      // Excel always carries both: the filing-status sheet first, then the list.
      const listRows = view === "list" ? visible : filterDuesRows(rows, { ...ALL_DUES, clientId: filter.clientId });
      if (kind === "xlsx") await downloadDuesXlsx(listRows, meta, matrix);
      else if (view === "matrix") await downloadMatrixPdf(matrix, meta);
      else await downloadDuesPdf(visible, meta);
      toast.success(
        view === "matrix" && kind === "pdf"
          ? `Downloaded filing status for ${matrix.rows.length} compan${matrix.rows.length === 1 ? "y" : "ies"} as PDF`
          : `Downloaded ${listRows.length} dues as ${kind === "xlsx" ? "Excel (filing status + list)" : "PDF"}`,
      );
    } catch (error) {
      console.error("All-dues export failed", error);
      toast.error("The download could not be created. Try again.");
    } finally {
      setBusy(null);
    }
  }

  const nothingToDownload = view === "list" ? visible.length === 0 : matrix.columns.length === 0;

  function toggleSort(key: string) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  }

  return (
    <section id={section} className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold">
            {title} — {singleCompany ? (clients[0]?.name ?? "") : "every company"}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {yearControl}
          <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="View">
            {(["matrix", "list"] as const).map((v) => (
              <Tip key={v} label={v === "matrix" ? "By company" : "List"}>
                <Button
                  size="icon-sm"
                  variant={view === v ? "secondary" : "ghost"}
                  className="h-7 w-8"
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  aria-label={v === "matrix" ? "By company" : "List"}
                >
                  {v === "matrix" ? <LayoutGrid className="size-3.5" aria-hidden /> : <List className="size-3.5" aria-hidden />}
                </Button>
              </Tip>
            ))}
          </div>
          {view === "matrix" ? (
            <Tip label="Set due dates">
              <Button
                size="icon-sm"
                variant="outline"
                className="size-8"
                onClick={() => setSettingDue("")}
                disabled={matrix.columns.length === 0}
                aria-label="Set due dates"
              >
                <CalendarClock className="size-4" aria-hidden />
              </Button>
            </Tip>
          ) : null}
          <DropdownMenu>
            <Tip label="Download">
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="outline"
                  className="size-8"
                  disabled={busy !== null || nothingToDownload}
                  aria-label="Download"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
                </Button>
              </DropdownMenuTrigger>
            </Tip>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => download("xlsx")}>
                <ExcelIcon className="size-4" /> Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => download("pdf")}>
                <PdfIcon className="size-4" /> PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {yearControlled || oneTime ? null : (
        <select
          value={fy ?? "current"}
          onChange={(e) => setFy(e.target.value === "current" ? null : Number(e.target.value))}
          className="h-8 rounded-md border bg-background px-2 text-sm"
          aria-label="Financial year"
        >
          <option value="current">Current window</option>
          {fyOptions.map((y) => (
            <option key={y} value={y}>
              {financialYearLabel(y)}
            </option>
          ))}
        </select>
        )}
        {singleCompany ? null : (
        <select
          value={filter.clientId}
          onChange={(e) => setFilter((f) => ({ ...f, clientId: e.target.value }))}
          className="h-8 max-w-[16rem] rounded-md border bg-background px-2 text-sm"
          aria-label="Company"
        >
          <option value="all">All companies ({clients.length})</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        )}
        {view === "list" ? (
        <>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={filter.query}
            onChange={(e) => setFilter((f) => ({ ...f, query: e.target.value }))}
            placeholder="Search form, CIN, SRN…"
            className="h-8 w-56 pl-7 text-sm"
            aria-label="Search dues"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {STATUS_TABS.map((t) => (
            <Button
              key={t.value}
              size="sm"
              variant={filter.status === t.value ? "secondary" : "ghost"}
              className="h-8 px-2.5 text-xs"
              onClick={() => setFilter((f) => ({ ...f, status: t.value }))}
            >
              {t.label} <span className="tabular text-muted-foreground">{counts[t.value]}</span>
            </Button>
          ))}
        </div>
        </>
        ) : (
          <MatrixKey />
        )}
      </div>

      {/* The table, with the aside (if any) beside it from xl, tops level. */}
      <div className={aside ? "grid gap-4 xl:grid-cols-[minmax(0,1fr)_13.5rem] xl:items-start" : "contents"}>
      <div className="min-w-0 space-y-3">
      {view === "matrix" ? (
        <>
          <FilingMatrixTable
            matrix={matrix}
            onOpenClient={onOpenClient}
            onOpenCell={openRows}
            onOpenColumn={(key) => setSettingDue(key)}
            onOpenAuditorTerm={(clientId, year) => setTermCell({ clientId, fy: year })}
          />
          <p className="text-xs text-muted-foreground">
            {matrix.rows.length} compan{matrix.rows.length === 1 ? "y" : "ies"} × {matrix.columns.length} dues
          </p>
        </>
      ) : (
      <>
      {/* The sheet */}
      {/* `relative` makes this the containing block for absolutely positioned
          descendants (screen-reader labels), which would otherwise escape the
          scroll box and widen the whole page. */}
      <div className="relative max-h-[560px] overflow-auto rounded-lg border bg-card">
        <table className="w-max min-w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr>
              <th className="w-10 border-r border-b px-2 py-2 text-center font-semibold text-muted-foreground">#</th>
              <th className="border-r border-b px-2 py-2 font-medium whitespace-nowrap">Filing</th>
              {columns.map((c) => (
                <HeaderCell key={c.key} column={c} sort={sort} onSort={toggleSort} />
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 2} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  {rows.length === 0 ? "No dues in this period." : "No rows match these filters."}
                </td>
              </tr>
            ) : (
              visible.map((r, i) => (
                <tr key={r.id} className="even:bg-muted/30 hover:bg-primary/5">
                  <td className="border-r border-b px-2 py-1.5 text-center tabular text-muted-foreground">{i + 1}</td>
                  <td className="border-r border-b px-1.5 py-1 whitespace-nowrap">
                    {r.item ? (
                      <Button
                        size="xs"
                        variant={r.status === "completed" ? "ghost" : "outline"}
                        onClick={() => setMarking(r)}
                        aria-label={`${r.status === "completed" ? "Edit filing of" : "Mark filed:"} ${r.form} ${r.fy} for ${r.company}`}
                      >
                        {r.status === "completed" ? (
                          <>
                            <Pencil aria-hidden /> Edit
                          </>
                        ) : (
                          <>
                            <CheckCircle2 aria-hidden /> Mark filed
                          </>
                        )}
                      </Button>
                    ) : null}
                  </td>
                  {columns.map((c) => (
                    <BodyCell key={c.key} column={c} row={r} onOpenClient={onOpenClient} />
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        {visible.length} of {rows.length} rows
      </p>
      </>
      )}
      </div>
      {aside ? <div className="min-w-0 max-w-[13.5rem] xl:sticky xl:top-24">{aside}</div> : null}
      </div>

      <MarkFiledDialog
        clientId={marking?.clientId ?? ""}
        item={marking?.item ?? null}
        onOpenChange={(open) => {
          if (!open) setMarking(null);
        }}
      />
      <SetDueDatesDialog
        matrix={matrix}
        columnKey={settingDue}
        onClose={() => setSettingDue(null)}
      />
      <AuditorTermDialog
        client={clients.find((c) => c.id === termCell?.clientId) ?? null}
        fy={termCell?.fy ?? 0}
        onClose={() => setTermCell(null)}
      />
      <ChoosePartDialog
        rows={choosing}
        onChoose={(r) => {
          setChoosing(null);
          setMarking(r);
        }}
        onClose={() => setChoosing(null)}
      />
    </section>
  );
}

/**
 * A cell holding several dues (DIR-3 KYC, one per director): pick which one
 * to record before the filing dialog opens.
 */
function ChoosePartDialog({
  rows,
  onChoose,
  onClose,
}: {
  rows: DuesRow[] | null;
  onChoose: (row: DuesRow) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={rows !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-w-md">
        {rows ? (
          <div className="space-y-4">
            <div>
              <DialogTitle className="font-heading text-lg">Which one was filed?</DialogTitle>
              <DialogDescription className="mt-1 text-sm">
                {rows[0].form} for {rows[0].company} covers {rows.length} directors. Choose one to record.
              </DialogDescription>
            </div>
            <ul className="space-y-1.5">
              {rows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onChoose(r)}
                    className="flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left text-sm transition-colors hover:border-primary/30 hover:bg-accent/50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.obligation.replace(/^Director KYC — /, "")}</span>
                      <span className="block text-xs text-muted-foreground">
                        {r.status === "completed"
                          ? `Filed${r.filedOn ? ` ${formatDate(r.filedOn)}` : ""}${r.srn ? ` · ${r.srn}` : ""}`
                          : `${STATUS_LABEL[r.status]} · due ${formatDate(r.due)}`}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-medium text-primary">
                      {r.status === "completed" ? "Edit" : "Mark filed"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function HeaderCell({
  column,
  sort,
  onSort,
}: {
  column: DuesColumn;
  sort: Sort;
  onSort: (key: string) => void;
}) {
  const active = sort.key === column.key;
  return (
    <th
      className="border-r border-b px-2 py-2 font-medium whitespace-nowrap last:border-r-0"
      aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(column.key)}
        className="inline-flex items-center gap-1 hover:text-primary"
      >
        {column.header}
        {active ? (
          sort.dir === 1 ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />
        ) : null}
      </button>
    </th>
  );
}

function BodyCell({
  column,
  row,
  onOpenClient,
}: {
  column: DuesColumn;
  row: DuesRow;
  onOpenClient?: (clientId: string) => void;
}) {
  // One line per row, like a spreadsheet: the sheet scrolls sideways instead.
  const base = "border-r border-b px-2 py-1.5 whitespace-nowrap last:border-r-0";
  switch (column.key) {
    case "company":
      if (!onOpenClient) return <td className={cn(base, "max-w-[15rem] truncate font-medium")}>{row.company}</td>;
      return (
        <td className={cn(base, "max-w-[15rem]")}>
          <button
            type="button"
            onClick={() => onOpenClient(row.clientId)}
            className="block max-w-full truncate text-left font-medium hover:text-primary hover:underline"
            title={`${row.company} — open its calendar`}
          >
            {row.company}
          </button>
        </td>
      );
    case "status":
      return <td className={cn(base, "whitespace-nowrap", STATUS_CELL[row.status])}>{STATUS_LABEL[row.status]}</td>;
    case "srn":
      return (
        <td className={cn(base, "whitespace-nowrap")}>
          {row.srn ? <SrnChip srn={row.srn} kind={referenceKind(row.sourceId)} /> : null}
        </td>
      );
    case "cin":
    case "form":
      return <td className={cn(base, "font-semibold whitespace-nowrap")}>{column.text(row)}</td>;
    case "due":
    case "filedOn":
    case "days":
      return <td className={cn(base, "tabular whitespace-nowrap")}>{column.text(row)}</td>;
    case "obligation":
      return (
        <td className={cn(base, "max-w-[16rem]")}>
          <span className="block truncate" title={row.obligation}>
            {row.obligation}
          </span>
        </td>
      );
    default:
      return <td className={base}>{column.text(row)}</td>;
  }
}

/** What the matrix colours mean. */
function MatrixKey() {
  const items: [string, string][] = [
    ["bg-destructive/40", "Not filed, overdue"],
    ["bg-orange-500/40", "Not filed, due within 30 days"],
    ["bg-emerald-500/40", "Filed"],
    ["bg-emerald-500/10", "Not yet due"],
    ["bg-muted", "— does not apply"],
  ];
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      {items.map(([swatch, label]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className={cn("inline-block size-3 rounded-sm border", swatch)} aria-hidden />
          {label}
        </span>
      ))}
    </div>
  );
}
