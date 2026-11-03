import Link from "next/link";

import { brand, legal, site, MCA_URL } from "@/config/site";

const AGENCY_SET = !brand.agency.startsWith("[");

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t bg-card/50 print:hidden">
      <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-10 sm:px-6 lg:px-8 text-xs leading-relaxed text-muted-foreground">
        <p className="max-w-[80ch]">
          <span className="font-semibold text-foreground">Disclaimer. </span>
          {legal.disclaimer}
        </p>
        <p className="max-w-[80ch]">
          {legal.sourceNote}{" "}
          <Link
            href={MCA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-foreground"
          >
            mca.gov.in
          </Link>
        </p>
        <div className="flex flex-col gap-1 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          {/* The page is prerendered at build time, so the year can differ from the
              visitor's; it is corrected in the browser without a hydration warning. */}
          <span suppressHydrationWarning>
            &copy; {new Date().getFullYear()} {site.name} &middot; {site.edition}
          </span>
          {/* Hidden until the placeholder in src/config/site.ts is replaced. */}
          {AGENCY_SET ? (
            <span>
              Built by{" "}
              <Link
                href={brand.agencyUrl}
                className="font-medium text-foreground underline underline-offset-4"
              >
                {brand.agency}
              </Link>
            </span>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
