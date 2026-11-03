import { AlertTriangle } from "lucide-react";

import { legal } from "@/config/site";

/**
 * Shown until the seeded reference data has been checked by a qualified
 * professional. Flip `legal.dataUnverified` to false in src/config/site.ts
 * to remove it everywhere.
 */
export function UnverifiedDataBanner() {
  if (!legal.dataUnverified) return null;

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 print:hidden">
      <div className="mx-auto flex w-full max-w-7xl items-start gap-2 px-4 py-2 text-xs text-amber-900 dark:text-amber-200">
        <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
        <p>
          <span className="font-semibold">Pre-launch: seeded data is unverified.</span>{" "}
          Form particulars, thresholds and dates in this build are drafted from public sources and
          have not yet been checked by a practising professional. Verify before relying on them.
        </p>
      </div>
    </div>
  );
}
