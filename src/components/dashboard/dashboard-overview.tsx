"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarHeart,
  Plus,
  UserX,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AllDuesGrid } from "@/components/dashboard/all-dues-grid";
import { ClientFormDialog } from "@/components/portfolio/client-form-dialog";
import { usePortfolio } from "@/components/portfolio/portfolio-provider";
import { today } from "@/lib/dates";
import { buildPortfolioReport } from "@/lib/portfolio/report";
import { DEFAULT_WINDOW, selectableYears } from "@/lib/portfolio/schedule";
import { addDays, financialYearEnd, financialYearLabel, formatDate } from "@/lib/dates";
import { site } from "@/config/site";
import { GlassCalendar } from "@/components/dashboard/dashboard-parts";
import { ChallanUploadButton } from "@/components/portfolio/challan-upload";
import { MasterDataUpload } from "@/components/portfolio/master-data-upload";

/**
 * The dashboard follows the company switcher in the top bar:
 *  - "All companies" (nothing selected) is the admin view of the whole firm;
 *  - a selected company shows that company's own details.
 */
export function DashboardOverview() {
  const { ready, clients } = usePortfolio();

  if (!ready) {
    return <div className="h-48 animate-pulse rounded-lg border bg-muted/30" aria-hidden />;
  }

  if (clients.length === 0) {
    return (
      <div className="space-y-4">
      <MasterDataUpload />
      <section className="rounded-lg border border-dashed p-8 text-center">
        <Building2 className="mx-auto size-8 text-muted-foreground" aria-hidden />
        <h2 className="mt-3 font-heading text-xl font-semibold">No companies yet</h2>
        <p className="mx-auto mt-2 max-w-[52ch] text-sm text-muted-foreground">
          Add your clients to see what is overdue and what falls due across all of them, worked
          out from each company&apos;s own dates.
        </p>
        <Button asChild className="mt-5">
          <Link href="/portfolio">
            <Plus className="size-4" aria-hidden /> Add your first company
          </Link>
        </Button>
      </section>
      </div>
    );
  }

  return <AdminDashboard />;
}

/**
 * The firm view: the all-dues sheet for every client, the compliance
 * calendar, and which directors have missed a KYC. Built on the same report
 * data as the printable MIS, so the two always agree.
 */
