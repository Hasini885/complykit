"use client";

import { CalendarClock, Pencil, Plus } from "lucide-react";
import { formatDate } from "@/lib/dates";
import { cellText, dueLines, filedLines } from "@/lib/portfolio/filing-matrix";
import { cn } from "@/lib/utils";

const CELL_STYLE = {
  overdue: "bg-destructive/15 text-destructive",
  "due-soon": "bg-orange-500/15 text-orange-800 dark:text-orange-300",
  upcoming: "bg-emerald-500/5 text-muted-foreground",
  completed: "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300",
};

const HEAD = {
  overdue: "Not filed",
  "due-soon": "Not filed",
  upcoming: "Not yet due",
  completed: "Filed",
};

/**
 * Companies down the side, dues to file across the top, and in each cell
 * whether it is filed. Scrolls in both directions, with the company column
 * and the header row pinned.
 */
export function FilingMatrixTable({ matrix, onOpenClient, onOpenCell, onOpenColumn, onOpenAuditorTerm }) {
  if (matrix.columns.length === 0) {
    return (
      <div className="rounded-lg border border-dashed px-3 py-10 text-center text-sm text-muted-foreground">
        No forms to file in this period.
      </div>
    );
  }

  return (
    // `relative`: absolutely positioned screen-reader text must not escape the scroll box.
    <div className="relative max-h-[560px] overflow-auto rounded-3xl border-2 border-dashed border-primary/25 bg-card">
      <table className="w-max min-w-full border-collapse text-left text-xs">
        <thead className="sticky top-0 z-20 bg-muted">
          <tr>
            <th className="sticky left-0 z-30 min-w-[13rem] border-r border-b bg-muted px-2 py-2 font-bold">Company</th>
            {matrix.columns.map((c) => (
              <ColumnHead key={c.key} column={c} onOpen={onOpenColumn} />
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((row) => {
            const open = Object.values(row.cells).filter((c) => c.status !== "completed" && !c.notRequired).length;
            return (
              <tr key={row.clientId} className="hover:bg-primary/5">
                <th
                  scope="row"
                  className="sticky left-0 z-10 max-w-[16rem] border-r border-b bg-card px-2 py-1.5 text-left font-bold"
                >
                  {onOpenClient ? (
                    <button
                      type="button"
                      onClick={() => onOpenClient(row.clientId)}
                      className="block max-w-full truncate text-left hover:text-primary hover:underline"
                      title={`${row.company} — show its details`}
                    >
                      {row.company}
                    </button>
                  ) : (
                    <span className="block truncate">{row.company}</span>
                  )}
                  <span className="tabular block text-[10px] font-medium text-muted-foreground">
                    {row.cin} · {open} open
                  </span>
                </th>
                {matrix.columns.map((c) => (
                  <Cell
                    key={c.key}
                    cell={row.cells[c.key]}
                    column={c}
                    company={row.company}
                    onOpen={onOpenCell}
                    onOpenTerm={
                      onOpenAuditorTerm && c.key.startsWith("adt-1|")
                        ? () => onOpenAuditorTerm(row.clientId, Number(c.key.split("|")[1]))
                        : undefined
                    }
                  />
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ColumnHead({ column, onOpen }) {
  const label = (
    <>
      <span className="block text-[13px] font-bold">{column.form}</span>
      {column.showFy || column.period ? (
        <span className="block text-[10px] font-normal text-muted-foreground">
          {[column.showFy ? column.fy : "", column.period].filter(Boolean).join(" · ")}
        </span>
      ) : null}
      <span
        className="block max-w-[10rem] truncate text-[10px] font-normal text-muted-foreground"
        title={column.obligation}
      >
        {column.obligation}
      </span>
    </>
  );
  return (
    <th className="min-w-[8.5rem] border-r border-b px-2 py-1.5 align-bottom font-semibold last:border-r-0">
      {onOpen ? (
        <button
          type="button"
          onClick={() => onOpen(column.key)}
          className="group/head block w-full text-left hover:text-primary"
          title={`Set the ${column.form} due date for all or some companies`}
        >
          {label}
          <span className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-primary opacity-0 transition-opacity group-hover/head:opacity-100 group-focus-visible/head:opacity-100">
            <CalendarClock className="size-3" aria-hidden /> Set due date
          </span>
        </button>
      ) : (
        label
      )}
    </th>
  );
}

function Cell({ cell, column, company, onOpen, onOpenTerm }) {
  if (!cell) {
    return (
      <td
        className="border-r border-b px-2 py-1.5 text-center text-muted-foreground/60 last:border-r-0"
        title={`${column.form} does not apply to this company`}
      >
        —
      </td>
    );
  }
  if (cell.notRequired) {
    const reason = (
      <>
        <span className="block font-semibold">NA</span>
        <span className="block max-w-[14rem] text-[10px] whitespace-normal opacity-80">{cell.notRequired}</span>
      </>
    );
    return (
      <td
        className={cn(
          "border-r border-b bg-muted/40 whitespace-nowrap text-muted-foreground last:border-r-0",
          onOpenTerm ? "p-0" : "px-2 py-1.5",
        )}
        title={cellText(cell, formatDate)}
      >
        {onOpenTerm ? (
          <button
            type="button"
            onClick={onOpenTerm}
            className="block w-full px-2 py-1.5 text-left transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-ring"
            aria-label={`${column.form} ${column.fy} for ${company}: ${cellText(cell, formatDate)}. Enter the ADT-1 SRN, date of filing and years appointed`}
          >
            {reason}
            <span className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-primary">
              <Pencil className="size-3" aria-hidden /> ADT-1 details
            </span>
          </button>
        ) : (
          reason
        )}
      </td>
    );
  }
  const counts = cell.parts > 1 ? ` ${cell.filedParts}/${cell.parts}` : "";
  const content = (
    <>
      <span className="block font-semibold">
        {cell.status === "completed" ? "✓ " : ""}
        {HEAD[cell.status]}
        {counts}
      </span>
      {cell.status === "completed" ? (
        [...dueLines(cell, formatDate), ...filedLines(cell, formatDate)].map((line) => (
          <span
            key={line}
            className={cn(
              "block text-[10px] opacity-80",
              /^(SRN|Ack\.) /.test(line) && "tabular tracking-wide",
              line.startsWith("As per ") && "max-w-[13rem] whitespace-normal",
            )}
          >
            {line}
          </span>
        ))
      ) : (
        <>
          {dueLines(cell, formatDate).map((line, i) => (
            <span
              key={line}
              className={cn(
                "block text-[10px]",
                cell.originalDue && i === 0 ? "opacity-60" : "opacity-90",
                cell.originalDue && i === 1 ? "font-semibold" : "",
                line.startsWith("As per ") ? "max-w-[13rem] whitespace-normal" : "",
              )}
            >
              {line}
              {cell.originalDue && i === 1 && cell.manualDue ? (
                <span className="ml-1 font-normal opacity-70" title="Set manually">
                  (manual)
                </span>
              ) : null}
            </span>
          ))}
          {cell.days < 0 ? <span className="block text-[10px] font-semibold">{-cell.days}d overdue</span> : null}
        </>
      )}
    </>
  );
  const clickable = onOpen !== undefined && cell.rows.some((r) => r.item);
  return (
    <td
      className={cn(
        "border-r border-b whitespace-nowrap last:border-r-0",
        clickable ? "p-0" : "px-2 py-1.5",
        CELL_STYLE[cell.status],
      )}
      title={cellText(cell, formatDate)}
    >
      {clickable ? (
        <button
          type="button"
          onClick={() => onOpen(cell.rows)}
          className="group/cell block w-full px-2 py-1.5 text-left transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-ring"
          aria-label={`${column.form} ${column.fy} for ${company}: ${cellText(cell, formatDate)}. ${
            cell.status === "completed" ? "Edit the filing" : "Mark filed"
          }`}
        >
          {content}
          <span className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-primary opacity-0 transition-opacity group-hover/cell:opacity-100 group-focus-visible/cell:opacity-100">
            {cell.status === "completed" ? (
              <Pencil className="size-3" aria-hidden />
            ) : (
              <Plus className="size-3" aria-hidden />
            )}
            {cell.status === "completed" ? "Edit" : "Mark filed"}
          </span>
        </button>
      ) : (
        content
      )}
    </td>
  );
}
