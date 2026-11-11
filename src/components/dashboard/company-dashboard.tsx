"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CalendarDays,
  CheckCircle2,
  FileText,
  HeartPulse,
  Pencil,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tip } from "@/components/shared/tip";
import { StatCard, StatCardGrid } from "@/components/shared/stat-card";
import { SrnChip } from "@/components/shared/srn-chip";
import { AllDuesGrid } from "@/components/dashboard/all-dues-grid";
import { COMING_UP_DAYS, Empty, ItemList, Panel } from "@/components/dashboard/dashboard-parts";
import { usePortfolio } from "@/components/portfolio/portfolio-provider";
import { ClientFormDialog } from "@/components/portfolio/client-form-dialog";
import { ChallanUploadButton } from "@/components/portfolio/challan-upload";
import { KycBadge } from "@/components/portfolio/kyc-badge";
import { StatusPill } from "@/components/portfolio/status-pill";
import { financialYearLabel, formatDate, parseIsoDate, today } from "@/lib/dates";
import { formatInr } from "@/lib/fees";
import { typeLabelLong } from "@/lib/portfolio/clients";
import { dinAt, financialYearEndYear } from "@/lib/portfolio/directors";
import { buildPortfolioReport } from "@/lib/portfolio/report";
import { agmDatesByFy, auditorAnchorFy, auditorTermOf, firstFyEndingYear, nextAdtFy } from "@/lib/portfolio/schedule";
import type { Client } from "@/lib/portfolio/types";

/**
 * One company's dashboard, shown when it is selected in the top-bar switcher:
 * its profile, where it stands, what is due, its directors' KYC, and every due
 * with its filing and SRN.
 */
