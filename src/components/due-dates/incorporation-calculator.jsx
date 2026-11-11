"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { daysBetween, formatDate, hasLongFirstFinancialYear, incorporationTimeline, parseIsoDate } from "@/lib/dates";
import { forms } from "@/data/forms";

const formIdByCode = new Map(forms.map((f) => [f.code, f.id]));

export function IncorporationCalculator() {
  const [value, setValue] = React.useState("");

  const incorporation = parseIsoDate(value);
  const invalid = value.trim() !== "" && incorporation === null;
  const timeline = incorporation ? incorporationTimeline(incorporation) : [];

  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b p-4">
        <label
          htmlFor="incorporation-date"
          className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground"
        >
          Date of incorporation
        </label>
        <Input
          id="incorporation-date"
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={invalid}
          aria-describedby="incorporation-help"
          className="tabular max-w-xs"
        />
        <p id="incorporation-help" className="mt-2 text-xs text-muted-foreground">
          {invalid
            ? "That is not a valid date."
            : "Everything a newly incorporated company owes, counted from this one date."}
        </p>
      </div>

      {incorporation ? (
        <div className="p-4">
          {hasLongFirstFinancialYear(incorporation) ? (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" aria-hidden />
              <p>
                <span className="font-semibold">Long first financial year.</span> Incorporated between 1 January and 31
                March, so Section 2(41) runs the first financial year on to 31 March of the following year — up to
                fifteen months, not twelve. Every filing deadline below shifts with it.
              </p>
            </div>
          ) : null}

          <ol className="relative space-y-0 border-l pl-6">
            {timeline.map((item) => {
              const formId = item.formCode ? formIdByCode.get(item.formCode) : undefined;
              const dayCount = daysBetween(incorporation, item.due);
              return (
                <li key={item.id} className="relative pb-5 last:pb-0">
                  <span
                    aria-hidden
                    className="absolute -left-[1.72rem] top-1.5 size-2.5 rounded-full border-2 border-background bg-primary"
                  />
                  <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <span className="tabular font-mono text-sm font-semibold">{formatDate(item.due)}</span>
                    <span className="tabular font-mono text-[11px] text-muted-foreground">day {dayCount}</span>
                    {item.assumed ? (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        assumed AGM
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 font-medium">{item.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-primary">{item.section}</span>
                    {item.formCode ? (
                      formId ? (
                        <Link
                          href={`/forms?form=${formId}`}
                          className="rounded border px-1.5 py-0.5 font-mono text-[11px] transition-colors hover:border-primary hover:text-primary"
                        >
                          {item.formCode}
                        </Link>
                      ) : (
                        <Badge variant="outline" className="font-mono text-[11px]">
                          {item.formCode}
                        </Badge>
                      )
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
                </li>
              );
            })}
          </ol>
        </div>
      ) : (
        <div className="p-8 text-center text-sm text-muted-foreground">
          Enter a date of incorporation to generate the timeline.
        </div>
      )}
    </div>
  );
}
