import { AlertTriangle, BellRing, Building2, CalendarDays, CheckCircle2, HeartPulse } from "lucide-react";

import { IconTile } from "@/components/shared/icon-tile";
import { cn } from "@/lib/utils";

/**
 * A static, illustrative miniature of the dashboard for the landing hero.
 * Decorative only: the companies and dates are placeholders, so the whole
 * thing is hidden from assistive tech and described in one sentence instead.
 */
const ROWS = [
  { code: "AOC-4", company: "Acme Foods Pvt. Ltd.", title: "Financial statements", pill: "4 days overdue", tone: "bad" },
  { code: "MGT-7", company: "Northwind Tech Ltd.", title: "Annual return", pill: "2 days left", tone: "warn" },
  { code: "DIR-3 KYC", company: "Bluebell Consulting LLP", title: "Director KYC", pill: "9 days left", tone: "warn" },
  { code: "DPT-3", company: "Harbour Infra Ltd.", title: "Return of deposits", pill: "Filed", tone: "good" },
] as const;

const PILL = {
  bad: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  warn: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  good: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
};

export function ProductPreview({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <p className="sr-only">
        Preview of the CA Compliance Tool dashboard: portfolio stats and a list of filings that are overdue or due soon.
      </p>
      <div aria-hidden className="relative">
        {/* Window */}
        <div className="rounded-[2rem] border border-white/70 bg-card/90 p-3 shadow-lift backdrop-blur dark:border-white/10">
          <div className="mb-3 flex items-center gap-1.5 px-2 pt-1">
            <span className="size-2.5 rounded-full bg-rose-300" />
            <span className="size-2.5 rounded-full bg-amber-300" />
            <span className="size-2.5 rounded-full bg-emerald-300" />
            <span className="ml-3 h-5 flex-1 rounded-full bg-muted" />
          </div>

          <div className="rounded-3xl bg-background p-4">
            <div className="grid grid-cols-3 gap-2.5">
              <MiniStat icon={Building2} tint="violet" label="Companies" value="12" />
              <MiniStat icon={HeartPulse} tint="emerald" label="Health" value="84%" valueClass="text-emerald-600 dark:text-emerald-400" />
              <MiniStat icon={AlertTriangle} tint="rose" label="Overdue" value="3" valueClass="text-rose-600 dark:text-rose-400" />
            </div>

            <div className="mt-3 rounded-2xl border bg-card p-3">
              <p className="mb-2 px-1 text-xs font-bold">Needs attention</p>
              <ul className="divide-y divide-border/70">
                {ROWS.map((r) => (
                  <li key={r.code} className="flex items-center gap-2.5 px-1 py-2">
                    <span className="w-[4.5rem] shrink-0">
                      <span className="inline-flex rounded-full bg-accent px-2 py-0.5 font-mono text-[10px] font-semibold text-accent-foreground">
                        {r.code}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{r.company}</span>
                      <span className="block truncate text-[10px] text-muted-foreground">{r.title}</span>
                    </span>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", PILL[r.tone])}>
                      {r.pill}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Floating notes */}
        <div className="absolute -top-9 -left-6 hidden items-center gap-2 rounded-2xl border bg-card px-3 py-2 shadow-lift sm:flex motion-safe:animate-[float_6s_ease-in-out_infinite]">
          <IconTile icon={BellRing} tint="pink" size="sm" />
          <span className="text-xs">
            <span className="block font-semibold">MGT-7 due Friday</span>
            <span className="block text-muted-foreground">Northwind Tech Ltd.</span>
          </span>
        </div>
        <div className="absolute -right-4 -bottom-6 hidden items-center gap-2 rounded-2xl border bg-card px-3 py-2 shadow-lift sm:flex motion-safe:animate-[float_7s_ease-in-out_1s_infinite]">
          <IconTile icon={CalendarDays} tint="sky" size="sm" />
          <span className="text-xs">
            <span className="block font-semibold">7 due this month</span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <CheckCircle2 className="size-3 text-emerald-500" /> 2 already filed
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  icon,
  tint,
  label,
  value,
  valueClass,
}: {
  icon: React.ComponentProps<typeof IconTile>["icon"];
  tint: React.ComponentProps<typeof IconTile>["tint"];
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-3">
      <IconTile icon={icon} tint={tint} size="sm" />
      <p className={cn("tabular mt-2 text-xl font-bold leading-none", valueClass)}>{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
