"use client";

import * as React from "react";
import { AlertTriangle, User } from "lucide-react";

import { Input } from "@/components/ui/input";
import { formatInr } from "@/lib/fees";
import { KYC_DUE_DAY, KYC_DUE_MONTH, KYC_LATE_FEE } from "@/lib/portfolio/directors";
import { formatDate, isoDate, makeDate, parseIsoDate, today } from "@/lib/dates";

/**
 * DIR-3 KYC is a flat, non-slab fee: nothing if filed on or before the cycle's
 * 30 June due date, a flat amount if filed after.
 *
 * The figure used here is ₹5,000, sourced from the same DIR-3 KYC research
 * already applied to the Director Master and Forms Library (the Companies
 * (Appointment and Qualification of Directors) Amendment Rules, 2025, w.e.f.
 * 31 March 2026). An earlier draft of this calculator's spec suggested ₹500 —
 * that figure is not what this project's own research turned up, so it has
 * been deliberately not used here. Recheck the current figure before launch.
 */
export function Dir3KycFeeCalculator() {
  const now = React.useMemo(() => today(), []);
  const defaultDue = React.useMemo(() => {
    const y =
      now.getMonth() < KYC_DUE_MONTH - 1 || (now.getMonth() === KYC_DUE_MONTH - 1 && now.getDate() <= KYC_DUE_DAY)
        ? now.getFullYear()
        : now.getFullYear() + 1;
    return makeDate(y, KYC_DUE_MONTH, KYC_DUE_DAY);
  }, [now]);

  const [dueOn, setDueOn] = React.useState(isoDate(defaultDue));
  const [filedOn, setFiledOn] = React.useState("");

  const due = parseIsoDate(dueOn);
  const filed = filedOn ? parseIsoDate(filedOn) : null;
  const late = due !== null && filed !== null && filed.getTime() > due.getTime();

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-4 text-sm font-semibold">Filing</h3>
        <div className="space-y-4">
          <Field label="Cycle due date">
            <Input type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} className="tabular" />
            <p className="mt-1 text-xs text-muted-foreground">
              Defaults to the next 30 June — DIR-3 KYC is triennial (once every three financial years), so the actual
              cycle due date depends on when the DIN was allotted. Adjust if you know the director&apos;s specific
              cycle.
            </p>
          </Field>
          <Field label="Date filed">
            <Input type="date" value={filedOn} onChange={(e) => setFiledOn(e.target.value)} className="tabular" />
          </Field>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          <User className="size-3.5" aria-hidden />
          DIR-3 KYC fee
        </div>

        {!filed ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Enter the date filed to see whether a late fee applies.
          </p>
        ) : (
          <>
            <p className="tabular mt-2 font-mono text-4xl font-bold">{late ? formatInr(KYC_LATE_FEE) : formatInr(0)}</p>
            <p className="mt-2 text-sm">
              {late ? (
                <>
                  Filed after the {due ? formatDate(due) : "cycle"} due date — the DIN is deactivated and this flat fee
                  applies to reactivate it.
                </>
              ) : (
                "Filed on or before the due date — no fee."
              )}
            </p>
          </>
        )}

        <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" aria-hidden />
          <p>
            Shown as {formatInr(KYC_LATE_FEE)} — confirm this against the current MCA fee circular before quoting it. A
            different figure (₹500) appears in some older or unofficial summaries; this project&apos;s own research
            points to {formatInr(KYC_LATE_FEE)}.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
