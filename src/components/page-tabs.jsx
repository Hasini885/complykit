"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FileText, X } from "lucide-react";

import { allNavItems } from "@/config/navigation";
import { HOME_TAB, closeTab, normalizeTabs, openTab, tabTitle } from "@/lib/open-tabs";
import { cn } from "@/lib/utils";

/**
 * The tab bar under the top bar. Every page opened gets a tab; click a tab to
 * switch back to it, × (or a middle click) to close it. The list is kept per
 * browser tab (sessionStorage), so a reload keeps it and a new window starts
 * clean. List rules: src/lib/open-tabs.js.
 */
const STORE_KEY = "complykit.tabs.v1";

function loadTabs() {
  try {
    return normalizeTabs(JSON.parse(window.sessionStorage.getItem(STORE_KEY) ?? "[]"));
  } catch {
    return normalizeTabs([]);
  }
}

function saveTabs(tabs) {
  try {
    window.sessionStorage.setItem(STORE_KEY, JSON.stringify(tabs));
  } catch {
    // Storage blocked: the tabs last until the page is reloaded.
  }
}

function iconFor(path) {
  const item =
    allNavItems.find((i) => i.href === path) ??
    allNavItems
      .filter((i) => path.startsWith(`${i.href}/`))
      .sort((a, b) => b.href.length - a.href.length)[0];
  return item?.icon ?? FileText;
}

export function PageTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const [tabs, setTabs] = React.useState(() => (typeof window === "undefined" ? normalizeTabs([]) : loadTabs()));
  const activeRef = React.useRef(null);

  // Every page visited gets a tab (adjusted during render, so the new tab shows with the page).
  const shown = openTab(tabs, pathname);
  if (shown.length !== tabs.length || shown.some((p, i) => p !== tabs[i])) setTabs(shown);

  React.useEffect(() => saveTabs(tabs), [tabs]);

  // Keep the open tab in view when the bar scrolls sideways.
  React.useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);

  const close = (path) => {
    const { tabs: next, go } = closeTab(tabs, path, pathname);
    setTabs(next);
    if (go) router.push(go);
  };

  return (
    <nav aria-label="Open pages" className="border-t bg-muted/40 print:hidden">
      <ul className="flex w-full items-end gap-1 overflow-x-auto px-3 pt-1.5 [scrollbar-width:thin] sm:px-6">
        {tabs.map((path) => {
          const active = path === pathname;
          const Icon = iconFor(path);
          const title = tabTitle(path, allNavItems);
          return (
            <li
              key={path}
              ref={active ? activeRef : undefined}
              className={cn(
                "group flex max-w-56 shrink-0 items-center rounded-t-xl border border-b-0 text-[13px] transition-colors",
                active
                  ? "bg-card font-semibold text-foreground shadow-[0_-2px_0] shadow-primary"
                  : "border-transparent text-muted-foreground hover:bg-card/60 hover:text-foreground",
              )}
              onAuxClick={(e) => {
                if (e.button === 1 && path !== HOME_TAB) {
                  e.preventDefault();
                  close(path);
                }
              }}
            >
              <Link
                href={path}
                aria-current={active ? "page" : undefined}
                title={title}
                className={cn("flex min-w-0 items-center gap-1.5 py-1.5 pl-3", path === HOME_TAB ? "pr-3" : "pr-1")}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{title}</span>
              </Link>
              {path !== HOME_TAB ? (
                <button
                  type="button"
                  onClick={() => close(path)}
                  aria-label={`Close ${title}`}
                  className={cn(
                    "mr-1.5 grid size-5 shrink-0 place-items-center rounded-full hover:bg-muted",
                    active ? "opacity-100" : "opacity-60 group-hover:opacity-100",
                  )}
                >
                  <X className="size-3" aria-hidden />
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
