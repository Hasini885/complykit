import type { LucideIcon } from "lucide-react";

import type { NavBadge } from "@/config/navigation";

/**
 * A page's title, and its main action on the right. The icon, eyebrow, badge and
 * lede props are still accepted from older pages but not shown: the site keeps
 * its text to what is needed.
 */
export function PageHeader({
  title,
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
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-[2.75rem] sm:leading-[1.1]">{title}</h1>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}
