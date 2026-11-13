"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * A small month calendar with marked days, in the dashboard's transparent,
 * dashed style. `marks` maps "YYYY-MM-DD" to { tone, title } where tone is
 * "overdue" | "due" | "done"; marked days are buttons when `onDayClick` is given.
 */
export function MiniCalendar({ heading, year, month, marks = {}, today, active, onDayClick, onShift, note, legend }) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const p = (n) => String(n).padStart(2, "0");

  return (
    <div className="rounded-3xl border-2 border-dashed border-primary/25 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10.5px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">{heading}</p>
          <p className="mt-0.5 font-heading text-lg font-semibold">
            {MONTHS[month]} <span className="font-normal text-muted-foreground">{year}</span>
          </p>
          {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onShift(-1)}
            aria-label="Previous month"
            className="inline-flex size-7 items-center justify-center rounded-full border hover:bg-accent"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onShift(1)}
            aria-label="Next month"
            className="inline-flex size-7 items-center justify-center rounded-full border hover:bg-accent"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="py-0.5 text-[11px] text-muted-foreground">
            {d}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`e${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const iso = `${year}-${p(month + 1)}-${p(i + 1)}`;
          const mark = marks[iso];
          const cls = cn(
            "mx-auto flex size-8 items-center justify-center rounded-full",
            mark?.tone === "overdue" && "bg-destructive font-bold text-white",
            mark?.tone === "due" && "bg-primary font-bold text-primary-foreground",
            mark?.tone === "done" && "bg-emerald-600 font-bold text-white",
            iso === today && "ring-2 ring-primary ring-offset-1 ring-offset-background",
            iso === active && "outline-2 outline-offset-2 outline-foreground",
          );
          return mark && onDayClick ? (
            <button key={iso} type="button" title={mark.title} onClick={() => onDayClick(iso)} className={cls}>
              {i + 1}
            </button>
          ) : (
            <span key={iso} title={mark?.title} className={cls}>
              {i + 1}
            </span>
          );
        })}
      </div>
      {legend ? <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">{legend}</div> : null}
    </div>
  );
}

export function LegendDot({ className, children }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2.5 rounded-full", className)} aria-hidden />
      {children}
    </span>
  );
}
