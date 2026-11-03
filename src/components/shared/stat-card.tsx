import type { LucideIcon } from "lucide-react";

import { IconTile, type Tint } from "@/components/shared/icon-tile";
import { cn } from "@/lib/utils";

export type StatTone = "neutral" | "good" | "warn" | "bad";

const TONE_TINT: Record<StatTone, Tint> = {
  neutral: "violet",
  good: "emerald",
  warn: "amber",
  bad: "rose",
};

const TONE_VALUE: Record<StatTone, string> = {
  neutral: "text-foreground",
  good: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  bad: "text-destructive",
};

/**
 * The one stat-card look reused across every dashboard-style page. Pass a
 * `tone` to colour the icon chip and the number when the metric is itself
 * good/bad news (overdue counts, health scores) — leave it `neutral` for a
 * plain count.
 */
export function StatCard({
  icon: Icon,
  value,
  label,
  caption,
  progress,
  tone = "neutral",
  className,
}: {
  icon: LucideIcon;
  value: React.ReactNode;
  label: string;
  /** One short line under the number, e.g. "Across 5 companies". */
  caption?: string;
  /** 0–100: draws a progress ring in place of the icon chip. */
  progress?: number;
  tone?: StatTone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 rounded-3xl border bg-card p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift sm:p-5",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p
          className={cn(
            "tabular mt-2 text-3xl font-bold leading-none tracking-tight sm:text-4xl",
            TONE_VALUE[tone],
          )}
        >
          {value}
        </p>
        {caption ? <p className="mt-2.5 truncate text-xs text-muted-foreground">{caption}</p> : null}
      </div>
      {progress === undefined ? (
        <IconTile icon={Icon} tint={TONE_TINT[tone]} className="hidden sm:inline-flex" />
      ) : (
        <ProgressRing value={progress} tone={tone} />
      )}
    </div>
  );
}

const RING_STROKE: Record<StatTone, string> = {
  neutral: "stroke-primary",
  good: "stroke-emerald-500",
  warn: "stroke-amber-500",
  bad: "stroke-destructive",
};

function ProgressRing({ value, tone }: { value: number; tone: StatTone }) {
  const r = 20;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <svg viewBox="0 0 48 48" className="size-10 shrink-0 -rotate-90 sm:size-14" aria-hidden>
      <circle cx="24" cy="24" r={r} fill="none" strokeWidth="6" className="stroke-muted" />
      <circle
        cx="24"
        cy="24"
        r={r}
        fill="none"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - clamped / 100)}
        className={cn("transition-[stroke-dashoffset] duration-700", RING_STROKE[tone])}
      />
    </svg>
  );
}

export function StatCardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">{children}</div>;
}
