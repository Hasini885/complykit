"use client";

import * as React from "react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * A hover/focus label for an icon-only button. The toolbar buttons show only
 * their icon, so this is where their words went: give the button the same
 * text as `aria-label` too, so screen readers hear it.
 *
 * Carries its own provider, so it works anywhere without app-level setup.
 */
export function Tip({
  label,
  side = "top",
  children,
}: {
  label: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  children: React.ReactElement;
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side}>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
