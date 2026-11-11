"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, Scale, Search } from "lucide-react";

import { site } from "@/config/site";
import { LAW_UPDATED } from "@/config/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ModeToggle } from "@/components/mode-toggle";
import { AccountButton } from "@/components/account-button";
import { AccountSyncStatus } from "@/components/sync/account-sync";
import { NotificationsBell } from "@/components/notifications-bell";
import { Tip } from "@/components/shared/tip";
import { CommandPalette, useCommandPalette } from "@/components/command-palette";
import { MobileNav, TopNav } from "@/components/site-nav";

/**
 * The top bar owns all navigation: inline links and section menus on desktop,
 * a slide-over below lg. A slim context bar under it carries the company
 * switcher, which scopes every page.
 */
export function SiteHeader() {
  const palette = useCommandPalette();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <>
      {/* A solid band behind the bar, so the page never shows through or around it while scrolling. */}
      <header className="sticky top-0 z-40 bg-background px-3 pt-3 pb-3 shadow-[0_8px_16px_-12px] shadow-foreground/10 sm:px-4 print:hidden">
        <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center gap-3 rounded-full 2xl:w-fit border border-white/60 bg-card pr-2 pl-3 shadow-card sm:pl-4 dark:border-white/10">
          <Button
            variant="ghost"
            size="icon"
            className="2xl:hidden"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" aria-hidden />
          </Button>

          <Brand />

          {/* The menu (about 900px) keeps its full width, inline from 2xl. */}
          <div className="ml-2 hidden shrink-0 2xl:block">
            <TopNav />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1 2xl:ml-4">
            <Tip label="Search companies, SRNs, DINs (Ctrl K)">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Search companies, SRNs, DINs and mobiles"
                aria-keyshortcuts="Control+K Meta+K"
                onClick={() => palette.setOpen(true)}
              >
                <Search className="size-4" aria-hidden />
              </Button>
            </Tip>
            <AccountSyncStatus />
            <NotificationsBell />
            <ModeToggle />
            <AccountButton withDataPage />
          </div>
        </div>

        <CommandPalette open={palette.open} onOpenChange={palette.setOpen} />
      </header>

      <div className="print:hidden">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 pt-4 sm:px-6 lg:px-8">
          <p className="ml-auto hidden items-center gap-2 rounded-full border bg-card/70 px-3.5 py-1.5 text-xs text-muted-foreground shadow-card backdrop-blur sm:flex">
            <span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px] shadow-emerald-500/20" aria-hidden />
            Law updated: {LAW_UPDATED}
            <span className="text-border" aria-hidden>
              |
            </span>
            <span>{site.edition}</span>
          </p>
        </div>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-80 rounded-r-3xl p-0">
          <SheetTitle className="sr-only">{site.name} navigation</SheetTitle>
          <div className="flex h-full flex-col">
            <div className="flex h-16 shrink-0 items-center border-b px-4">
              <Brand onNavigate={() => setMobileOpen(false)} />
            </div>
            <div className="min-h-0 flex-1">
              <MobileNav onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link href="/dashboard" onClick={onNavigate} className="flex shrink-0 items-center gap-2.5">
      <span
        aria-hidden
        className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 via-violet-500 to-pink-400 text-white shadow-md shadow-violet-500/30"
      >
        <Scale className="size-4" />
      </span>
      <BrandName />
    </Link>
  );
}

/**
 * The name on two lines ("CA Compliance" over "Tool"), so the top bar has the
 * room its menu, search box and tools need.
 */
function BrandName() {
  const words = site.name.split(" ");
  const last = words.pop();
  return (
    <span className="font-heading text-[15px] leading-[1.1] font-bold tracking-tight whitespace-nowrap">
      {words.length > 0 ? (
        <>
          {words.join(" ")}
          <br />
          {last}
        </>
      ) : (
        last
      )}
    </span>
  );
}
