"use client";

import { Building2, X } from "lucide-react";

import { usePortfolio } from "@/components/portfolio/portfolio-provider";

/**
 * Shown on list pages while one company is active: says the list is limited
 * to it, with a way back to every company.
 */
export function ScopeNote() {
  const { activeClient, setActiveClient } = usePortfolio();
  if (!activeClient) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-primary/25 bg-primary/5 px-3 py-2 text-sm">
      <Building2 className="size-4 shrink-0 text-primary" aria-hidden />
      <span>
        Showing only <span className="font-semibold">{activeClient.name}</span>
      </span>
      <button
        type="button"
        onClick={() => void setActiveClient(null)}
        className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10"
      >
        <X className="size-3.5" aria-hidden /> Show all companies
      </button>
    </div>
  );
}