function AdminDashboard() {
  const { clients, directors } = usePortfolio();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const editing = clients.find((c) => c.id === editingId) ?? null;
  const reference = React.useMemo(() => today(), []);
  const years = React.useMemo(() => selectableYears(null, reference), [reference]);
  const [fy, setFy] = useDashboardYear(years);
  const report = React.useMemo(
    () => buildPortfolioReport(clients, directors, { asOf: reference, fyEndingYear: fy }),
    [clients, directors, reference, fy],
  );

  const allItems = report.sections.flatMap((s) => s.items);

  /** Opens that company's details. */
  function selectCompany(clientId: string) {
    setEditingId(clientId);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <MasterDataUpload />
        <ChallanUploadButton variant="hero" />
      </div>

      {/* The full sheet of dues leads the firm view: it is what the desk works from.
          Its year picker sets the year for the whole dashboard. The calendar sits
          beside it on wide screens and drops below it on narrow ones, so the
          matrix keeps its width. */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_16rem] xl:items-start">
        <div className="min-w-0 space-y-8">
          <AllDuesGrid
            section="post-incorporation"
            clients={clients}
            directors={directors}
            reference={reference}
            onOpenClient={selectCompany}
            fy={null}
          />
          <AllDuesGrid
            section="annual"
            clients={clients}
            directors={directors}
            reference={reference}
            onOpenClient={selectCompany}
            fy={fy}
            yearControl={<YearPicker years={years} value={fy} onChange={setFy} reference={reference} />}
          />
        </div>

        <div className="min-w-0 max-w-64 xl:sticky xl:top-24">
          <GlassCalendar items={allItems} reference={reference} onOpen={selectCompany} />
        </div>
      </div>

      <ClientFormDialog open={editing !== null} onOpenChange={(o) => !o && setEditingId(null)} client={editing} />

      {report.kycExceptions.length > 0 ? (
        <Link
          href="/directors"
          className="flex items-start gap-3 rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm transition-colors hover:border-rose-300 dark:border-rose-500/25 dark:bg-rose-500/10"
        >
          <UserX className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <span className="flex-1">
            <span className="font-medium">
              {report.kycExceptions.length} director{report.kycExceptions.length === 1 ? "" : "s"}{" "}
              missed an earlier DIR-3 KYC
            </span>{" "}
            <span className="text-muted-foreground">
              — {report.kycExceptions.map((k) => k.director.name).join(", ")}. Their DIN may be
              deactivated until KYC is filed with the late fee.
            </span>
          </span>
          <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        </Link>
      ) : null}

    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Financial year for the whole admin view                             */
/* ------------------------------------------------------------------ */

const YEAR_KEY = "complykit.dashboard-fy.v1";

/**
 * The year the admin dashboard shows: null for the current window, else a
 * financial year. Remembered in this browser only, as a convenience; a year
 * that has since dropped off the list falls back to the current window.
 */
function useDashboardYear(years: number[]): [number | null, (fy: number | null) => void] {
  const [fy, setFyState] = React.useState<number | null>(() => {
    try {
      const stored = Number(window.localStorage.getItem(YEAR_KEY));
      return years.includes(stored) ? stored : null;
    } catch {
      return null;
    }
  });
  const setFy = React.useCallback((next: number | null) => {
    setFyState(next);
    try {
      if (next === null) window.localStorage.removeItem(YEAR_KEY);
      else window.localStorage.setItem(YEAR_KEY, String(next));
    } catch {
      // Blocked storage: the choice just lasts for this visit.
    }
  }, []);
  return [fy, setFy];
}

function YearPicker({
  years,
  value,
  onChange,
  reference,
}: {
  years: number[];
  value: number | null;
  onChange: (fy: number | null) => void;
  reference: Date;
}) {
  const options: { value: number | null; label: string }[] = [
    { value: null, label: "Current" },
    ...years.map((y) => ({ value: y, label: financialYearLabel(y) })),
  ];
  // What the choice covers, on hover: it applies to the whole dashboard.
  const scope =
    value === null
      ? `Due ${formatDate(addDays(reference, -DEFAULT_WINDOW.lookbackDays))} – ${formatDate(addDays(reference, DEFAULT_WINDOW.horizonDays))}, any year`
      : `Only ${financialYearLabel(value)} (year ending ${formatDate(financialYearEnd(value))}), across the whole dashboard`;
  return (
    <Select
      value={value === null ? "current" : String(value)}
      onValueChange={(v) => onChange(v === "current" ? null : Number(v))}
    >
      <SelectTrigger size="sm" className="h-8 w-36" aria-label="Financial year" title={scope}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.label} value={o.value === null ? "current" : String(o.value)}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/* ------------------------------------------------------------------ */

/**
 * The dashboard's opening line: today's date, the title, and one sentence on
 * where the portfolio (or the selected company) stands. The date waits for the browser so the server render (which has no
 * portfolio and may be in another time zone) never disagrees with it.
 */
export function DashboardHero() {
  const { ready, clients, directors, activeClient } = usePortfolio();
  const reference = React.useMemo(() => today(), []);
  const report = React.useMemo(
    () =>
      ready
        ? buildPortfolioReport(clients, directors, { asOf: reference, clientId: activeClient?.id })
        : null,
    [ready, clients, directors, reference, activeClient],
  );

  let summary: string;
  if (!report || clients.length === 0) {
    summary = site.tagline;
  } else {
    const t = report.totals;
    const scope = activeClient ? `for ${activeClient.name}` : `across ${plural(clients.length, "company", "companies")}`;
    summary =
      t.overdue === 0 && t["due-soon"] === 0
        ? `You're all caught up: nothing overdue and nothing due in the next 30 days ${scope}. 🎉`
        : `Heads up: ${plural(t.overdue, "filing", "filings")} overdue and ${t["due-soon"]} due in the next 30 days ${scope}.`;
  }

  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <section className="mb-8 flex flex-wrap items-end justify-between gap-6">
      <div className="min-w-0">
        <p className="mb-4 inline-flex h-7 items-center gap-1.5 rounded-full border bg-card/70 px-3 text-xs font-medium text-muted-foreground shadow-card backdrop-blur">
          <CalendarHeart className="size-3.5 text-pink-500" aria-hidden />
          {ready ? dateLabel : site.name}
        </p>
        <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-[3.25rem] sm:leading-[1.05]">
          {activeClient ? activeClient.name : "Dashboard"}
        </h1>
        <p className="mt-3 max-w-[60ch] text-base text-muted-foreground sm:text-lg">{summary}</p>
      </div>
    </section>
  );
}
