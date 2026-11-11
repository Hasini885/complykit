"use client";

import { BrandLockup } from "@/components/brand-logo";
import * as React from "react";
import Link from "next/link";
import { Menu, Search } from "lucide-react";

import { site } from "@/config/site";
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
      {/* A straight, full-width bar with a line under it; solid, so the page never shows through while scrolling. */}
      <header className="sticky top-0 z-40 border-b bg-card shadow-[0_8px_16px_-12px] shadow-foreground/10 print:hidden">
        <div className="flex h-16 w-full items-center gap-3 px-3 sm:px-6">
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
    <Link href="/dashboard" onClick={onNavigate} className="flex shrink-0 items-center" aria-label={site.name}>
      <BrandLockup />
    </Link>
  );
}
