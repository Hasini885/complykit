"use client";

import { Search } from "lucide-react";

export function SiteSearchTrigger({
  onOpen,
  className = "",
}: {
  onOpen: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Search companies, SRNs, DINs and mobiles"
      aria-keyshortcuts="Control+K Meta+K"
      className={`group flex w-full items-center gap-2 h-10 rounded-full border border-input bg-muted/60 px-4 text-sm text-muted-foreground transition-all hover:border-primary/50 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring ${className}`}
    >
      <Search className="size-4 shrink-0" aria-hidden />
      <span className="truncate">Search companies, SRNs, DINs&hellip;</span>
      <kbd className="ml-auto hidden shrink-0 select-none items-center gap-0.5 rounded-full border bg-card px-2 py-0.5 font-mono text-[10px] font-medium sm:inline-flex">
        Ctrl K
      </kbd>
    </button>
  );
}
