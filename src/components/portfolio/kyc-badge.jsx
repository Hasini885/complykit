import { cn } from "@/lib/utils";

const LABEL = {
  filed: "KYC filed",
  due: "KYC due",
  overdue: "KYC overdue",
  "not-yet-due": "Not yet due",
};

const TONE = {
  filed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  due: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  overdue: "bg-destructive/10 text-destructive",
  "not-yet-due": "bg-muted text-muted-foreground",
};

/**
 * DIR-3 KYC is triennial (Amendment Rules 2025, w.e.f. 31 Mar 2026), so a
 * director can be legitimately years away from their next filing. "Not yet
 * due" is a real, distinct state from "filed" — collapsing it into either
 * green or amber would misreport a director who has simply never had a cycle
 * fall due yet.
 */
export function KycBadge({ state }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", TONE[state])}>
      {LABEL[state]}
    </span>
  );
}
