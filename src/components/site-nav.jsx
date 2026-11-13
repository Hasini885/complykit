"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House } from "lucide-react";

import { LAW_UPDATED, TOOLS, toolFor } from "@/config/navigation";
import { site } from "@/config/site";
import { IconTile, tintFor } from "@/components/shared/icon-tile";
import { cn } from "@/lib/utils";

const LINK =
  "inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-medium xl:px-3.5 transition-colors focus-visible:outline-2 focus-visible:outline-ring";
const LINK_IDLE = "text-muted-foreground hover:bg-accent hover:text-accent-foreground";
const LINK_ACTIVE = "bg-primary/10 font-semibold text-primary";

/**
 * Desktop navigation in the top bar: only the items of the tool that is open
 * (MCA: Dashboard, Company Master Data, Director Master, Consultant Master).
 * Nothing on the main dashboard, which shows the tools as boxes.
 */
export function TopNav() {
  const pathname = usePathname();
  const tool = toolFor(pathname);
  if (!tool) return null;

  return (
    <nav aria-label={tool.title} className="flex items-center">
      {tool.items.map((item) => {
        const active = activeItem(tool, pathname) === item.href;
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
      })}
    </nav>
  );
}

/** The item of the open tool that matches the page: the longest href that fits. */
function activeItem(tool, pathname) {
  const fits = tool.items.filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));
  return fits.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
}

/** The side bar behind the menu button (top left): every tool, then the open tool's own items. */
export function MobileNav({ onNavigate }) {
  const pathname = usePathname();
  const tool = toolFor(pathname);
  const groups = [
    {
      label: "Tools",
      items: [{ title: "Dashboard", href: "/dashboard", icon: House }, ...TOOLS],
      current: tool ? tool.href : pathname === "/dashboard" ? "/dashboard" : null,
    },
    ...(tool && tool.items.length > 1 ? [{ label: tool.title, items: tool.items, current: activeItem(tool, pathname) }] : []),
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <nav aria-label="Sections" className="flex flex-col gap-6">
          {groups.map((group) => (
            <div key={group.label}>
              <h2 className="mb-2 px-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {group.label}
              </h2>
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active = group.current === item.href;
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
        <p className="mt-1.5 pl-4 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">{site.edition}</p>
      </div>
    </div>
  );
}

/** A nav item is active on its own route and every route nested under it. */
function isActive(pathname, href) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
