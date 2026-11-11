"use client";

import { Search } from "lucide-react";

/**
 * The search box in the top bar. It is a flexible item: it takes the room the
 * menu leaves, up to 14rem, and gives it back as space runs out — first the
 * Ctrl K hint goes, then the placeholder, down to just the magnifier. So it
 * never runs under the menu, whatever the screen width.
 */
export function SiteSearchTrigger({
  onOpen,
  className = "",
}: {
  onOpen: () => void;
  className?: string;
}) {
  return (
    <div className={`@container min-w-10 flex-1 ${className}`}>
      <button
        type="button"
        onClick={onOpen}
        aria-label="Search companies, SRNs, DINs and mobiles"
        aria-keyshortcuts="Control+K Meta+K"
        className="group flex h-10 w-full items-center justify-center gap-2 overflow-hidden rounded-full border border-input bg-muted/60 text-sm text-muted-foreground transition-all hover:border-primary/50 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring @[7rem]:justify-start @[7rem]:px-4"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="hidden truncate @[7rem]:block">Search companies, SRNs, DINs&hellip;</span>
        <kbd className="ml-auto hidden shrink-0 select-none items-center gap-0.5 rounded-full border bg-card px-2 py-0.5 font-mono text-[10px] font-medium @[13rem]:inline-flex">
          Ctrl K
        </kbd>
      </button>
    </div>
  );
}
