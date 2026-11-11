"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

import { LAW_UPDATED, NAV_SECTIONS, type NavItem } from "@/config/navigation";
import { site } from "@/config/site";
import { NavBadgePill } from "@/components/shared/nav-badge-pill";
import { IconTile, tintFor } from "@/components/shared/icon-tile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Sections with more items than this collapse into a dropdown in the top bar;
 * smaller ones sit inline as plain links.
 */
const INLINE_LIMIT = 3;

const LINK =
  "inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-medium xl:px-3.5 transition-colors focus-visible:outline-2 focus-visible:outline-ring";
const LINK_IDLE = "text-muted-foreground hover:bg-accent hover:text-accent-foreground";
const LINK_ACTIVE = "bg-primary/10 font-semibold text-primary";

/** Desktop navigation, rendered inside the top bar from 2xl up. */
export function TopNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Sections" className="flex items-center">
      {NAV_SECTIONS.map((section) =>
        section.items.length > INLINE_LIMIT ? (
          <SectionMenu key={section.label} label={section.label} items={section.items} pathname={pathname} />
        ) : (
          section.items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(LINK, active ? LINK_ACTIVE : LINK_IDLE)}
              >
                {item.title}
              </Link>
            );
          })
        ),
      )}
    </nav>
  );
}

function SectionMenu({ label, items, pathname }: { label: string; items: NavItem[]; pathname: string }) {
  const active = items.some((item) => isActive(pathname, item.href));

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger className={cn(LINK, "group", active ? LINK_ACTIVE : LINK_IDLE)}>
        {label}
        <ChevronDown
          className="size-3.5 transition-transform group-data-[state=open]:rotate-180"
          aria-hidden
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={10}
        className="w-[min(40rem,calc(100vw-2rem))] rounded-3xl p-2.5 shadow-lift"
      >
        <div className="grid grid-cols-2 gap-1">
          {items.map((item) => {
            const Icon = item.icon;
            const current = isActive(pathname, item.href);
            return (
              <DropdownMenuItem key={item.href} asChild className="items-start gap-3 rounded-2xl p-3">
                <Link href={item.href} aria-current={current ? "page" : undefined}>
                  <IconTile
                    icon={Icon}
                    tint={tintFor(item.href)}
                    className={current ? "ring-2 ring-primary/40" : undefined}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      {item.title}
                      {item.badge ? <NavBadgePill badge={item.badge} /> : null}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">
                      {item.description}
                    </span>
                  </span>
                </Link>
              </DropdownMenuItem>
            );
          })}
        </div>
        <p className="mt-2 flex items-center gap-2 border-t px-3 pt-2.5 pb-1 text-[11px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
          Law updated: {LAW_UPDATED}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Full section list for the mobile slide-over. */
export function MobileNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <nav aria-label="Sections" className="flex flex-col gap-6">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <h2 className="mb-2 px-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {section.label}
              </h2>
              <ul className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-2xl px-2.5 py-2 text-sm transition-colors",
                          active
                            ? "bg-accent font-semibold text-accent-foreground"
                            : "font-medium text-foreground/80 hover:bg-accent/60 hover:text-accent-foreground",
                        )}
                      >
                        <IconTile icon={Icon} tint={tintFor(item.href)} size="sm" />
                        <span className="min-w-0 flex-1 truncate">{item.title}</span>
                        {item.badge ? <NavBadgePill badge={item.badge} /> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="shrink-0 border-t px-4 py-3.5">
        <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="size-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
          Law updated: {LAW_UPDATED}
        </p>
        <p className="mt-1.5 pl-4 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
          {site.edition}
        </p>
      </div>
    </div>
  );
}

/** A nav item is active on its own route and every route nested under it. */
function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
