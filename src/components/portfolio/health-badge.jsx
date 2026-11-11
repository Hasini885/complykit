import { healthTone } from "@/lib/portfolio/health";
import { cn } from "@/lib/utils";

const DOT = {
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-destructive",
};

const TEXT = {
  good: "text-emerald-700 dark:text-emerald-400",
  warn: "text-amber-700 dark:text-amber-400",
  bad: "text-destructive",
};

export function HealthBadge({ health }) {
  const tone = healthTone(health);
  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={`Last 90 days and next 12 months, across financial years. Only DIR-3 KYC records a filing, so "on track" means not overdue.`}
    >
      <span className={cn("size-2 shrink-0 rounded-full", DOT[tone])} aria-hidden />
      <span className={cn("tabular font-mono text-sm font-medium", TEXT[tone])}>{health.score}%</span>
      <span className="tabular font-mono text-xs text-muted-foreground">
        {health.onTrack}/{health.total}
      </span>
    </span>
  );
}
