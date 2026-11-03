"use client";

import * as React from "react";
import { toast } from "sonner";
import { CalendarClock, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { textInput } from "@/lib/input-filters";
import { usePortfolio } from "@/components/portfolio/portfolio-provider";
import { financialYearLabel, formatDate, isoDate, parseIsoDate } from "@/lib/dates";
import { checkOverrideDate } from "@/lib/portfolio/due-overrides";
import type { ResolvedDueDate } from "@/lib/resolve-due-dates";

/**
 * Sets a different due date for ONE occurrence of an obligation, for the
 * user's own convenience. Next year's occurrence keeps its usual date, and
 * the usual date stays visible beside the chosen one.
 */
export function ChangeDueDialog({
  clientId,
  item,
  onOpenChange,
}: {
  clientId: string;
  /** The row being changed; null keeps the dialog closed. */
  item: ResolvedDueDate | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={item !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {item ? (
          <ChangeDueBody
            key={`${item.source.id}-${item.fyEndingYear}-${item.qualifier ?? ""}`}
            clientId={clientId}
            item={item}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ChangeDueBody({
  clientId,
  item,
  onDone,
}: {
  clientId: string;
  item: ResolvedDueDate;
  onDone: () => void;
}) {
  const { setDueDate, resetDueDate } = usePortfolio();
  const usual = item.originalDue ?? item.due!;
  const [date, setDate] = React.useState(isoDate(item.due!));
  const [note, setNote] = React.useState(item.customNote ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const chosen = parseIsoDate(date);
  const afterUsual = chosen !== null && chosen.getTime() > usual.getTime();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const problem = checkOverrideDate(date);
    setError(problem);
    if (problem) return;
    setBusy(true);
    try {
      if (date === isoDate(usual)) {
        await resetDueDate(clientId, item);
        toast.success(`${item.source.title} is back on its usual date`);
      } else {
        await setDueDate(clientId, item, { date, note });
        toast.success(`${item.source.title}: due ${formatDate(chosen!)} this time`, {
          description: `Only for ${financialYearLabel(item.fyEndingYear)}${item.qualifier ? `, ${item.qualifier}` : ""}. Other years keep the usual date.`,
        });
      }
      onDone();
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    try {
      await resetDueDate(clientId, item);
      toast.success(`${item.source.title} is back on its usual date, ${formatDate(usual)}`);
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <DialogTitle className="font-heading text-lg">Change the due date — this time only</DialogTitle>
        <DialogDescription className="mt-1 text-sm">
          {item.source.title}
          {item.source.formCode ? ` (${item.source.formCode})` : ""} for {financialYearLabel(item.fyEndingYear)}
          {item.qualifier ? `, ${item.qualifier}` : ""}. Usual date: {formatDate(usual)}. Next year&apos;s
          due keeps its usual date.
        </DialogDescription>
      </div>

      <label className="block space-y-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Your due date
        </span>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-invalid={!!error}
          className="tabular"
        />
        {error ? <span className="text-xs text-destructive">{error}</span> : null}
        {afterUsual ? (
          <span className="block text-xs text-amber-700 dark:text-amber-400">
            This is after the usual date of {formatDate(usual)}. The law does not move: filing after
            that still attracts the additional fee and penalties.
          </span>
        ) : null}
      </label>

      <label className="block space-y-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Note (optional)
        </span>
        <Input
          value={note}
          onChange={(e) => setNote(textInput(e.target.value, 120))}
          maxLength={120}
          placeholder="e.g. Board meeting on the 20th"
        />
      </label>

      <DialogFooter className="gap-2 sm:justify-between">
        {item.originalDue ? (
          <Button type="button" variant="ghost" onClick={reset} disabled={busy}>
            <RotateCcw className="size-4" aria-hidden /> Back to usual date
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={busy}>
          <CalendarClock className="size-4" aria-hidden /> Save for this time
        </Button>
      </DialogFooter>
    </form>
  );
}
