"use client";

import * as React from "react";
import { toast } from "sonner";
import { AlertTriangle, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { usePortfolio } from "@/components/portfolio/portfolio-provider";

/**
 * Deletes every company and director in the portfolio.
 *
 * This is the only irreversible action in the app — the data lives in this
 * browser and nowhere else, so there is no server copy to restore from. That
 * is why it asks the reader to type the word rather than offering a single
 * click they could hit by accident, and why it states the counts it is about
 * to destroy instead of a vague "are you sure".
 */
export function ClearAllDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-md gap-0 p-0">
        {/* Keyed so the typed confirmation resets every time it reopens. */}
        <ClearAllBody key={String(open)} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

const PHRASE = "DELETE";

function ClearAllBody({ onDone }) {
  const { clients, directors, clearAll } = usePortfolio();
  const [typed, setTyped] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const nothingToDelete = clients.length === 0 && directors.length === 0;
  const confirmed = typed.trim().toUpperCase() === PHRASE;

  async function handleClear() {
    setBusy(true);
    try {
      const removed = `${clients.length} compan${clients.length === 1 ? "y" : "ies"} and ${directors.length} director${directors.length === 1 ? "" : "s"}`;
      await clearAll();
      toast.success(`Removed ${removed}`, {
        description: "The portfolio is now empty.",
      });
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="space-y-4 p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-4 text-destructive" aria-hidden />
          </span>
          <div>
            <h2 className="font-heading text-lg leading-tight">Remove everything?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {nothingToDelete
                ? "There is nothing stored — no companies and no directors."
                : `This deletes all ${clients.length} compan${clients.length === 1 ? "y" : "ies"} and all ${directors.length} director${directors.length === 1 ? "" : "s"}, including everything you entered by hand.`}
            </p>
          </div>
        </div>

        {nothingToDelete ? null : (
          <>
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-muted-foreground">
              This data is stored in this browser only. There is no server copy and no undo — once deleted it cannot be
              recovered.
            </p>

            <div>
              <label htmlFor="clear-confirm" className="mb-1.5 block text-sm font-medium">
                Type <span className="font-mono font-semibold">{PHRASE}</span> to confirm
              </label>
              <Input
                id="clear-confirm"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                placeholder={PHRASE}
                className="font-mono"
              />
            </div>
          </>
        )}
      </div>

      <DialogFooter className="border-t p-4">
        <Button variant="outline" onClick={onDone} disabled={busy}>
          <X className="size-4" aria-hidden /> Cancel
        </Button>
        {nothingToDelete ? null : (
          <Button variant="destructive" onClick={handleClear} disabled={!confirmed || busy}>
            <Trash2 className="size-4" aria-hidden />
            {busy ? "Removing…" : "Delete everything"}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}
