import { AlertTriangle, Info } from "lucide-react";

import { cn } from "@/lib/utils";

export type BannerTone = "info" | "warn";

const TONE_CLASSES: Record<BannerTone, string> = {
  info: "border-sky-500/25 bg-sky-500/8 text-sky-950 dark:text-sky-100",
  warn: "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100",
};

const TONE_ICON_CLASSES: Record<BannerTone, string> = {
  info: "text-sky-600 dark:text-sky-400",
  warn: "text-amber-600 dark:text-amber-400",
};

/**
 * The light-blue "info" strip and the amber "warning" strip used throughout —
 * one component, one place to keep the two tones consistent.
 */
export function InfoBanner({
  tone = "info",
  children,
  className,
}: {
  tone?: BannerTone;
  children: React.ReactNode;
  className?: string;
}) {
  const Icon = tone === "warn" ? AlertTriangle : Info;
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm leading-relaxed",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", TONE_ICON_CLASSES[tone])} aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
