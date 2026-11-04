"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AUDITOR_TERM_YEARS } from "@/lib/resolve-due-dates";

/** The years a subsequent auditor is appointed for: 1 up to the Section 139(1) maximum. */
export function AuditorYearsField({ value, onChange }: { value: number; onChange: (years: number) => void }) {
  return (
    <div className="space-y-1.5">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        Appointed for
      </span>
      <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger className="w-full" aria-label="Years the auditor is appointed for">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: AUDITOR_TERM_YEARS }, (_, i) => i + 1).map((n) => (
            <SelectItem key={n} value={String(n)}>
              {n} year{n === 1 ? "" : "s"}
              {n === AUDITOR_TERM_YEARS ? " (maximum)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
