"use client";

import * as React from "react";
import { toast } from "sonner";
import { Download, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tip } from "@/components/shared/tip";
import { useColumnFilters } from "@/components/shared/column-filter";
import { SHEET_INPUT, Sheet, SheetCell, SheetHead, SnoCell, pastedDate, useRowDrag } from "@/components/shared/sheet";
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
  dmy,
  feeValue,
  isOverdue,
  isoToday,
  newTask,
  moveRow,
  withField,
} from "@/lib/tasks/tasks";

/** Text columns that offer values already typed in that column (and, for clients, your MCA and GST clients). */
const SUGGESTED = ["client", "work", "assigned", "mobile", "ref", "remark1", "remark2"];
/** Columns that stay put (with S.No) when the sheet scrolls sideways, and where each one sits. */
const FROZEN = { client: { left: 80 }, work: { left: 80 + TASK_COLUMNS[0].width, last: true } };
const frozenClass = (key) => FROZEN[key] && cn("sheet-frozen", FROZEN[key].last && "sheet-frozen-last");
const inr = (n) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function TaskManagerView() {
  const [data, setData, ready] = useStoredJson(TASKS_KEY, EMPTY_TASKS);
  const [gst] = useStoredJson(GST_KEY, EMPTY_GST);
  const { clients: companies } = usePortfolio();
  const today = isoToday();
  const valueOf = React.useCallback((t, key) => (key === "sno" ? String(t.sno) : cellValue(t, key)), []);
  const table = useColumnFilters(valueOf);
  const lastAdded = React.useRef(null);

  const numbered = data.rows.map((t, i) => ({ ...t, sno: i + 1 }));
  // Drag a row by its grip to put the tasks in your own order (saved; S.No follows).
  const drag = useRowDrag((fromId, toId) => setData((d) => ({ ...d, rows: moveRow(d.rows, fromId, toId) })));
  const rows = table.apply(numbered);
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
                : /^client/i.test(v)
                  ? "Client Pending"
                  : /^off/i.test(v)
                    ? "Officer Pending"
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
    // A blank row added by mistake goes straight away; one with anything in it asks first.
    const blank = TASK_COLUMNS.every((c) => c.auto || c.key === "status" || !String(t[c.key] ?? "").trim());
    if (!blank && !window.confirm(`Delete task ${t.sno} (${t.client || "no client"})? Later tasks are renumbered.`))
      return;
    setData((d) => ({ ...d, rows: d.rows.filter((x) => x.id !== t.id) }));
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
      <h1 className="font-heading text-3xl font-bold tracking-tight">Task Manager</h1>

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
        minWidth={80 + TASK_COLUMNS.reduce((n, c) => n + c.width, 0)}
      >
        <colgroup>
          <col style={{ width: 80 }} />
          {TASK_COLUMNS.map((c) => (
            <col key={c.key} style={{ width: c.width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <SheetHead sno>S.No</SheetHead>
            {TASK_COLUMNS.map((c) => (
              <SheetHead
                key={c.key}
                req={c.req}
                className={frozenClass(c.key)}
                style={FROZEN[c.key] ? { left: FROZEN[c.key].left } : undefined}
                filter={table.propsFor(c.key, c.label, numbered, c.key === "status" ? TASK_STATUSES : [])}
              >
                {c.label}
              </SheetHead>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <SheetCell colSpan={TASK_COLUMNS.length + 1} className="py-10 text-center text-muted-foreground">
                {data.rows.length === 0
                  ? "No tasks yet. Click Add task, or paste rows copied from Excel into a cell."
                  : "No tasks match the current filters."}
              </SheetCell>
            </tr>
          ) : (
            rows.map((t, r) => (
              <tr key={t.id} data-task={t.id} {...drag.row(t.id)} className={cn("group/row", drag.row(t.id).className)}>
                <SnoCell
                  n={t.sno}
                  onDelete={() => remove(t)}
                  label={`Delete task ${t.sno}`}
                  dragProps={table.sorted ? undefined : drag.grip(t.id)}
                />
                {TASK_COLUMNS.map((c, ci) => (
                  <SheetCell
                    key={c.key}
                    className={cn(c.auto && "px-3 text-muted-foreground", frozenClass(c.key))}
                    style={FROZEN[c.key] ? { left: FROZEN[c.key].left } : undefined}
                  >
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
                            : t.status === "Client Pending"
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                              : t.status === "Officer Pending"
                                ? "bg-violet-500/15 text-violet-600 dark:text-violet-400"
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
              </tr>
            ))
          )}
          <tr className="cursor-pointer text-muted-foreground" onClick={() => addTask()}>
            <SheetCell sno>+</SheetCell>
            <SheetCell colSpan={TASK_COLUMNS.length} className="px-3">
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
