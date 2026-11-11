"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { addDays, daysBetween, formatDate, parseIsoDate, relativeLabel, today, urgency } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** The counts the Act uses most, offered as one-tap presets. */
const PRESETS = [
  { days: 15, label: "15 days", example: "ADT-1, PAS-3" },
  { days: 30, label: "30 days", example: "AOC-4, MGT-14, DIR-12, CHG-1" },
  { days: 60, label: "60 days", example: "MGT-7, MR-1" },
  { days: 180, label: "180 days", example: "INC-20A" },
];

const TONE = {
  overdue: "text-destructive",
  "due-soon": "text-amber-700 dark:text-amber-400",
  upcoming: "text-muted-foreground",
};

export function DeadlineCalculator() {
  const [eventDate, setEventDate] = React.useState("");
  const [days, setDays] = React.useState("30");

  const event = parseIsoDate(eventDate);
  const dayCount = Number(days.replace(/[^\d]/g, ""));
  const valid = event !== null && Number.isFinite(dayCount) && dayCount >= 0;

  const reference = React.useMemo(() => today(), []);
  const due = valid ? addDays(event, dayCount) : null;
  const state = due ? urgency(due, reference) : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div>
          <label
            htmlFor="event-date"
            className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground"
          >
            Date of the event
          </label>
          <Input
            id="event-date"
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="tabular"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            The resolution, allotment, appointment or charge creation that starts the clock.
          </p>
        </div>

        <div>
          <label
            htmlFor="days-allowed"
            className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground"
          >
            Days allowed
          </label>
          <Input
            id="days-allowed"
            inputMode="numeric"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="tabular max-w-32"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <Button
                key={p.days}
                size="sm"
                variant={dayCount === p.days ? "secondary" : "outline"}
                onClick={() => setDays(String(p.days))}
                title={p.example}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/30 p-4">
        {due === null || event === null ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Enter the date of the event to get the last date.
          </p>
        ) : (
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Last date</p>
              <p className="tabular mt-1 font-mono text-2xl font-semibold">{formatDate(due)}</p>
              <p className={cn("tabular mt-0.5 font-mono text-xs", state && TONE[state])}>
                {relativeLabel(due, reference)}
              </p>
            </div>

            <div className="border-t pt-3 text-xs text-muted-foreground">
              <p>
                Counted from <span className="font-medium">{formatDate(event)}</span>, which is day zero. Day {dayCount}{" "}
                is {formatDate(due)}.
              </p>
              <p className="mt-1.5">
                {daysBetween(reference, due) < 0 ? (
                  <Badge variant="destructive" className="text-[10px]">
                    already past
                  </Badge>
                ) : null}
              </p>
              <p className="mt-1.5">
                A last date falling on a Sunday or a public holiday is not automatically extended — the portal may
                accept a filing the next working day, but do not rely on it.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
