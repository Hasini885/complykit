import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The CA Compliance Tool mark: a bold "C", open on the right, in blue satin:
 * the site background's slanted bands of light, brighter so the mark stands
 * out. Drawn as SVG so it is sharp at any size. The full logo files (mark and
 * name, for print and social media) are in /public/brand.
 */
export function LogoMark({ className, title }) {
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
        {/* Satin: slanted bands of light and deeper blue, as in the page background. */}
        <linearGradient id={`${id}-satin`} x1="0" y1="0.15" x2="1" y2="0.85">
          <stop offset="0%" stopColor="#94a3ce" />
          <stop offset="18%" stopColor="#dfe7ff" />
          <stop offset="34%" stopColor="#6c7fb1" />
          <stop offset="52%" stopColor="#becaec" />
          <stop offset="68%" stopColor="#4e6194" />
          <stop offset="84%" stopColor="#b0bde6" />
          <stop offset="100%" stopColor="#55689c" />
        </linearGradient>
        {/* A soft top sheen, like light catching silk. */}
        <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* A thick ring with its right side cut away: the C. */}
      <path d="M29.19 10.81 A13 13 0 1 0 29.19 29.19" fill="none" stroke={`url(#${id}-satin)`} strokeWidth="9" />
      <path d="M29.19 10.81 A13 13 0 1 0 29.19 29.19" fill="none" stroke={`url(#${id}-sheen)`} strokeWidth="9" />
    </svg>
  );
}

/** The name in the same blue satin, in spaced capitals. */
export function BrandWordmark({ name, className }) {
  return (
    <span
      className={cn(
        "brand-satin-text bg-clip-text font-heading font-bold tracking-[0.06em] whitespace-nowrap text-transparent uppercase",
        className,
      )}
    >
      {name}
    </span>
  );
}

/**
 * The full logo, stacked as in the artwork: the C, with "CA COMPLIANCE" right
 * below it and "TOOL" under that, all centred. "sm" fits the 64px top bar.
 */
export function BrandLockup({ size = "sm", className }) {
  const sm = size === "sm";
  return (
    <span className={cn("inline-flex flex-col items-center leading-none", className)} aria-label="CA Compliance Tool">
      <LogoMark className={sm ? "size-7" : "size-12"} />
      <span
        aria-hidden
        className={cn(
          "brand-satin-text bg-clip-text font-heading font-extrabold whitespace-nowrap text-transparent uppercase",
          sm ? "mt-0.5 text-[10px] tracking-[0.18em]" : "mt-1.5 text-base tracking-[0.2em]",
        )}
      >
        CA Compliance
      </span>
      <span
        aria-hidden
        className={cn(
          "brand-satin-text bg-clip-text font-heading font-extrabold whitespace-nowrap text-transparent uppercase",
          sm ? "mt-px text-[9px] tracking-[0.2em]" : "mt-1 text-sm tracking-[0.22em]",
        )}
      >
        Tool
      </span>
    </span>
  );
}
