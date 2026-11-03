"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Building, LayoutGrid, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tip } from "@/components/shared/tip";
import { usePortfolio } from "@/components/portfolio/portfolio-provider";
import { KycBadge } from "@/components/portfolio/kyc-badge";
import { addDays, financialYearLabel, formatDate, today } from "@/lib/dates";
import { typeLabelLong } from "@/lib/portfolio/clients";
import { allDins, dinAt } from "@/lib/portfolio/directors";
import { CLIENT_STATUSES } from "@/lib/portfolio/types";
import {
  buildPortfolioReport,
  type ClientSection,
  type ReportBucket,
  type ReportItem,
} from "@/lib/portfolio/report";
import { useUrlParam } from "@/lib/use-url-param";
import { SrnChip } from "@/components/shared/srn-chip";
import { referenceKind } from "@/lib/portfolio/filings";
import { brand, legal, site } from "@/config/site";
import { cn } from "@/lib/utils";

const BUCKET_STYLE: Record<ReportBucket, string> = {
  overdue: "bg-destructive/10 text-destructive",
  "due-soon": "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  upcoming: "bg-muted text-muted-foreground",
  completed: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
};

function statusLabel(r: ReportItem): string {
  switch (r.bucket) {
    case "overdue":
      return `Overdue ${-r.days} day${r.days === -1 ? "" : "s"}`;
    case "due-soon":
      return r.days === 0 ? "Due today" : `Due in ${r.days} day${r.days === 1 ? "" : "s"}`;
    case "upcoming":
      return `In ${r.days} days`;
    case "completed":
      return `Filed ${formatDate(r.item.filedOn!)}`;
  }
}

/**
 * Printable compliance MIS for the whole firm, or for one client with
 * ?client=<id>. "Save as PDF" is the browser's own print dialog, so the
 * report needs no PDF library and nothing leaves the browser. Opened with
 * ?print=1 (as the portfolio buttons do), the dialog opens by itself.
 */
