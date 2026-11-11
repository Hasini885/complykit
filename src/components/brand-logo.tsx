import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The CA Compliance Tool mark: a bold "C" in a sky-to-blue gradient, open on
 * the right, as in the logo. Drawn as SVG so it is sharp at any size.
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  const id = React.useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 40 40"
      className={cn("size-10 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id={`${id}-c`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#bfe3ff" />
          <stop offset="55%" stopColor="#6cb6ff" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      {/* A thick ring with its right side cut away: the C. */}
      <path
        d="M29.19 10.81 A13 13 0 1 0 29.19 29.19"
        fill="none"
        stroke={`url(#${id}-c)`}
        strokeWidth="9"
        strokeLinecap="butt"
      />
    </svg>
  );
}

/** The name in the logo's gradient and spaced capitals. */
export function BrandWordmark({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "bg-gradient-to-r from-sky-500 via-sky-500 to-blue-600 bg-clip-text font-heading font-bold tracking-[0.06em] whitespace-nowrap text-transparent uppercase dark:from-sky-200 dark:via-sky-300 dark:to-blue-500",
        className,
      )}
    >
      {name}
    </span>
  );
}
