import type { LucideIcon } from "lucide-react";

import type { NavBadge } from "@/config/navigation";
import { NavBadgePill } from "@/components/shared/nav-badge-pill";

export function PageHeader({
  icon: Icon,
  eyebrow,
  badge,
  title,
  lede,
  action,
}: {
  /** Small icon shown before the breadcrumb label. */
  icon?: LucideIcon;
  eyebrow?: string;
  /** NEW/LIVE pill next to the breadcrumb, matching the nav menus exactly. */
  badge?: NavBadge;
  title: string;
  lede?: string;
  /** Primary action button, right-aligned against the title row. */
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <div>
        {eyebrow ? (
          <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {Icon ? (
              <Icon className="size-3.5" aria-hidden />
            ) : null}
            {eyebrow}
            {badge ? <NavBadgePill badge={badge} /> : null}
          </p>
        ) : null}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-[2.75rem] sm:leading-[1.1]">{title}</h1>
            {lede ? (
              <p className="mt-3 max-w-[66ch] text-[0.9375rem] leading-relaxed text-muted-foreground sm:text-base">{lede}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}
