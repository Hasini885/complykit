"use client";

import * as React from "react";
import { AlertTriangle, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { checkBoardMeetings } from "@/lib/board-meetings";
import { formatDate, parseIsoDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function BoardMeetingChecker() {
  const [raw, setRaw] = React.useState("");
  const [cadence, setCadence] = React.useState("standard");

  const lines = raw
    .split(/[\n,]/)
    .map((l) => l.trim())
    .filter(Boolean);
  const parsed = lines.map((l) => ({ raw: l, date: parseIsoDate(l) }));
  const valid = parsed.filter((p) => p.date !== null).map((p) => p.date);
  const invalid = parsed.filter((p) => p.date === null);

  const result = valid.length > 0 ? checkBoardMeetings(valid, cadence) : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Cadence</p>
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant={cadence === "standard" ? "default" : "outline"}
              onClick={() => setCadence("standard")}
            >
              Standard
            </Button>
            <Button
              size="sm"
              variant={cadence === "reduced" ? "default" : "outline"}
              onClick={() => setCadence("reduced")}
            >
              OPC / small / dormant
            </Button>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {cadence === "standard"
              ? "Four meetings a year, with no more than 120 days between two consecutive meetings."
              : "Two meetings a year, one in each half, with at least 90 days between them."}
          </p>
        </div>

        <div>
          <label
            htmlFor="meeting-dates"
            className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground"
          >
            Meeting dates
          </label>
          <Textarea
            id="meeting-dates"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={6}
            placeholder={"2025-05-14\n2025-08-08\n2025-11-27\n2026-02-19"}
            className="tabular font-mono text-sm"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">One date a line, as YYYY-MM-DD. Order does not matter.</p>
          {invalid.length > 0 ? (
            <p className="mt-1.5 text-xs text-destructive">
              Ignored {invalid.length} unreadable {invalid.length === 1 ? "line" : "lines"}:{" "}
              {invalid
                .slice(0, 3)
                .map((i) => JSON.stringify(i.raw))
                .join(", ")}
            </p>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border bg-muted/30 p-4">
        {result === null ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Enter the meeting dates to check them against Section 173.
          </p>
        ) : (
          <div className="space-y-4 text-sm">
            <div
              className={cn(
                "flex items-start gap-2 rounded-md border p-3",
                result.compliant ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5",
              )}
            >
              {result.compliant ? (
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              ) : (
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
              )}
              <div>
                <p className="font-medium">{result.compliant ? "Compliant on these dates" : "Not compliant"}</p>
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {result.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-muted-foreground">Meetings</dt>
                <dd className="tabular font-mono text-base">
                  {result.meetings.length} / {result.requiredCount}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{cadence === "standard" ? "Longest gap" : "Shortest gap"}</dt>
                <dd className="tabular font-mono text-base">
                  {cadence === "standard"
                    ? result.longestGap === null
                      ? "—"
                      : `${result.longestGap} days`
                    : result.shortestGap === null
                      ? "—"
                      : `${result.shortestGap} days`}
                </dd>
              </div>
            </dl>

            {result.gaps.length > 0 ? (
              <div className="border-t pt-3">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Gaps
                </p>
                <ul className="space-y-1 text-xs">
                  {result.gaps.map((g) => (
                    <li
                      key={`${g.from.getTime()}-${g.to.getTime()}`}
                      className={cn(
                        "tabular flex items-center justify-between gap-3 font-mono",
                        g.breach && "text-destructive",
                      )}
                    >
                      <span>
                        {formatDate(g.from)} → {formatDate(g.to)}
                      </span>
                      <span>
                        {g.days} days{g.breach ? " ✕" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
