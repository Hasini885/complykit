import Link from "next/link";
import { BrandLockup } from "@/components/brand-logo";
import { ArrowRight } from "lucide-react";

import { site } from "@/config/site";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { AccountButton } from "@/components/account-button";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#privacy", label: "Privacy" },
  { href: "#faq", label: "FAQ" },
];

/** Floating pill bar for the marketing page: anchors on the left, the app on the right. */
export function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-4">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 rounded-full border border-white/60 bg-card/75 pr-2 pl-3 shadow-card backdrop-blur-xl sm:pl-4 dark:border-white/10">
        <Link href="/" className="flex shrink-0 items-center" aria-label={site.name}>
          <BrandLockup />
        </Link>

        <nav aria-label="Page sections" className="ml-4 hidden items-center md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="inline-flex h-10 items-center rounded-full px-3.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <ModeToggle />
          <AccountButton />
          <Button asChild>
            <Link href="/dashboard">
              Open the app <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