export function CompanyDashboard({ client }: { client: Client }) {
  const { directors, setActiveClient } = usePortfolio();
  const [editing, setEditing] = React.useState(false);
  const reference = React.useMemo(() => today(), []);
  const report = React.useMemo(
    () => buildPortfolioReport([client], directors, { clientId: client.id, asOf: reference }),
    [client, directors, reference],
  );
  const section = report.sections[0];
  if (!section) return null;

  const items = section.items;
  const exceptions = report.exceptions;
  const comingUp = items
    .filter((i) => i.bucket === "upcoming" && i.days <= COMING_UP_DAYS)
    .sort((a, b) => a.days - b.days);
  const filed = items.filter((i) => i.bucket === "completed").length;

  function openReport() {
    window.open(`/portfolio/report?${new URLSearchParams({ client: client.id, print: "1" })}`, "_blank", "noopener");
  }

  return (
    <div className="space-y-6">
      {/* Who this is */}
      <section className="rounded-lg border bg-card p-4">
        <Button variant="ghost" size="sm" className="-ml-2 mb-2 h-7 px-2 text-xs" onClick={() => setActiveClient(null)}>
          <ArrowLeft className="size-3.5" aria-hidden /> All companies (admin view)
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-2xl font-semibold">{client.name}</h2>
              <StatusPill status={client.status} />
            </div>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {client.cin} · {typeLabelLong(client.type)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Tip label="Edit company">
              <Button size="icon-sm" variant="outline" className="size-8" onClick={() => setEditing(true)} aria-label="Edit company">
                <Pencil className="size-3.5" aria-hidden />
              </Button>
            </Tip>
            <Tip label="Calendar & mark filed">
              <Button asChild size="icon-sm" variant="outline" className="size-8">
                <Link href="/due-dates" aria-label="Calendar & mark filed">
                  <CalendarDays className="size-3.5" aria-hidden />
                </Link>
              </Button>
            </Tip>
            <ChallanUploadButton className="size-8" />
            <Tip label="Company report (PDF)">
              <Button size="icon-sm" variant="outline" className="size-8" onClick={openReport} aria-label="Company report (PDF)">
                <FileText className="size-3.5" aria-hidden />
              </Button>
            </Tip>
          </div>
        </div>
      </section>

      <StatCardGrid>
        <StatCard
          icon={HeartPulse}
          value={`${section.health.score}%`}
          label="Health"
          tone={section.health.score >= 80 ? "good" : section.health.score >= 50 ? "warn" : "bad"}
        />
        <StatCard
          icon={AlertTriangle}
          value={report.totals.overdue}
          label="Overdue"
          tone={report.totals.overdue > 0 ? "bad" : "good"}
        />
        <StatCard
          icon={Calendar}
          value={report.totals["due-soon"]}
          label="Due within 30 days"
          tone={report.totals["due-soon"] > 0 ? "warn" : "neutral"}
        />
        <StatCard icon={CheckCircle2} value={filed} label="Filed" tone={filed > 0 ? "good" : "neutral"} />
      </StatCardGrid>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Needs attention" subtitle="Overdue, or due within 30 days" count={exceptions.length}>
          {exceptions.length === 0 ? (
            <Empty>
              <CheckCircle2 className="size-4 text-emerald-600" aria-hidden /> Nothing overdue or due
              within 30 days.
            </Empty>
          ) : (
            <ItemList items={exceptions} moreHref={`/portfolio/report?client=${client.id}`} />
          )}
        </Panel>
        <Panel title="Coming up" subtitle={`Due in the ${COMING_UP_DAYS} days after that`} count={comingUp.length}>
          {comingUp.length === 0 ? (
            <Empty>Nothing else falls due in the next {COMING_UP_DAYS} days.</Empty>
          ) : (
            <ItemList items={comingUp} moreHref={`/portfolio/report?client=${client.id}`} />
          )}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <CompanyDetails client={client} reference={reference} />
        <Panel title="Directors and DIR-3 KYC" subtitle="Current directors of this company" count={section.directors.length}>
          {section.directors.length === 0 ? (
            <Empty>
              No directors recorded.{" "}
              <button type="button" onClick={() => setEditing(true)} className="text-primary hover:underline">
                Add them in its company master data
              </button>
            </Empty>
          ) : (
            <ul className="divide-y">
              {section.directors.map(({ director, kyc }) => (
                <li key={director.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{director.name}</span>
                    <span className="block font-mono text-[11px] text-muted-foreground">DIN {dinAt(director, client.id)}</span>
                  </span>
                  <span className="flex flex-col items-end gap-1 text-right">
                    {kyc ? <KycBadge state={kyc.state} /> : null}
                    <span className="text-[11px] text-muted-foreground">
                      {kyc ? `Next KYC ${formatDate(kyc.dueOn)}` : "DIN allotment date missing"}
                    </span>
                    {kyc?.lastFiledOn ? (
                      <span className="flex flex-wrap items-center justify-end gap-1 text-[11px] text-muted-foreground">
                        Filed {formatDate(kyc.lastFiledOn)}
                        {director.lastKycSrn ? <SrnChip srn={director.lastKycSrn} /> : null}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <AllDuesGrid
        section="post-incorporation"
        clients={[client]}
        directors={directors}
        reference={reference}
        singleCompany
      />
      <AllDuesGrid
        section="annual"
        clients={[client]}
        directors={directors}
        reference={reference}
        singleCompany
      />

      <ClientFormDialog open={editing} onOpenChange={setEditing} client={client} />
    </div>
  );
}

/** The saved profile, plus the facts the calendar works out from it. */
function CompanyDetails({ client, reference }: { client: Client; reference: Date }) {
  const incorporated = parseIsoDate(client.incorporatedOn);
  const firstFy = firstFyEndingYear(client);
  const agms = [...agmDatesByFy(client).entries()].sort(([a], [b]) => b - a);
  const anchor = auditorAnchorFy(client);
  const term = auditorTermOf(client);
  const nextAdt = nextAdtFy(client, financialYearEndYear(reference) - 1);
  const isLlp = client.type === "llp";
  const money = (n: number | undefined) => (n ? formatInr(n) : "—");

  const rows: [string, React.ReactNode][] = [
    ["Incorporated", incorporated ? `${formatDate(incorporated)}${firstFy ? ` · first year ${financialYearLabel(firstFy)}` : ""}` : "—"],
    ["Registered office", client.registeredOffice || "—"],
    ...(!isLlp ? [["Listed", client.listed ? "Yes" : "No"] as [string, React.ReactNode]] : []),
    [
      "AGMs on record",
      agms.length === 0
        ? "None recorded — filings count from the statutory last date"
        : agms.map(([fy, d]) => `${formatDate(d)} (${financialYearLabel(fy)})`).join(", "),
    ],
    ...(!isLlp
      ? [
          [
            "Auditor",
            anchor === null
              ? "—"
              : `Appointed at the ${financialYearLabel(anchor)} AGM${client.auditorAppointedAtAgmFy ? "" : " (worked out)"} for ${term} year${term === 1 ? "" : "s"}; next ADT-1 for ${financialYearLabel(nextAdt!)}`,
          ] as [string, React.ReactNode],
        ]
      : []),
    ["MSME dues over 45 days", client.msmeDuesOver45Days ? "Yes — MSME-1 applies" : "No"],
    ["Directors / partners", client.directorsCount ? String(client.directorsCount) : "—"],
    [isLlp ? "Contribution" : "Paid-up capital", money(isLlp ? client.llpContribution : client.paidUpCapital)],
    ["Turnover", money(client.turnover)],
    ["Net worth", money(client.netWorth)],
    ["Net profit", money(client.netProfit)],
    ["Borrowings", money(client.borrowings)],
    ...(client.notes ? [["Notes", client.notes] as [string, React.ReactNode]] : []),
  ];

  return (
    <Panel title="Company details" subtitle="From the saved profile — edit to change">
      <dl className="grid gap-x-4 gap-y-2 px-2 py-1 text-sm sm:grid-cols-[11rem_1fr]">
        {rows.map(([label, value]) => (
          <React.Fragment key={label}>
            <dt className="text-xs text-muted-foreground sm:pt-0.5">{label}</dt>
            <dd className="min-w-0 break-words">{value}</dd>
          </React.Fragment>
        ))}
      </dl>
    </Panel>
  );
}
