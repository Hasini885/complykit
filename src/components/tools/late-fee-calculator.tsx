"use client";

import * as React from "react";
import { Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { forms, type McaForm } from "@/data/forms";
import { relaxationFor, waivesFee } from "@/data/fee-relaxations";
import {
  ADDITIONAL_FEE_SLABS,
  FIRST_FORTNIGHT_SLAB,
  HIGHER_FEE_FORM_IDS,
  LLP_ADDITIONAL_FEE_SLABS,
  LLP_DAILY_BEYOND_360,
  LLP_NORMAL_FEE_BANDS,
  NORMAL_FEE_BANDS,
  PER_DAY_FEE,
  calculateLateFee,
  formatInr,
  llpNormalFeeBand,
  normalFeeBand,
} from "@/lib/fees";
import { daysBetween, formatDate, parseIsoDate } from "@/lib/dates";
import { financialYearEndYear } from "@/lib/portfolio/directors";

/** Only forms whose late fee this calculator actually models. */
const MODELLED = forms.filter(
  (f) => (f.lateFee.kind === "per-day" || f.lateFee.kind === "slab") && f.lateFee.calc !== "not-modelled",
);

const isLlp = (f: McaForm) => f.lateFee.calc === "llp";

export function LateFeeCalculator() {
  const [formId, setFormId] = React.useState(
    MODELLED.find((f) => f.code === "AOC-4")?.id ?? MODELLED[0].id,
  );
  const [capital, setCapital] = React.useState("1000000");
  const [dueDate, setDueDate] = React.useState("");
  const [filedDate, setFiledDate] = React.useState("");
  const [repeatDelay, setRepeatDelay] = React.useState(false);
  const [smallLlp, setSmallLlp] = React.useState(true);

  const form = MODELLED.find((f) => f.id === formId)!;
  const llp = isLlp(form);
  const higherPossible = (HIGHER_FEE_FORM_IDS as readonly string[]).includes(form.id);
  const amount = Number(capital.replace(/[^\d]/g, "")) || 0;
  const band = llp ? llpNormalFeeBand(amount) : normalFeeBand(amount);

  const due = parseIsoDate(dueDate);
  const filed = parseIsoDate(filedDate);
  const bothDates = due !== null && filed !== null;
  const delayDays = bothDates ? Math.max(0, daysBetween(due, filed)) : null;

  // A filing season's due dates fall in the financial year after the one being
  // reported on, so the season a due date belongs to is the year before.
  const relaxation = due ? relaxationFor(form.id, financialYearEndYear(due) - 1) : null;
  const waived = relaxation && filed ? waivesFee(relaxation, filed) : false;

  const result =
    delayDays === null
      ? null
      : calculateLateFee({
          kind: llp ? "llp" : form.lateFee.kind === "per-day" ? "per-day" : "slab",
          normalFee: band.fee,
          delayDays,
          schedule: form.lateFee.calc === "s139-s157" ? "s139-s157" : "general",
          higher: higherPossible && repeatDelay,
          smallLlp,
          waivedBy: waived ? `${relaxation!.summary} (${relaxation!.circular}).` : null,
        });

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* Inputs */}
      <div className="space-y-4">
        <Field label="Form">
          <Select
            value={formId}
            onValueChange={(v) => {
              setFormId(v);
              setRepeatDelay(false);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODELLED.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.code} — {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Hint>{form.lateFee.summary}.</Hint>
        </Field>

        <Field label={llp ? "Total contribution of the LLP (₹)" : "Nominal share capital (₹)"}>
          <Input inputMode="numeric" value={capital} onChange={(e) => setCapital(e.target.value)} className="tabular" />
          <Hint>
            {band.label} → normal fee {formatInr(band.fee)}
          </Hint>
        </Field>

        {llp ? (
          <Check
            checked={smallLlp}
            onChange={setSmallLlp}
            label="Small LLP"
            hint="Contribution up to ₹25 lakh and turnover up to ₹40 lakh. Pays half the multiples of other LLPs."
          />
        ) : null}
        {higherPossible ? (
          <Check
            checked={repeatDelay}
            onChange={setRepeatDelay}
            label={`A second or later late ${form.code} within 365 days`}
            hint="Charged at the higher additional fee (3× to 18×) instead of the usual multiples."
          />
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Due date">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="tabular" />
          </Field>
          <Field label="Date of filing">
            <Input type="date" value={filedDate} onChange={(e) => setFiledDate(e.target.value)} className="tabular" />
          </Field>
        </div>

        {relaxation ? (
          <p className="flex items-start gap-2 rounded-md border border-sky-500/30 bg-sky-500/10 p-2.5 text-xs text-sky-900 dark:text-sky-200">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              {relaxation.summary} — {relaxation.circular}. Filed after that, the additional fee runs from the
              original due date.
            </span>
          </p>
        ) : null}
      </div>

      {/* Result */}
      <div className="rounded-lg border bg-muted/30 p-4">
        {result === null ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Enter the due date and the date of filing to price the delay.
          </p>
        ) : (
          <dl className="space-y-3 text-sm">
            <Row label="Delay">
              <span className="tabular font-mono">{result.delayDays === 0 ? "None" : `${result.delayDays} days`}</span>
              {due && filed && result.delayDays > 0 ? (
                <span className="block text-xs text-muted-foreground">
                  {formatDate(due)} → {formatDate(filed)}
                </span>
              ) : null}
            </Row>
            <Row label="Normal fee">
              <span className="tabular font-mono">{formatInr(result.normalFee)}</span>
            </Row>
            <Row label="Additional fee">
              <span className="tabular font-mono">{formatInr(result.additionalFee)}</span>
              {result.multiple !== null ? (
                <Badge variant="secondary" className="ml-2 text-[10px]">
                  {result.multiple}×
                </Badge>
              ) : null}
            </Row>
            <div className="border-t pt-3">
              <Row label="Total payable" strong>
                <span className="tabular font-mono text-lg font-semibold">{formatInr(result.total)}</span>
              </Row>
            </div>
            <p className="border-t pt-3 text-xs text-muted-foreground">{result.basis}</p>
          </dl>
        )}
      </div>

      {/* Reference tables */}
      <div className="lg:col-span-2">
        <details className="rounded-lg border">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">The tables behind this</summary>
          <div className="grid gap-6 border-t p-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <TableTitle>Normal fee by nominal capital (companies)</TableTitle>
              <ul className="space-y-1 text-xs">
                {NORMAL_FEE_BANDS.map((b) => (
                  <li key={b.label} className="flex justify-between gap-4">
                    <span className="text-muted-foreground">{b.label}</span>
                    <span className="tabular font-mono">{formatInr(b.fee)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">A company without share capital pays {formatInr(200)}.</p>
            </div>
            <div>
              <TableTitle>Additional fee by delay (companies)</TableTitle>
              <ul className="space-y-1 text-xs">
                <li className="flex justify-between gap-4 text-muted-foreground">
                  <span />
                  <span className="font-mono">usual · repeat</span>
                </li>
                <li className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{FIRST_FORTNIGHT_SLAB.label}</span>
                  <span className="tabular font-mono">{FIRST_FORTNIGHT_SLAB.multiple}×</span>
                </li>
                {ADDITIONAL_FEE_SLABS.map((s) => (
                  <li key={s.label} className="flex justify-between gap-4">
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className="tabular font-mono">
                      {s.multiple}× · {s.higherMultiple}×
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                &ldquo;Repeat&rdquo; is the higher additional fee for a second late INC-22 or PAS-3 within 365 days.
                AOC-4 and MGT-7/7A instead carry {formatInr(PER_DAY_FEE)} per day with no cap; charge forms and
                SH-7 have their own schedules. Companies (Registration Offices and Fees) Amendment Rules, 2022.
              </p>
            </div>
            <div>
              <TableTitle>LLP Form 8 and Form 11</TableTitle>
              <ul className="space-y-1 text-xs">
                <li className="flex justify-between gap-4 text-muted-foreground">
                  <span />
                  <span className="font-mono">small · other</span>
                </li>
                {LLP_ADDITIONAL_FEE_SLABS.map((s) => (
                  <li key={s.label} className="flex justify-between gap-4">
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className="tabular font-mono">
                      {s.small}× · {s.other}×
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Beyond 360 days, plus {formatInr(LLP_DAILY_BEYOND_360.small)} (small) or{" "}
                {formatInr(LLP_DAILY_BEYOND_360.other)} (other) a day. Normal fee{" "}
                {formatInr(LLP_NORMAL_FEE_BANDS[0].fee)}–{formatInr(LLP_NORMAL_FEE_BANDS[LLP_NORMAL_FEE_BANDS.length - 1].fee)} by
                contribution. LLP (Second Amendment) Rules, 2022 — confirm before quoting.
              </p>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function Check({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-md border p-2.5">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 accent-primary" />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}

function TableTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{children}</p>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-xs text-muted-foreground">{children}</p>;
}

function Row({ label, children, strong }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={strong ? "font-medium" : "text-muted-foreground"}>{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
