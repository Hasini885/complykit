"use client";

import * as React from "react";
import { toast } from "sonner";
import { CalendarClock, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { textInput } from "@/lib/input-filters";
import { usePortfolio } from "@/components/portfolio/portfolio-provider";
import { formatDate, isoDate, parseIsoDate } from "@/lib/dates";
import { checkOverrideDate } from "@/lib/portfolio/due-overrides";
import { columnTitle, type FilingMatrix, type MatrixColumn } from "@/lib/portfolio/filing-matrix";
import { bulkDueChanges, bulkDueTargets, usualDue, type BulkEntry } from "@/lib/portfolio/bulk-due";

/**
 * Sets one due date across forms and companies at once: tick one form or
 * All forms, tick the companies or Select all, choose the date. Each
 * occurrence moves for its own year only, exactly as the single-row "Change
 * the due date" does, and its original date stays visible beside the new one.
 */
export function SetDueDatesDialog({
  matrix,
  columnKey,
  onClose,
}: {
  matrix: FilingMatrix;
  /** The form to open on; "" opens with all forms ticked; null keeps it closed. */
  columnKey: string | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={columnKey !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        {columnKey !== null && matrix.columns.length > 0 ? (
          <SetDueDatesBody
            key={columnKey}
            matrix={matrix}
            initialColumns={columnKey ? [columnKey] : matrix.columns.map((c) => c.key)}
            onDone={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

const LABEL = "text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground";

function SetDueDatesBody({
  matrix,
  initialColumns,
  onDone,
}: {
  matrix: FilingMatrix;
  initialColumns: string[];
  onDone: () => void;
}) {
  const { applyDueDates } = usePortfolio();
  const [keys, setKeys] = React.useState<Set<string>>(() => new Set(initialColumns));
  const { open, filed } = React.useMemo(() => bulkDueTargets(matrix, keys), [matrix, keys]);
  // Companies the user unticked. Tracked this way round so that a company
  // appearing when another form is ticked starts out selected.
  const [excluded, setExcluded] = React.useState<Set<string>>(() => new Set());
  const [date, setDate] = React.useState(() => {
    const first = bulkDueTargets(matrix, initialColumns).open[0]?.entries[0];
    return first ? isoDate(first.cell.due) : "";
  });
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const columns = matrix.columns.filter((c) => keys.has(c.key));
  const allForms = matrix.columns.every((c) => keys.has(c.key));
  const chosen = open.filter((t) => !excluded.has(t.clientId));
  const selectedIds = new Set(chosen.map((t) => t.clientId));
  const allCompanies = open.length > 0 && chosen.length === open.length;
  const changeCount = chosen.reduce((n, t) => n + t.entries.length, 0);
  const years = [...new Set(columns.map((c) => c.fy))];

  /** Open companies per form, shown beside each form. */
  const openPerForm = React.useMemo(
    () => new Map(matrix.columns.map((c) => [c.key, bulkDueTargets(matrix, [c.key]).open.length])),
    [matrix],
  );

  function toggleForm(key: string) {
    setKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setError(null);
  }

  function toggleCompany(id: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function problem(): string | null {
    if (keys.size === 0) return "Tick at least one form.";
    if (chosen.length === 0) return "Tick at least one company.";
    return null;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const found = problem() ?? checkOverrideDate(date);
    setError(found);
    if (found) return;
    setBusy(true);
    try {
      await applyDueDates(bulkDueChanges(chosen, selectedIds, date, note));
      toast.success(`Due ${formatDate(parseIsoDate(date)!)} set`, {
        description: `${plural(columns.length, "form")} for ${plural(chosen.length, "company", "companies")}. Other years keep their usual date.`,
      });
      onDone();
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    const found = problem();
    setError(found);
    if (found) return;
    setBusy(true);
    try {
      await applyDueDates(bulkDueChanges(chosen, selectedIds, null));
      toast.success(`Back on the usual date for ${plural(chosen.length, "company", "companies")}`);
      onDone();
    } finally {
      setBusy(false);
    }
  }

  const anyManual = chosen.some((t) => t.entries.some((e) => e.rows.some((r) => r.item?.originalDue)));
  const picked = parseIsoDate(date);
  const afterUsual =
    picked !== null &&
    chosen.some((t) => t.entries.some((e) => e.rows.some((r) => picked.getTime() > usualDue(r).getTime())));

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <DialogTitle className="font-heading text-lg">Set a due date</DialogTitle>
        <DialogDescription className="mt-1 text-sm">
          Give one form, or all of them, your own due date for all companies or only some. It applies to{" "}
          {years.length === 1 ? years[0] : "each form's own year"} only; other years keep their usual
          date, and the original date stays visible.
        </DialogDescription>
      </div>

      {/* Forms */}
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className={LABEL}>Forms</span>
          <span className="text-xs text-muted-foreground">
            {keys.size} of {matrix.columns.length} selected
          </span>
        </div>
        <div className="rounded-md border">
          <CheckRow
            checked={allForms}
            indeterminate={keys.size > 0 && !allForms}
            onChange={() => setKeys(allForms ? new Set() : new Set(matrix.columns.map((c) => c.key)))}
            className="border-b bg-muted/40 font-medium"
          >
            All forms
          </CheckRow>
          <ul className="max-h-40 overflow-y-auto p-1">
            {matrix.columns.map((c) => (
              <li key={c.key}>
                <CheckRow checked={keys.has(c.key)} onChange={() => toggleForm(c.key)}>
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{formTitle(c)}</span>{" "}
                    <span className="text-muted-foreground">— {c.obligation}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {openPerForm.get(c.key) ? `${openPerForm.get(c.key)} open` : "all filed"}
                  </span>
                </CheckRow>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Companies */}
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className={LABEL}>Companies</span>
          <span className="text-xs text-muted-foreground">
            {chosen.length} of {open.length} selected
          </span>
        </div>
        {open.length === 0 ? (
          <p className="rounded-md border p-3 text-sm text-muted-foreground">
            {keys.size === 0 ? "Tick a form above." : "Every company has already filed the forms ticked."}
          </p>
        ) : (
          <div className="rounded-md border">
            <CheckRow
              checked={allCompanies}
              indeterminate={chosen.length > 0 && !allCompanies}
              onChange={() =>
                setExcluded(allCompanies ? new Set(open.map((t) => t.clientId)) : new Set())
              }
              className="border-b bg-muted/40 font-medium"
            >
              Select all
            </CheckRow>
            <ul className="max-h-48 overflow-y-auto p-1">
              {open.map((t) => (
                <li key={t.clientId}>
                  <CheckRow checked={!excluded.has(t.clientId)} onChange={() => toggleCompany(t.clientId)}>
                    <span className="min-w-0 flex-1 truncate">{t.company}</span>
                    <span className="shrink-0 text-right text-[11px] text-muted-foreground">
                      {t.entries.length === 1 ? (
                        <EntryDates entry={t.entries[0]} />
                      ) : (
                        `${t.entries.length} forms to file`
                      )}
                    </span>
                  </CheckRow>
                </li>
              ))}
            </ul>
          </div>
        )}
        {filed.length > 0 ? (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Already filed, so not listed: {filed.join(", ")}.
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className={LABEL}>New due date</span>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-invalid={!!error}
            className="tabular"
          />
        </label>
        <label className="block space-y-1.5">
          <span className={LABEL}>Note (optional)</span>
          <Input
            value={note}
            onChange={(e) => setNote(textInput(e.target.value, 120))}
            maxLength={120}
            placeholder="e.g. CBDT extension"
          />
        </label>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {afterUsual ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          This is later than the usual date for some of the forms chosen. Unless the date has been
          officially extended, filing after the usual date still attracts the additional fee and
          penalties.
        </p>
      ) : null}

      <DialogFooter className="gap-2 sm:justify-between">
        {anyManual ? (
          <Button type="button" variant="ghost" onClick={reset} disabled={busy}>
            <RotateCcw className="size-4" aria-hidden /> Back to usual date
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={busy || open.length === 0}>
          <CalendarClock className="size-4" aria-hidden />
          {changeCount > 1
            ? `Set for ${plural(chosen.length, "company", "companies")}${columns.length > 1 ? ` · ${plural(columns.length, "form")}` : ""}`
            : "Set due date"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** "AOC-4 · FY 2025–26", always naming the year here, where forms from several years can sit together. */
function formTitle(c: MatrixColumn): string {
  return c.showFy ? columnTitle(c) : `${columnTitle(c)} · ${c.fy}`;
}

function EntryDates({ entry }: { entry: BulkEntry }) {
  const { cell } = entry;
  if (!cell.originalDue) return <>Due date {formatDate(cell.due)}</>;
  return (
    <>
      <span className="block">Original due date {formatDate(cell.originalDue)}</span>
      <span className="block font-medium text-foreground">
        Extended due date {formatDate(cell.due)}
        {cell.manualDue ? " (manual)" : ""}
      </span>
    </>
  );
}

function CheckRow({
  checked,
  indeterminate = false,
  onChange,
  className,
  children,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm hover:bg-muted ${className ?? ""}`}>
      <input
        type="checkbox"
        checked={checked}
        ref={(el) => {
          if (el) el.indeterminate = indeterminate;
        }}
        onChange={onChange}
        className="size-3.5 shrink-0 accent-primary"
      />
      {children}
    </label>
  );
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