export function PortfolioReport() {
  const { ready, clients, directors } = usePortfolio();
  const clientId = useUrlParam("client");
  const autoPrint = useUrlParam("print") === "1";
  const reference = React.useMemo(() => today(), []);

  const report = React.useMemo(
    () => buildPortfolioReport(clients, directors, { clientId, asOf: reference }),
    [clients, directors, clientId, reference],
  );

  // Open the print dialog once, after the data has rendered, then drop the
  // flag so a refresh shows the report without printing again.
  const printed = React.useRef(false);
  React.useEffect(() => {
    if (!ready || !autoPrint || printed.current || report.sections.length === 0) return;
    printed.current = true;
    const url = new URL(window.location.href);
    url.searchParams.delete("print");
    window.history.replaceState(null, "", url);
    const t = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(t);
  }, [ready, autoPrint, report.sections.length]);

  if (!ready) {
    return <div className="h-64 animate-pulse rounded-lg border bg-muted/30" aria-hidden />;
  }

  const missingClient = clientId !== null && report.scope === null;
  const title = report.scope ? `${report.scope.name}` : "Firm-wide compliance report";
  const from = addDays(reference, -report.window.lookbackDays);
  const to = addDays(reference, report.window.horizonDays);
  const agency = brand.agency.startsWith("[") ? null : brand.agency;

  return (
    <div className="space-y-8 [print-color-adjust:exact] print:space-y-6 print:text-[11px]">
      {/* Toolbar: screen only */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href="/portfolio">
            <ArrowLeft className="size-4" aria-hidden /> Back to portfolio
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {report.scope ? (
            <Tip label="Firm-wide report">
              <Button asChild variant="outline" size="icon-sm" className="size-8">
                <Link href="/portfolio/report" aria-label="Firm-wide report">
                  <Building className="size-4" aria-hidden />
                </Link>
              </Button>
            </Tip>
          ) : null}
          <Tip label="Save as PDF / Print">
            <Button
              size="icon-sm"
              className="size-8"
              onClick={() => window.print()}
              disabled={report.sections.length === 0}
              aria-label="Save as PDF or print"
            >
              <Printer className="size-4" aria-hidden />
            </Button>
          </Tip>
        </div>
      </div>

      {/* Report header */}
      <header className="border-b pb-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary">
          {site.name} · Compliance MIS{agency ? ` · ${agency}` : ""}
        </p>
        <h1 className="mt-1 font-heading text-3xl font-semibold print:text-2xl">{title}</h1>
        {report.scope ? (
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {report.scope.cin} · {typeLabelLong(report.scope.type)}
          </p>
        ) : null}
        <p className="mt-3 text-sm text-muted-foreground">
          Generated {formatDate(report.generatedOn)}. Covers obligations due from{" "}
          {formatDate(from)} to {formatDate(to)}, across financial years, computed from each
          company&apos;s own profile.
        </p>
      </header>

      {missingClient ? (
        <EmptyState text="That company is not in this browser's portfolio. It may have been deleted." />
      ) : report.sections.length === 0 ? (
        <EmptyState text="There are no companies in the portfolio yet, so there is nothing to report." />
      ) : (
        <>
          <Summary report={report} />

          <section className="print:break-inside-avoid">
            <SectionTitle>
              Exceptions — overdue and due within 30 days ({report.exceptions.length})
            </SectionTitle>
            {report.exceptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing is overdue or due within 30 days.
              </p>
            ) : (
              <ItemsTable items={report.exceptions} showClient={!report.scope} />
            )}
          </section>

          {report.kycExceptions.length > 0 ? (
            <section className="print:break-inside-avoid">
              <SectionTitle>
                Directors with a missed KYC ({report.kycExceptions.length})
              </SectionTitle>
              <p className="mb-2 text-xs text-muted-foreground">
                An earlier DIR-3 KYC deadline passed with no filing recorded, so the DIN may be
                deactivated until KYC is filed with the late fee. Record the filing date in
                Director Master once done.
              </p>
              <table className="w-full text-left text-sm print:text-[11px]">
                <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-1.5 pr-3 font-medium">Director</th>
                    <th className="py-1.5 pr-3 font-medium">DIN</th>
                    <th className="py-1.5 pr-3 font-medium">Missed</th>
                    <th className="py-1.5 font-medium">Companies</th>
                  </tr>
                </thead>
                <tbody>
                  {report.kycExceptions.map(({ director, kyc, companies }) => (
                    <tr key={director.id} className="border-b last:border-0">
                      <td className="py-1.5 pr-3">{director.name}</td>
                      <td className="tabular py-1.5 pr-3 font-mono">{allDins(director).join(", ")}</td>
                      <td className="tabular whitespace-nowrap py-1.5 pr-3 font-mono">
                        {kyc.previousDueOn ? formatDate(kyc.previousDueOn) : "—"}
                      </td>
                      <td className="py-1.5">{companies.map((c) => c.name).join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          {report.sections.map((section, i) => (
            <ClientBlock key={section.client.id} section={section} pageBreak={i > 0 || !report.scope} />
          ))}

          <footer className="space-y-2 border-t pt-4 text-[11px] text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">How to read this report.</span> Only DIR-3
              KYC records an actual filing date, so &ldquo;Completed&rdquo; covers KYC filings
              only. Other obligations show as pending until their due date and as overdue for{" "}
              {report.window.lookbackDays} days after it; mark-as-filed is not tracked for them
              yet. Dates marked &ldquo;assumed AGM&rdquo; count from the statutory last date
              because no AGM is recorded for that year.
            </p>
            {legal.dataUnverified ? (
              <p>
                Pre-launch: the statutory data behind these dates has not yet been checked by a
                practising professional. Verify before relying on it.
              </p>
            ) : null}
            <p>{legal.disclaimer}</p>
          </footer>
        </>
      )}
    </div>
  );
}

function Summary({ report }: { report: ReturnType<typeof buildPortfolioReport> }) {
  const t = report.totals;
  const cells: { label: string; value: string | number; tone?: string }[] = [
    { label: report.scope ? "Health" : "Companies", value: report.scope ? `${t.averageHealth}%` : t.companies },
    ...(report.scope ? [] : [{ label: "Avg. health", value: t.averageHealth === null ? "—" : `${t.averageHealth}%` }]),
    { label: "Overdue", value: t.overdue, tone: t.overdue > 0 ? "text-destructive" : undefined },
    { label: "Due ≤ 30 days", value: t["due-soon"], tone: t["due-soon"] > 0 ? "text-amber-700 dark:text-amber-400" : undefined },
    { label: "Upcoming", value: t.upcoming },
    { label: "Completed", value: t.completed },
  ];
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 print:grid-cols-6 print:gap-2">
      {cells.map((c) => (
        <div key={c.label} className="rounded-lg border p-3 print:p-2">
          <p className={cn("tabular font-mono text-2xl font-semibold print:text-lg", c.tone)}>{c.value}</p>
          <p className="text-xs text-muted-foreground">{c.label}</p>
        </div>
      ))}
    </section>
  );
}

function ClientBlock({ section, pageBreak }: { section: ClientSection; pageBreak: boolean }) {
  const { client, health, items, standing, directors } = section;
  const status = CLIENT_STATUSES.find((s) => s.value === client.status)?.label ?? client.status;
  return (
    <section className={cn("space-y-4", pageBreak && "print:break-before-page")}>
      <div className="flex flex-wrap items-end justify-between gap-2 border-b pb-2">
        <div>
          <h2 className="font-heading text-xl font-semibold">{client.name}</h2>
          <p className="font-mono text-[11px] text-muted-foreground">
            {client.cin} · {typeLabelLong(client.type)} · {status}
          </p>
        </div>
        <p className="text-sm">
          Health <span className="tabular font-mono font-semibold">{health.score}%</span>{" "}
          <span className="tabular font-mono text-xs text-muted-foreground">
            ({health.onTrack}/{health.total} not overdue)
          </span>
        </p>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No dated obligations in this period.</p>
      ) : (
        <ItemsTable items={items} showClient={false} />
      )}

      {standing.length > 0 ? (
        <div className="print:break-inside-avoid">
          <SubTitle>Standing requirements</SubTitle>
          <ul className="list-disc space-y-1 pl-5 text-sm print:text-[11px]">
            {standing.map((s) => (
              <li key={s.source.id}>
                <span className="font-medium">{s.source.title}</span>
                {s.qualifier ? <span className="text-muted-foreground"> — {s.qualifier}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {directors.length > 0 ? (
        <div className="print:break-inside-avoid">
          <SubTitle>Directors and DIR-3 KYC</SubTitle>
          <table className="w-full text-left text-sm print:text-[11px]">
            <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr className="border-b">
                <th className="py-1.5 pr-3 font-medium">Director</th>
                <th className="py-1.5 pr-3 font-medium">DIN</th>
                <th className="py-1.5 pr-3 font-medium">KYC</th>
                <th className="py-1.5 pr-3 font-medium">Next due</th>
                <th className="py-1.5 font-medium">Last filed</th>
              </tr>
            </thead>
            <tbody>
              {directors.map(({ director, kyc }) => (
                <tr key={director.id} className="border-b last:border-0">
                  <td className="py-1.5 pr-3">{director.name}</td>
                  <td className="tabular py-1.5 pr-3 font-mono">{dinAt(director, client.id)}</td>
                  <td className="py-1.5 pr-3">{kyc ? <KycBadge state={kyc.state} /> : "—"}</td>
                  <td className="tabular py-1.5 pr-3 font-mono">{kyc ? formatDate(kyc.dueOn) : "—"}</td>
                  <td className="tabular py-1.5 font-mono">
                    {kyc?.lastFiledOn ? formatDate(kyc.lastFiledOn) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function ItemsTable({ items, showClient }: { items: ReportItem[]; showClient: boolean }) {
  return (
    <table className="w-full text-left text-sm print:text-[11px]">
      <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
        <tr className="border-b">
          <th className="py-1.5 pr-3 font-medium">Due</th>
          {showClient ? <th className="py-1.5 pr-3 font-medium">Company</th> : null}
          <th className="py-1.5 pr-3 font-medium">Obligation</th>
          <th className="py-1.5 pr-3 font-medium">Form</th>
          <th className="py-1.5 pr-3 font-medium">FY</th>
          <th className="py-1.5 font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {items.map((r) => (
          <tr
            key={`${r.client.id}-${r.item.source.id}-${r.item.due!.getTime()}`}
            className="border-b last:border-0 print:break-inside-avoid"
          >
            <td className="tabular whitespace-nowrap py-1.5 pr-3 font-mono">{formatDate(r.item.due!)}</td>
            {showClient ? <td className="py-1.5 pr-3">{r.client.name}</td> : null}
            <td className="py-1.5 pr-3">
              {r.item.source.title}
              {r.item.qualifier ? (
                <span className="text-muted-foreground"> ({r.item.qualifier})</span>
              ) : null}
              {r.item.anchoredOnAssumedAgm ? (
                <span className="text-muted-foreground"> · assumed AGM</span>
              ) : null}
            </td>
            <td className="whitespace-nowrap py-1.5 pr-3 font-mono text-xs">{r.item.source.formCode ?? "—"}</td>
            <td className="whitespace-nowrap py-1.5 pr-3 text-xs">{financialYearLabel(r.item.fyEndingYear)}</td>
            <td className="py-1.5">
              <span
                className={cn(
                  "inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium",
                  BUCKET_STYLE[r.bucket],
                )}
              >
                {statusLabel(r)}
              </span>
              {r.item.filedOn && r.item.srn ? (
                <SrnChip srn={r.item.srn} kind={referenceKind(r.item.source.id)} className="ml-1.5" />
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 font-heading text-lg font-semibold">{children}</h2>;
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
      {children}
    </h3>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed py-14 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
      <Button asChild variant="outline" size="sm" className="mt-4 print:hidden">
        <Link href="/portfolio">
          <LayoutGrid className="size-4" aria-hidden /> Go to the portfolio
        </Link>
      </Button>
    </div>
  );
}
