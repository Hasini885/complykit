import type { LucideIcon } from "lucide-react";

import { allNavItems } from "@/config/navigation";
import { cn } from "@/lib/utils";

/**
 * Pastel tile colours. Each nav item gets a fixed one by its position in the
 * navigation, so a tool keeps the same colour in the menu, the quick tools
 * strip and anywhere else its icon appears.
 */
export const TINTS = {
  violet: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
  sky: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
  pink: "bg-pink-100 text-pink-600 dark:bg-pink-500/15 dark:text-pink-300",
  amber: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  indigo: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
  orange: "bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300",
  teal: "bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300",
  rose: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
  cyan: "bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-300",
} as const;

export type Tint = keyof typeof TINTS;

const ORDER: Tint[] = ["violet", "sky", "pink", "amber", "emerald", "indigo", "orange", "teal", "rose", "cyan"];

export function tintFor(href: string): Tint {
  const i = allNavItems.findIndex((item) => item.href === href);
  return ORDER[(i < 0 ? 0 : i) % ORDER.length];
}

const SIZES = {
  sm: "size-8 rounded-xl [&_svg]:size-4",
  md: "size-10 rounded-2xl [&_svg]:size-[18px]",
  lg: "size-12 rounded-2xl [&_svg]:size-5",
};

export function IconTile({
  icon: Icon,
  tint = "violet",
  size = "md",
  className,
}: {
  icon: LucideIcon;
  tint?: Tint;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center", SIZES[size], TINTS[tint], className)}
    >
      <Icon />
    </span>
  );
}
