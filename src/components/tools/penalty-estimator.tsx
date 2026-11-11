"use client";

import * as React from "react";
import { Scale } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatInr } from "@/lib/fees";
import {
  PENALTY_VIOLATIONS,
  S446B_CAP,
  estimatePenalty,
  resolvePenalty,
  type ComputedLiability,
} from "@/lib/penalties";

/**
 * Computes the penalty for a default from its section, the number of days it
 * has continued, and whether Section 446B relief applies. The wording shown
 * beside it is the same text as the Section Reference page.
 */
export function PenaltyEstimator() {
  const [violationId, setViolationId] = React.useState(PENALTY_VIOLATIONS[0].id);
  const [days, setDays] = React.useState("30");
  const [small, setSmall] = React.useState(false);
  const resolved = resolvePenalty(violationId);
  const dayCount = Math.max(0, Number(days.replace(/[^\d]/g, "")) || 0);
  const estimate = resolved ? estimatePenalty(resolved.violation.rule, dayCount, small) : null;
  const isFine = resolved?.violation.rule.type === "fine";
  const hasDaily =
    resolved?.violation.rule.type === "penalty"
      ? [resolved.violation.rule.company, resolved.violation.rule.officer].some((l) => l && l.perDay > 0)
      : resolved?.violation.rule.type === "fine" &&
        [resolved.violation.rule.company, resolved.violation.rule.officer].some((p) => p?.perDayMax);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-4 rounded-lg border bg-card p-4">
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Default</p>
          <Select value={violationId} onValueChange={setViolationId}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PENALTY_VIOLATIONS.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Days the default has continued
          </p>
          <Input
            inputMode="numeric"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="tabular"
            disabled={!hasDaily}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {hasDaily
              ? "Counted from the day after the due date until the default is made good."
              : "This penalty is a fixed amount; the length of the default does not change it."}
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-md border p-2.5">
          <input
            type="checkbox"
            checked={small}
            onChange={(e) => setSmall(e.target.checked)}
            className="mt-0.5 size-4 accent-primary"
          />
          <span>
            <span className="block text-sm font-medium">
              Small company, OPC, start-up or producer company
            </span>
            <span className="block text-xs text-muted-foreground">
              Section 446B: half the penalty, capped at {formatInr(S446B_CAP.company)} for the company and{" "}
              {formatInr(S446B_CAP.officer)} for each officer. Applies to penalties, not to fines.
            </span>
          </span>
        </label>
      </div>

      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          <Scale className="size-3.5" aria-hidden />
          {isFine ? "Fine on prosecution" : "Penalty (adjudicated by the Registrar)"}
        </div>

        {!resolved || !estimate ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Choose a default to see the penalty.</p>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="font-mono text-[11px]">
                Sec {resolved.violation.penaltySection ?? resolved.section.number}
              </Badge>
              {resolved.violation.formCode ? (
                <Badge variant="outline" className="font-mono text-[11px]">
                  {resolved.violation.formCode}
                </Badge>
              ) : null}
            </div>

            <dl className="mt-4 space-y-3 text-sm">
              {estimate.type === "penalty" ? (
                <>
                  <Amount label="On the company" value={estimate.company} />
                  <Amount label="On each officer in default" value={estimate.officer} />
                </>
              ) : (
                <>
                  <FineRange label="On the company" value={estimate.company} />
                  <FineRange label="On each officer in default" value={estimate.officer} />
                  {small ? (
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Section 446B does not reduce a fine set by a court, so it is not applied here.
                    </p>
                  ) : null}
                </>
              )}
            </dl>

            <div className="mt-4 border-t pt-3">
              <p className="text-sm font-medium leading-snug">{resolved.section.penalty!.summary}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{resolved.section.penalty!.detail}</p>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

function Amount({ label, value }: { label: string; value: ComputedLiability | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">
        {value === null ? (
          <span className="text-muted-foreground">None under this section</span>
        ) : (
          <>
            <span className="tabular font-mono text-lg font-semibold">{formatInr(value.payable)}</span>
            {value.payable !== value.full ? (
              <span className="ml-2 tabular font-mono text-xs text-muted-foreground line-through">
                {formatInr(value.full)}
              </span>
            ) : null}
            <span className="block text-xs text-muted-foreground">{value.workings}</span>
          </>
        )}
      </dd>
    </div>
  );
}

function FineRange({ label, value }: { label: string; value: { min: number; max: number } | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">
        {value === null ? (
          <span className="text-muted-foreground">None under this section</span>
        ) : (
          <span className="tabular font-mono text-lg font-semibold">
            {value.min > 0 ? `${formatInr(value.min)} – ` : "Up to "}
            {formatInr(value.max)}
          </span>
        )}
      </dd>
    </div>
  );
}
