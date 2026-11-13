"use client";

import * as React from "react";
import { Info, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { financialYearLabel, formatDate, isoDate, parseIsoDate, today } from "@/lib/dates";
import { formatInr } from "@/lib/fees";
import { financialYearEndYear } from "@/lib/portfolio/directors";
import {
  CALC_COMPANY_TYPES,
  CALC_FORMS,
  annualReturnCode,
  calcForm,
  calculateFromDates,
  compareAll,
  eventFor,
  itrLateFee,
  mcaLateFee,
  notesFor,
} from "@/lib/late-fee-calculator";

/**
 * Late fee calculator laid out like the usual ROC fee calculators: the six
 * filings on the MCA dashboard as quick picks, every other event-based ROC
 * form in a list, then the company, the capital and either the dates (the due
 * date is worked out) or just the days late. The result card shows the total
 * payable with its breakdown, and the compare table prices every form for the
 * same delay.
 */

const CURRENT_FY = financialYearEndYear(today()) - 1;
const FY_CHOICES = Array.from({ length: 6 }, (_, i) => CURRENT_FY + 1 - i);
const QUICK_FORMS = CALC_FORMS.filter((f) => f.group === "dashboard");
const OTHER_FORMS = CALC_FORMS.filter((f) => f.group !== "dashboard");
const digits = (v) => Number(String(v).replace(/[^\d]/g, "")) || 0;

export function McaLateFeeCalculator() {
  const [formId, setFormId] = React.useState("aoc-4");
  const [companyType, setCompanyType] = React.useState("private");
  const [capital, setCapital] = React.useState("100000");
  const [mode, setMode] = React.useState("dates");
  const [eventDate, setEventDate] = React.useState("");
  const [fy, setFy] = React.useState(String(CURRENT_FY));
  const [filedDate, setFiledDate] = React.useState(isoDate(today()));
  const [daysLate, setDaysLate] = React.useState("0");
  const [transferPricing, setTransferPricing] = React.useState(false);
  const [smallIncome, setSmallIncome] = React.useState(false);
  const [taxUnpaid, setTaxUnpaid] = React.useState("");
  const [secured, setSecured] = React.useState("");

  const form = calcForm(formId);
  const itr = formId === "itr";
  const event = eventFor(formId, companyType);
  const charge = form.fee === "chg";
  const noCapital = form.fee === "kyc" || form.fee === "none";
  const amount = digits(capital);
  const tax = digits(taxUnpaid);
  const amountSecured = digits(secured);
  const codeOf = (f) => (f.id === "mgt-7" ? annualReturnCode(companyType) : f.code);

  const result = React.useMemo(() => {
    if (mode === "dates") {
      return calculateFromDates({
        formId,
        companyType,
        capital: amount,
        eventDate: parseIsoDate(eventDate),
        fyEndingYear: Number(fy),
        filedDate: parseIsoDate(filedDate),
        transferPricing,
        smallIncome,
        taxUnpaid: tax,
        amountSecured,
      });
    }
    const days = Math.max(0, Number(daysLate.replace(/[^\d]/g, "")) || 0);
    return itr
      ? itrLateFee({ delayDays: days, smallIncome, taxUnpaid: tax })
      : { ...mcaLateFee({ formId, companyType, capital: amount, delayDays: days, amountSecured }), interest: 0 };
  }, [
    mode,
    formId,
    companyType,
    amount,
    eventDate,
    fy,
    filedDate,
    transferPricing,
    smallIncome,
    tax,
    daysLate,
    itr,
    amountSecured,
  ]);

  const delay = result?.delayDays ?? 0;
  const compare = compareAll({
    capital: amount,
    delayDays: delay,
    companyType,
    amountSecured,
    smallIncome,
    taxUnpaid: tax,
  });
  const notes = notesFor(formId, companyType, delay);
  const companyLabel = CALC_COMPANY_TYPES.find((t) => t.value === companyType)?.label;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Inputs */}
        <section className="space-y-5 rounded-3xl border bg-card p-5 shadow-card sm:p-6 print:hidden">
          <Field label="Form">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {QUICK_FORMS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFormId(f.id)}
                  aria-pressed={f.id === formId}
                  className={cn(
                    "rounded-2xl border px-3 py-2.5 text-left transition-colors",
                    f.id === formId ? "border-primary bg-primary/10 ring-1 ring-primary" : "hover:bg-muted/60",
                  )}
                >
                  <span className="block text-sm font-bold">{codeOf(f)}</span>
                  <span className="block truncate text-xs text-muted-foreground">{f.name}</span>
                </button>
              ))}
            </div>
            <Select value={form.group === "dashboard" ? "" : formId} onValueChange={setFormId}>
              <SelectTrigger
                className={cn("mt-2 w-full", form.group !== "dashboard" && "border-primary ring-1 ring-primary")}
              >
                <SelectValue placeholder="Other ROC forms…" />
              </SelectTrigger>
              <SelectContent>
                {OTHER_FORMS.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    <span className="font-semibold">{f.code}</span>
                    <span className="text-muted-foreground">{f.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Hint>Due: {form.dueRule}.</Hint>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company type">
              <Select value={companyType} onValueChange={setCompanyType}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CALC_COMPANY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {itr ? (
              <Field label="Tax unpaid on the due date (₹)">
                <Input
                  inputMode="numeric"
                  value={taxUnpaid}
                  placeholder="0"
                  onChange={(e) => setTaxUnpaid(e.target.value)}
                  className="tabular"
                />
              </Field>
            ) : noCapital ? null : (
              <Field label="Authorised (nominal) capital (₹)">
                <Input
                  inputMode="numeric"
                  value={capital}
                  onChange={(e) => setCapital(e.target.value)}
                  className="tabular"
                />
                <Hint>{amount > 0 ? `₹${amount.toLocaleString("en-IN")}` : "No share capital: ₹200 normal fee"}</Hint>
              </Field>
            )}
          </div>

          {charge ? (
            <Field label="Amount secured by the charge (₹)">
              <Input
                inputMode="numeric"
                value={secured}
                placeholder="0"
                onChange={(e) => setSecured(e.target.value)}
                className="tabular"
              />
              <Hint>
                {amountSecured > 0
                  ? `₹${amountSecured.toLocaleString("en-IN")} · used for the ad valorem fee`
                  : "Used for the ad valorem fee when filed late."}
              </Hint>
            </Field>
          ) : null}

          {itr ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <Check
                checked={transferPricing}
                onChange={setTransferPricing}
                label="Transfer-pricing report (3CEB)"
                hint="Due 30 November instead of 31 October."
              />
              <Check
                checked={smallIncome}
                onChange={setSmallIncome}
                label="Total income up to ₹5 lakh"
                hint="Section 234F fee is ₹1,000 instead of ₹5,000."
              />
            </div>
          ) : null}

          <Field label="Calculate by">
            <div className="inline-flex rounded-full border p-1">
              {[
                ["dates", "Dates"],
                ["days", "Days late"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  aria-pressed={mode === value}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                    mode === value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>

          {mode === "dates" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {event.event === "fy" ? (
                <Field label="Financial year">
                  <Select value={fy} onValueChange={setFy}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FY_CHOICES.map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          {financialYearLabel(y)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : (
                <Field label={event.label}>
                  <Input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="tabular"
                  />
                </Field>
              )}
              <Field label="Date of filing">
                <Input
                  type="date"
                  value={filedDate}
                  onChange={(e) => setFiledDate(e.target.value)}
                  className="tabular"
                />
              </Field>
            </div>
          ) : (
            <Field label="Delay in filing (days)">
              <Input
                inputMode="numeric"
                value={daysLate}
                onChange={(e) => setDaysLate(e.target.value)}
                className="tabular"
              />
              <Hint>Count from the statutory due date. Filed within an extension with no fee? Enter 0.</Hint>
            </Field>
          )}
        </section>

        {/* Result */}
        <section className="flex flex-col rounded-3xl border bg-card p-5 shadow-card sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Total payable
              </p>
              <p className="mt-1 font-heading text-4xl font-bold tabular">{result ? formatInr(result.total) : "—"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {codeOf(form)} · {companyLabel}
                {!itr && !noCapital ? ` · ₹${amount.toLocaleString("en-IN")} capital` : ""}
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => window.print()}
              aria-label="Print"
              className="print:hidden"
            >
              <Printer />
            </Button>
          </div>

          {result === null ? (
            <p className="mt-6 rounded-2xl bg-muted/40 py-10 text-center text-sm text-muted-foreground">
              Enter the {event.label.toLowerCase()} and the date of filing.
            </p>
          ) : (
            <dl className="mt-5 space-y-3 border-t pt-4 text-sm">
              {"statutoryDue" in result ? (
                <Row label="Due date">
                  {formatDate(result.due)}
                  {result.due.getTime() !== result.statutoryDue.getTime() ? (
                    <span className="block text-xs text-muted-foreground">
                      extended from {formatDate(result.statutoryDue)}
                    </span>
                  ) : null}
                </Row>
              ) : null}
              <Row label="Filing delay">{delay === 0 ? "0 days (on time)" : `${delay} days`}</Row>
              {itr ? (
                <>
                  <Row label="Late fee (s.234F)">{formatInr(result.additionalFee)}</Row>
                  <Row label="Interest (s.234A)">
                    {formatInr(result.interest)}
                    {result.months > 0 ? (
                      <span className="block text-xs text-muted-foreground">
                        1% × {result.months} month{result.months === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </Row>
                  {charge ? <Row label="Ad valorem fee">{formatInr(result.adValorem)}</Row> : null}
                </>
              ) : (
                <>
                  <Row label="Normal filing fee">{formatInr(result.normalFee)}</Row>
                  <Row label="Additional (late) fee">
                    {formatInr(result.additionalFee)}
                    {result.multiple ? (
                      <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        {result.multiple}×
                      </span>
                    ) : null}
                  </Row>
                </>
              )}
              <p
                className={cn(
                  "border-t pt-3 text-xs",
                  result.barred ? "font-medium text-destructive" : "text-muted-foreground",
                )}
              >
                {result.basis}
              </p>
            </dl>
          )}

          {result?.relaxation ? (
            <p className="mt-4 flex items-start gap-2 rounded-2xl border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-sky-900 dark:text-sky-200">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                {result.relaxation.summary} ({result.relaxation.circular}).
                {result.relaxation.extendsDueDate
                  ? ""
                  : " Filed after that, the additional fee runs from the original due date."}
              </span>
            </p>
          ) : null}

          {notes.length > 0 ? (
            <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
              {notes.map((n) => (
                <li key={n} className="flex gap-2">
                  <span aria-hidden>•</span>
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>

      {/* Compare */}
      <section className="rounded-3xl border bg-card p-5 shadow-card sm:p-6">
        <h2 className="font-heading text-lg font-bold">Quick compare</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Every form, {delay === 0 ? "filed on time" : `${delay} days late`}
          {` · ₹${amount.toLocaleString("en-IN")} capital`}
          {amountSecured > 0 ? ` · ₹${amountSecured.toLocaleString("en-IN")} secured` : ""}. Click a row to open it.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Form</TableHead>
              <TableHead className="text-right">Normal fee</TableHead>
              <TableHead className="text-right">Late fee</TableHead>
              <TableHead className="text-right">Ad valorem / interest</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {compare.map(({ form: f, result: r }) => (
              <TableRow
                key={f.id}
                onClick={() => setFormId(f.id)}
                className={cn("cursor-pointer", f.id === formId && "bg-primary/5")}
              >
                <TableCell>
                  <span className="font-semibold">{codeOf(f)}</span>
                  <span className="block text-xs text-muted-foreground">{f.name}</span>
                </TableCell>
                <TableCell className="text-right tabular">{formatInr(r.normalFee)}</TableCell>
                <TableCell className="text-right tabular">{formatInr(r.additionalFee)}</TableCell>
                <TableCell className="text-right tabular">
                  {r.interest || r.adValorem ? formatInr(r.interest || r.adValorem) : "—"}
                </TableCell>
                <TableCell className="text-right font-semibold tabular">
                  {r.barred ? <span className="text-destructive">CHG-8</span> : formatInr(r.total)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="mt-3 text-xs text-muted-foreground">
          AOC-4 and MGT-7/7A: ₹100 a day with no cap. Other ROC forms: 2× to 12× the normal fee by delay (ADT-1 1× for
          its first 15 days). CHG-1/CHG-9: a multiple plus ad valorem on the amount secured. DIR-3 KYC: ₹5,000 flat.
          ITR: Section 234F fee plus 234A interest. Stamp duty is not included, and SH-7 is not priced here (it has its
          own fee schedule on the increased capital). Estimates only: the MCA and income-tax portals compute the amount
          you pay.
        </p>
      </section>
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

function Hint({ children }) {
  return <p className="mt-1.5 text-xs text-muted-foreground">{children}</p>;
}

function Check({ checked, onChange, label, hint }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl border p-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 accent-primary"
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium tabular">{children}</dd>
    </div>
  );
}
