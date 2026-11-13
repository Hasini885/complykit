"use client";

import * as React from "react";
import { toast } from "sonner";
import { Download, Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tip } from "@/components/shared/tip";
import { useColumnFilters } from "@/components/shared/column-filter";
import { SHEET_INPUT, Sheet, SheetCell, SheetHead, pastedDate } from "@/components/shared/sheet";
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
  const activeDay =
    deadlineFilter && deadlineFilter.size === 1 ? [...deadlineFilter][0].split("-").reverse().join("-") : null;

  function setField(id, field, value) {
    setData((d) => ({ ...d, rows: d.rows.map((t) => (t.id === id ? withField(t, field, value, isoToday()) : t)) }));
  }
  /** Adds a blank task and puts the cursor in it (in column `col`, when Enter added it). */
  function addTask(col = 0) {
    table.clear();
    const t = newTask(newId());
    lastAdded.current = { id: t.id, col: typeof col === "number" ? col : 0 };
    setData((d) => ({ ...d, rows: [...d.rows, t] }));
  }
  /** A block pasted from Excel fills the cells from where it lands, adding tasks as needed. */
  function pasteGrid(block, r, c) {
    const targetIds = rows.map((x) => x.id);
    const day = isoToday();
    setData((d) => {
      const list = [...d.rows];
      block.forEach((cells, i) => {
        let id = targetIds[r + i];
        if (!id) {
          const fresh = newTask(newId());
          list.push(fresh);
          id = fresh.id;
        }
        const at = list.findIndex((x) => x.id === id);
        let next = list[at];
        cells.forEach((v, j) => {
          const col = TASK_COLUMNS[c + j];
          if (!col || col.auto) return;
          const value =
            col.key === "status"
              ? /^fin|^done|^comp/i.test(v)
                ? "Finished"
                : "Pending"
              : col.date
                ? pastedDate(v)
                : v;
          next = withField(next, col.key, value, day);
        });
        list[at] = next;
      });
      return { ...d, rows: list };
    });
    toast.success(`Pasted ${block.length} row${block.length === 1 ? "" : "s"}`);
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
      rows: rows.map((t) => [
        t.sno,
        ...TASK_COLUMNS.map((c) => (c.number ? feeValue(t.fee) || "" : cellValue(t, c.key))),
      ]),
      sheet: "Tasks",
      fileName: `cacompliancetool-tasks-${today}.xlsx`,
      widths: [6, ...TASK_COLUMNS.map((c) => Math.round(c.width / 8))],
    });
  }

  // Put the cursor in a task just added.
  React.useEffect(() => {
    if (!lastAdded.current) return;
    const { id, col } = lastAdded.current;
    const row = document.querySelector(`[data-task="${id}"]`);
    const el = row?.querySelector(`[data-c="${col}"]`) ?? row?.querySelector("[data-c]");
    if (el) {
      el.focus();
      el.scrollIntoView({ block: "nearest" });
      lastAdded.current = null;
    }
  });

  if (!ready) return <div className="h-64 animate-pulse rounded-3xl border bg-muted/30" aria-hidden />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <h1 className="font-heading text-3xl font-bold tracking-tight">Task Manager</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Num value={sum.total} label="Total" />
            <Num value={sum.pending} label="Pending" className="text-destructive" />
            <Num value={sum.finished} label="Finished" className="text-emerald-500" />
            <Num value={sum.overdue} label="Overdue" className="text-amber-500" />
          </div>
        </div>
        <MiniCalendar
          compact
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
        <Button onClick={() => addTask()}>
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
          Showing <b className="text-foreground">{rows.length}</b> tasks · Fee{" "}
          <b className="text-foreground">{inr(shownFee)}</b> · <span className="text-destructive">*</span> mandatory
        </p>
        {table.any ? (
          <Button variant="ghost" size="sm" onClick={table.clear}>
            <X className="size-3.5" aria-hidden /> Clear all filters
          </Button>
        ) : null}
      </div>

      <Sheet
        onPasteGrid={pasteGrid}
        onEnterPastEnd={addTask}
        minWidth={64 + 52 + TASK_COLUMNS.reduce((n, c) => n + c.width, 0)}
      >
        <colgroup>
          <col style={{ width: 64 }} />
          {TASK_COLUMNS.map((c) => (
            <col key={c.key} style={{ width: c.width }} />
          ))}
          <col style={{ width: 52 }} />
        </colgroup>
        <thead>
          <tr>
            <SheetHead sno>S.No</SheetHead>
            {TASK_COLUMNS.map((c) => (
              <SheetHead key={c.key} req={c.req} filter={table.propsFor(c.key, c.label, numbered)}>
                {c.label}
              </SheetHead>
            ))}
            <SheetHead />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <SheetCell colSpan={TASK_COLUMNS.length + 2} className="py-10 text-center text-muted-foreground">
                {data.rows.length === 0
                  ? "No tasks yet. Click Add task, or paste rows copied from Excel into a cell."
                  : "No tasks match the current filters."}
              </SheetCell>
            </tr>
          ) : (
            rows.map((t, r) => (
              <tr key={t.id} data-task={t.id} className="group">
                <SheetCell sno>{t.sno}</SheetCell>
                {TASK_COLUMNS.map((c, ci) => (
                  <SheetCell key={c.key} className={cn(c.auto && "px-3 text-muted-foreground")}>
                    {c.auto ? (
                      dmy(t[c.key])
                    ) : c.key === "status" ? (
                      <select
                        data-r={r}
                        data-c={ci}
                        value={t.status}
                        onChange={(e) => setField(t.id, "status", e.target.value)}
                        aria-label="Status"
                        className={cn(
                          SHEET_INPUT,
                          "cursor-pointer font-semibold",
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
                        data-r={r}
                        data-c={ci}
                        type={c.date ? "date" : "text"}
                        inputMode={c.number ? "decimal" : c.key === "mobile" ? "tel" : undefined}
                        list={SUGGESTED.includes(c.key) ? `task-sug-${c.key}` : undefined}
                        value={t[c.key] ?? ""}
                        onChange={(e) => setField(t.id, c.key, e.target.value)}
                        aria-label={c.label}
                        className={cn(
                          SHEET_INPUT,
                          c.key === "client" && "font-medium",
                          c.number && "text-right tabular",
                          c.key === "deadline" && isOverdue(t, today) && "font-semibold text-destructive",
                        )}
                      />
                    )}
                  </SheetCell>
                ))}
                <SheetCell className="text-center">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-destructive opacity-0 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
                    onClick={() => remove(t)}
                    aria-label={`Delete task ${t.sno}`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </SheetCell>
              </tr>
            ))
          )}
          <tr className="cursor-pointer text-muted-foreground" onClick={() => addTask()}>
            <SheetCell sno>+</SheetCell>
            <SheetCell colSpan={TASK_COLUMNS.length + 1} className="px-3">
              Click to add a new task… (or press Enter on the last row)
            </SheetCell>
          </tr>
        </tbody>
      </Sheet>

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

/** A small count: "5 Pending". */
function Num({ value, label, className }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded-full border-2 border-dashed border-primary/25 px-3 py-1">
      <b className={cn("font-heading text-lg", className)}>{value}</b>
      <small className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">{label}</small>
    </span>
  );
}
