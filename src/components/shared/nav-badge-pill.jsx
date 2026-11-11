import { cn } from "@/lib/utils";

/**
 * The one pink pill style used for NEW and LIVE everywhere — the nav menus, page
 * headers, cards. Deliberately a single visual: the badge flags novelty, not
 * severity, so NEW and LIVE are never differentiated by colour.
 */
export function NavBadgePill({ badge, className }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-white",
        className,
      )}
    >
      {badge}
    </span>
  );
}
