import { CLIENT_STATUSES } from "@/lib/portfolio/types";
import { cn } from "@/lib/utils";

const TONE = {
  active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  dormant: "bg-muted text-muted-foreground",
  "strike-off": "bg-destructive/10 text-destructive",
  closed: "bg-muted text-muted-foreground line-through",
};

export function StatusPill({ status }) {
  const label = CLIENT_STATUSES.find((s) => s.value === status)?.label ?? status;
  return (
    <span className={cn("inline-flex items-center rounded-full px-1.5 py-px text-[10px] font-medium", TONE[status])}>
      {label}
    </span>
  );
}
