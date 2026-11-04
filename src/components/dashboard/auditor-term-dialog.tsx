"use client";

import * as React from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { usePortfolio } from "@/components/portfolio/portfolio-provider";
import { AuditorYearsField } from "@/components/dashboard/auditor-years-field";
import { isoDate, parseIsoDate, today } from "@/lib/dates";
import { srnInput } from "@/lib/input-filters";
import { appointmentCovering, auditorTermSummary, withAdt1Appointment } from "@/lib/portfolio/auditor";
import { validateFiling, type FilingInput } from "@/lib/portfolio/filings";
import { auditorTermOf } from "@/lib/portfolio/schedule";
import type { Client } from "@/lib/portfolio/types";

const LABEL = "text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground";

/**
 * Opened from an ADT-1 "NA" cell: the subsequent auditor's ADT-1, as its SRN,
 * date of filing and years appointed. These decide which years are NA, and the
 * NA cells quote this SRN. The summary shows the result before saving.
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
  const { saveAuditorAppointment } = usePortfolio();
  const existing = appointmentCovering(client, fy);
  const [input, setInput] = React.useState<FilingInput>({
    srn: existing?.srn ?? "",
    filedOn: existing?.filedOn ? isoDate(existing.filedOn) : "",
  });
  const [years, setYears] = React.useState(() => existing?.years ?? auditorTermOf(client));
  const [errors, setErrors] = React.useState<Partial<Record<keyof FilingInput, string>>>({});
  const [busy, setBusy] = React.useState(false);

  const filed = parseIsoDate(input.filedOn);
  const incorporated = parseIsoDate(client.incorporatedOn);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const found = validateFiling(input, { srnRequired: true });
    if (filed && incorporated && filed.getTime() < incorporated.getTime()) {
      found.filedOn = "ADT-1 is filed after incorporation.";
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      await saveAuditorAppointment(client.id, input, years, existing?.fy ?? null);
      toast.success("ADT-1 saved", { description: `Auditor appointed for ${years} year${years === 1 ? "" : "s"}` });
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <DialogTitle className="font-heading text-lg">ADT-1: subsequent auditor</DialogTitle>
        <DialogDescription className="mt-1 text-sm">{client.name}</DialogDescription>
      </div>

      <label className="block space-y-1.5">
        <span className={LABEL}>SRN</span>
        <Input
          value={input.srn}
          onChange={(e) => setInput((v) => ({ ...v, srn: srnInput(e.target.value) }))}
          placeholder="e.g. AB1234567"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={!!errors.srn}
          className="font-mono uppercase"
        />
        {errors.srn ? <span className="text-xs text-destructive">{errors.srn}</span> : null}
      </label>

      <label className="block space-y-1.5">
        <span className={LABEL}>Date of filing</span>
        <Input
          type="date"
          value={input.filedOn}
          min={client.incorporatedOn || undefined}
          max={isoDate(today())}
          onChange={(e) => setInput((v) => ({ ...v, filedOn: e.target.value }))}
          aria-invalid={!!errors.filedOn}
          className="tabular"
        />
        {errors.filedOn ? <span className="text-xs text-destructive">{errors.filedOn}</span> : null}
      </label>

      <AuditorYearsField value={years} onChange={setYears} />

      {filed ? (
        <p className="rounded-md bg-muted/40 px-3 py-2 text-xs leading-relaxed">
          {auditorTermSummary(withAdt1Appointment(client, input, years, existing?.fy ?? null))}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={busy}>
          <Save className="size-4" aria-hidden /> Save
        </Button>
      </DialogFooter>
    </form>
  );
}
