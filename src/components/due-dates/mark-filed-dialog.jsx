"use client";

import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { digitsOnly, srnInput } from "@/lib/input-filters";
import { usePortfolio } from "@/components/portfolio/portfolio-provider";
import { AuditorYearsField } from "@/components/dashboard/auditor-years-field";
import { financialYearLabel, formatDate, isoDate, today } from "@/lib/dates";
import { appointmentCovering } from "@/lib/portfolio/auditor";
import { auditorTermOf } from "@/lib/portfolio/schedule";
import { ACK_LENGTH, kycDirectorId, referenceKind, validateFiling } from "@/lib/portfolio/filings";
import { normaliseSrn } from "@/lib/portfolio/srn";
/**
 * Records a deadline as met: the date it was filed and the SRN MCA issued.
 * Rows with an e-form require an SRN; rows with none (holding the AGM, the
 * first Board meeting) take the date only.
 */
export function MarkFiledDialog({ clientId, item, onOpenChange }) {
  return (
    <Dialog open={item !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {item ? (
          <MarkFiledBody
            key={`${item.source.id}-${item.fyEndingYear}`}
            clientId={clientId}
            item={item}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function MarkFiledBody({ clientId, item, onDone }) {
  const { clients, markFiled, setAuditorTerm, unmarkFiled } = usePortfolio();
  // ADT-1 for a subsequent auditor: this filing starts the term, so ask how long it runs.
  const company = item.source.id === "adt-1" ? clients.find((c) => c.id === clientId) : undefined;
  const [years, setYears] = React.useState(() =>
    company ? (appointmentCovering(company, item.fyEndingYear)?.years ?? auditorTermOf(company)) : 0,
  );
  const hasForm = item.source.formCode !== null;
  const ack = referenceKind(item.source.id) === "ack";
  const [input, setInput] = React.useState({
    filedOn: item.filedOn ? isoDate(item.filedOn) : isoDate(today()),
    srn: item.srn ?? "",
  });
  const [errors, setErrors] = React.useState({});
  const [busy, setBusy] = React.useState(false);

  async function save(e) {
    e.preventDefault();
    const found = validateFiling(input, { srnRequired: hasForm, kind: ack ? "ack" : "srn" });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      await markFiled(clientId, item, input);
      if (company) await setAuditorTerm(clientId, item.fyEndingYear, years);
      const srn = normaliseSrn(input.srn);
      toast.success(`${item.source.title} marked filed`, {
        description: srn ? `${ack ? "Acknowledgement no." : "SRN"} ${srn}` : undefined,
      });
      onDone();
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    setBusy(true);
    try {
      await unmarkFiled(clientId, item);
      toast.success(`${item.source.title} is no longer marked filed`);
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <DialogTitle className="font-heading text-lg">{item.filedOn ? "Edit filing" : "Mark as filed"}</DialogTitle>
        <DialogDescription className="mt-1 text-sm">
          {item.source.title}
          {item.source.formCode ? ` (${item.source.formCode})` : ""} {company ? "at the AGM for" : "for"}{" "}
          {financialYearLabel(item.fyEndingYear)}
          {item.qualifier ? `, ${item.qualifier}` : ""} — due {formatDate(item.due)}.
          {kycDirectorId(item) ? " Recorded on the director, so it covers every board they sit on." : ""}
        </DialogDescription>
      </div>

      {/* ADT-1 for a subsequent auditor reads SRN, date of filing, years appointed. */}
      <div className={company ? "flex flex-col-reverse gap-4" : "space-y-4"}>
        <label className="block space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {company ? "Date of filing" : hasForm ? "Filed on" : "Done on"}
          </span>
          <Input
            type="date"
            value={input.filedOn}
            max={isoDate(today())}
            onChange={(e) => setInput((v) => ({ ...v, filedOn: e.target.value }))}
            aria-invalid={!!errors.filedOn}
            className="tabular"
          />
          {errors.filedOn ? <span className="text-xs text-destructive">{errors.filedOn}</span> : null}
        </label>

        <label className="block space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {ack ? "Acknowledgement number" : "SRN"}
            {hasForm ? "" : " (optional)"}
          </span>
          <Input
            value={input.srn}
            onChange={(e) =>
              setInput((v) => ({
                ...v,
                // An ITR acknowledgement is 15 digits; an SRN is capital letters and digits.
                srn: ack ? digitsOnly(e.target.value, ACK_LENGTH) : srnInput(e.target.value),
              }))
            }
            placeholder={ack ? `${ACK_LENGTH} digits, e.g. 123456789012345` : "e.g. AB1234567"}
            autoCapitalize="characters"
            inputMode={ack ? "numeric" : undefined}
            spellCheck={false}
            aria-invalid={!!errors.srn}
            className="font-mono uppercase"
          />
          {errors.srn ? <span className="text-xs text-destructive">{errors.srn}</span> : null}
        </label>
      </div>

      {company ? <AuditorYearsField value={years} onChange={setYears} /> : null}

      <DialogFooter className="gap-2 sm:justify-between">
        {item.filedOn ? (
          <Button type="button" variant="ghost" onClick={undo} disabled={busy}>
            <Undo2 className="size-4" aria-hidden /> Not filed
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={busy}>
          <CheckCircle2 className="size-4" aria-hidden /> Save
        </Button>
      </DialogFooter>
    </form>
  );
}
