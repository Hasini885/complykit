"use client";

import * as React from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { usePortfolio } from "@/components/portfolio/portfolio-provider";
import { AuditorYearsField } from "@/components/dashboard/auditor-years-field";
import { financialYearLabel } from "@/lib/dates";
import { appointmentFyFor, auditorTermSummary, withAuditorTerm } from "@/lib/portfolio/auditor";
import { auditorTermOf } from "@/lib/portfolio/schedule";
import type { Client } from "@/lib/portfolio/types";

/**
 * Opened from an ADT-1 "NA" cell: how many years the subsequent auditor was
 * appointed for. That decides which later years are NA and when ADT-1 is next
 * due, and the summary shows exactly that before saving.
 */
export function AuditorTermDialog({
  client,
  fy,
  onClose,
}: {
  /** The company whose cell was clicked; null keeps the dialog closed. */
  client: Client | null;
  /** The financial year of that cell. */
  fy: number;
  onClose: () => void;
}) {
  return (
    <Dialog open={client !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-w-md">
        {client ? <Body key={`${client.id}-${fy}`} client={client} fy={fy} onDone={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function Body({ client, fy, onDone }: { client: Client; fy: number; onDone: () => void }) {
  const { setAuditorTerm } = usePortfolio();
  const appointedFy = appointmentFyFor(client, fy) ?? fy;
  const [years, setYears] = React.useState(() => auditorTermOf(client));
  const [busy, setBusy] = React.useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await setAuditorTerm(client.id, appointedFy, years);
      toast.success(`Auditor appointed for ${years} year${years === 1 ? "" : "s"}`);
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <DialogTitle className="font-heading text-lg">Subsequent auditor</DialogTitle>
        <DialogDescription className="mt-1 text-sm">
          {client.name}: the auditor appointed at the AGM for {financialYearLabel(appointedFy)}.
        </DialogDescription>
      </div>
      <AuditorYearsField value={years} onChange={setYears} />
      <p className="rounded-md bg-muted/40 px-3 py-2 text-xs leading-relaxed">
        {auditorTermSummary(withAuditorTerm(client, appointedFy, years))}
      </p>
      <DialogFooter>
        <Button type="submit" disabled={busy}>
          <Save className="size-4" aria-hidden /> Save
        </Button>
      </DialogFooter>
    </form>
  );
}
