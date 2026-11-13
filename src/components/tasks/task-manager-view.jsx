"use client";

import * as React from "react";
import { Download, Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tip } from "@/components/shared/tip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ColumnFilter, useColumnFilters } from "@/components/shared/column-filter";
import { LegendDot, MiniCalendar } from "@/components/shared/mini-calendar";
import { usePortfolio } from "@/components/portfolio/portfolio-provider";
import { useStoredJson } from "@/lib/stored-json";
import { newId } from "@/lib/portfolio/clients";
import { EMPTY_GST, GST_KEY } from "@/lib/gst/register";
import { cn } from "@/lib/utils";
import {
  EMPTY_TASKS,
  TASKS_KEY,
  TASK_COLUMNS,
  TASK_STATUSES,
  cellValue,
  deadlinesByDay,
  dmy,
  feeValue,
  isOverdue,
  isoToday,
  newTask,
  taskSummary,
  withField,
} from "@/lib/tasks/tasks";

const CELL_INPUT =
  "h-8 w-full min-w-0 rounded-md bg-transparent px-2 text-sm outline-none focus:bg-background focus:ring-2 focus:ring-ring/40";
/** Text columns that offer values already typed in that column (and, for clients, your MCA and GST clients). */
const SUGGESTED = ["client", "work", "assigned", "mobile", "ref", "remark1", "remark2"];
const inr = (n) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function TaskManagerView() {
  const [data, setData, ready] = useStoredJson(TASKS_KEY, EMPTY_TASKS);
  const [gst] = useStoredJson(GST_KEY, EMPTY_GST);
  const { clients: companies } = usePortfolio();
  const today = isoToday();
  const now = new Date();
  const [cal, setCal] = React.useState({ y: now.getFullYear(), m: now.getMonth() });
  const valueOf = React.useCallback((t, key) => (key === "sno" ? String(t.sno) : cellValue(t, key)), []);
  const table = useColumnFilters(valueOf);
  const lastAdded = React.useRef(null);

  const numbered = data.rows.map((t, i) => ({ ...t, sno: i + 1 }));
  const rows = table.apply(numbered);
  const sum = taskSummary(data.rows, today);
  const shownFee = rows.reduce((n, t) => n + feeValue(t.fee), 0);

  // Suggestions for each text column.
  const suggestions = React.useMemo(() => {
    const out = {};
    for (const key of SUGGESTED) {
      const vals = new Set(data.rows.map((r) => String(r[key] ?? "").trim()).filter(Boolean));
      if (key === "client") {
        companies.forEach((c) => vals.add(c.name));
        gst.clients.forEach((c) => c.name && vals.add(c.name));
      }
      out[key] = [...vals].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    }
    return out;
  }, [data.rows, companies, gst.clients]);

  // The deadline calendar: red overdue, blue pending, green all finished.
  const byDay = deadlinesByDay(data.rows);
  const marks = {};
  let dueThisMonth = 0;
  const monthPrefix = `${cal.y}-${String(cal.m + 1).padStart(2, "0")}-`;
  for (const [iso, o] of Object.entries(byDay)) {
    if (iso.startsWith(monthPrefix)) dueThisMonth += o.pending;
    marks[iso] = {
      tone: o.pending ? (iso < today ? "overdue" : "due") : "done",
      title: `${o.pending} pending, ${o.finished} finished — click to filter`,
    };
  }
  const deadlineFilter = table.filters.deadline;
  const activeDay = deadlineFilter && deadlineFilter.size === 1 ? [...deadlineFilter][0].split("-").reverse().join("-") : null;

  function setField(id, field, value) {
    setData((d) => ({ ...d, rows: d.rows.map((t) => (t.id === id ? withField(t, field, value, isoToday()) : t)) }));
  }
  function addTask() {
    table.clear();
    const t = newTask(newId());
    lastAdded.current = t.id;
    setData((d) => ({ ...d, rows: [...d.rows, t] }));
  }
  function remove(t) {
    if (!window.confirm(`Delete task ${t.sno} (${t.client || "blank"})? Later tasks are renumbered.`)) return;
    setData((d) => ({ ...d, rows: d.rows.filter((x) => x.id !== t.id) }));
  }
  function filterDay(iso) {
    const label = dmy(iso);
    table.setFilters((f) => {
      const next = { ...f };
      if (f.deadline?.size === 1 && f.deadline.has(label)) delete next.deadline;
      else next.deadline = new Set([label]);
      return next;
    });
  }
  async function exportExcel() {
    const { downloadTableXlsx } = await import("@/lib/simple-xlsx");
    await downloadTableXlsx({
      header: ["S.No", ...TASK_COLUMNS.map((c) => c.label)],
      rows: rows.map((t) => [t.sno, ...TASK_COLUMNS.map((c) => (c.number ? feeValue(t.fee) || "" : cellValue(t, c.key)))]),
      sheet: "Tasks",
      fileName: `cacompliancetool-tasks-${today}.xlsx`,
      widths: [6, ...TASK_COLUMNS.map((c) => Math.round(c.width / 8))],
    });
  }

  // Focus the first cell of a task just added.
  React.useEffect(() => {
    if (!lastAdded.current) return;
    const el = document.querySelector(`[data-task="${lastAdded.current}"] input`);
    if (el) {
      el.focus();
      el.scrollIntoView({ block: "nearest" });
      lastAdded.current = null;
    }
  });

  /** Enter moves down a column, like a spreadsheet; on the last row it adds a task. */
  function onKeyDown(e, index, key) {
    if (e.key !== "Enter" || e.target.tagName !== "INPUT") return;
    e.preventDefault();
    const next = rows[index + 1];
    if (next) document.querySelector(`[data-task="${next.id}"] [data-f="${key}"]`)?.focus();
    else addTask();
  }

  if (!ready) return <div className="h-64 animate-pulse rounded-3xl border bg-muted/30" aria-hidden />;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-[3.25rem] sm:leading-[1.05]">
        Task Manager
      </h1>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-primary/25 p-6 text-center">
          <h2 className="font-heading text-lg font-semibold">Task summary</h2>
          <div className="mt-4 flex flex-wrap justify-center gap-10">
            <Num value={sum.total} label="Total" />
            <Num value={sum.pending} label="Pending" className="text-destructive" />
            <Num value={sum.finished} label="Finished" className="text-emerald-500" />
            <Num value={sum.overdue} label="Overdue" className="text-amber-500" />
          </div>
        </div>
        <MiniCalendar
          heading="Deadline calendar"
          year={cal.y}
          month={cal.m}
          marks={marks}
          today={today}
          active={activeDay}
          onDayClick={filterDay}
          onShift={(n) =>
            setCal((c) => {
              const d = new Date(c.y, c.m + n, 1);
              return { y: d.getFullYear(), m: d.getMonth() };
            })
          }
          note={`${dueThisMonth} pending deadline${dueThisMonth === 1 ? "" : "s"} this month`}
          legend={
            <>
              <LegendDot className="bg-destructive">Overdue</LegendDot>
              <LegendDot className="bg-primary">Pending</LegendDot>
              <LegendDot className="bg-emerald-600">Finished</LegendDot>
            </>
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={addTask}>
          <Plus className="size-4" aria-hidden /> Add task
        </Button>
        <Tip label="Download as Excel">
          <Button
            variant="outline"
            size="icon"
            onClick={() => void exportExcel()}
            disabled={rows.length === 0}
            aria-label="Download as Excel"
          >
            <Download className="size-4" aria-hidden />
          </Button>
        </Tip>
        <span className="flex-1" />
        <p className="text-sm text-muted-foreground">
          Showing <b className="text-foreground">{rows.length}</b> tasks · Fee <b className="text-foreground">{inr(shownFee)}</b>{" "}
          · <span className="text-destructive">*</span> mandatory
        </p>
        {table.any ? (
          <Button variant="ghost" size="sm" onClick={table.clear}>
            <X className="size-3.5" aria-hidden /> Clear all filters
          </Button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-3xl border-2 border-dashed border-primary/25">
        <Table className="table-fixed" style={{ minWidth: 56 + 44 + TASK_COLUMNS.reduce((n, c) => n + c.width, 0) }}>
          <colgroup>
            <col style={{ width: 56 }} />
            {TASK_COLUMNS.map((c) => (
              <col key={c.key} style={{ width: c.width }} />
            ))}
            <col style={{ width: 44 }} />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead>S.No</TableHead>
              {TASK_COLUMNS.map((c) => (
                <TableHead key={c.key}>
                  <span className="flex items-center justify-between gap-1">
                    <span className="truncate">
                      {c.label}
                      {c.req ? <span className="text-destructive"> *</span> : null}
                    </span>
                    <ColumnFilter {...table.propsFor(c.key, c.label, numbered)} />
                  </span>
                </TableHead>
              ))}
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={TASK_COLUMNS.length + 2} className="py-10 text-center text-muted-foreground">
                  {data.rows.length === 0 ? "No tasks yet. Click Add task." : "No tasks match the current filters."}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((t, index) => (
                <TableRow key={t.id} data-task={t.id} className="group">
                  <TableCell className="tabular text-muted-foreground">{t.sno}</TableCell>
                  {TASK_COLUMNS.map((c) => (
                    <TableCell key={c.key} className={cn("p-1", c.auto && "px-3 text-sm text-muted-foreground")}>
                      {c.auto ? (
                        dmy(t[c.key])
                      ) : c.key === "status" ? (
                        <select
                          data-f="status"
                          value={t.status}
                          onChange={(e) => setField(t.id, "status", e.target.value)}
                          aria-label="Status"
                          className={cn(
                            "h-8 w-full rounded-md px-2 text-sm font-semibold",
                            t.status === "Finished"
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              : "bg-destructive/15 text-destructive",
                          )}
                        >
                          {TASK_STATUSES.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          data-f={c.key}
                          type={c.date ? "date" : "text"}
                          inputMode={c.number ? "decimal" : c.key === "mobile" ? "tel" : undefined}
                          list={SUGGESTED.includes(c.key) ? `task-sug-${c.key}` : undefined}
                          value={t[c.key] ?? ""}
                          onChange={(e) => setField(t.id, c.key, e.target.value)}
                          onKeyDown={(e) => onKeyDown(e, index, c.key)}
                          aria-label={c.label}
                          className={cn(
                            CELL_INPUT,
                            c.number && "text-right tabular",
                            c.key === "deadline" && isOverdue(t, today) && "font-semibold text-destructive",
                          )}
                        />
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="p-1 text-center">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-destructive opacity-0 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
                      onClick={() => remove(t)}
                      aria-label={`Delete task ${t.sno}`}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
            <TableRow className="cursor-pointer text-muted-foreground" onClick={addTask}>
              <TableCell className="text-center">+</TableCell>
              <TableCell colSpan={TASK_COLUMNS.length + 1}>Click to add a new task…</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {SUGGESTED.map((key) => (
        <datalist key={key} id={`task-sug-${key}`}>
          {suggestions[key].map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
      ))}
    </div>
  );
}

function Num({ value, label, className }) {
  return (
    <div>
      <b className={cn("block font-heading text-3xl", className)}>{value}</b>
      <small className="text-[10.5px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{label}</small>
    </div>
  );
}
