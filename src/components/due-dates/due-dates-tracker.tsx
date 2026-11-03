"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarClock, CalendarRange, CheckCircle2, Info, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tip } from "@/components/shared/tip";
import { Input } from "@/components/ui/input";
import {
  addDays,
  COMPANY_TYPES,
  financialYearEnd,
  financialYearLabel,
  formatDate,
  isoDate,
  parseIsoDate,
  relativeLabel,
  today,
  urgency,
  type CompanyType,
} from "@/lib/dates";
import { groupByMonth, resolveDueDates, type ResolvedDueDate } from "@/lib/resolve-due-dates";
import { usePortfolio } from "@/components/portfolio/portfolio-provider";
import {
  agmDatesByFy,
  clientSchedule,
  DEFAULT_WINDOW,
  resolveClientYear,
  rollingDueDates,
  selectableYears,
} from "@/lib/portfolio/schedule";
import { typeLabel } from "@/lib/portfolio/clients";
import type { Client, Director } from "@/lib/portfolio/types";
import { MarkFiledDialog } from "@/components/due-dates/mark-filed-dialog";
import { ChangeDueDialog } from "@/components/due-dates/change-due-dialog";
import { SrnChip } from "@/components/shared/srn-chip";
import { referenceKind } from "@/lib/portfolio/filings";
import { cn } from "@/lib/utils";

const URGENCY_STYLES = {
  overdue: { stripe: "bg-destructive", text: "text-destructive" },
  "due-soon": { stripe: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" },
  upcoming: { stripe: "bg-primary/40", text: "text-muted-foreground" },
} as const;

/**
 * Outer shell: resolves the active client from the portfolio, then hands off
 * to a keyed instance of the actual calendar.
 *
 * The `key={activeClient?.id ?? "none"}` is what keeps this correct without a
 * sync-on-change effect: switching the active client in the top-bar switcher
 * changes the key, so React discards the old instance (and its stale
 * entity-type/FY/AGM state) and mounts a fresh one seeded from the new
 * client — the same pattern already used for the Add/Edit dialogs elsewhere
 * in this app, applied here to a page instead of a modal.
 */
export function DueDatesTracker() {
  const { ready, activeClient, directors } = usePortfolio();

  if (!ready) {
    return <div className="h-64 animate-pulse rounded-lg border bg-muted/30" aria-hidden />;
  }

  return (
    <DueDatesForClient
      key={activeClient?.id ?? "none"}
      client={activeClient}
      directors={directors}
    />
  );
}

/** "rolling" = the next twelve months across years; a number = one financial year. */
type View = "rolling" | number;

function DueDatesForClient({ client, directors }: { client: Client | null; directors: Director[] }) {
  // Computed once per mount against a stable reference so every row agrees.
  const reference = React.useMemo(() => today(), []);
  const years = React.useMemo(() => selectableYears(client, reference), [client, reference]);

  const [companyType, setCompanyType] = React.useState<CompanyType>(client?.type ?? "private");
  const [view, setView] = React.useState<View>(client?.workingFyEndingYear ?? "rolling");
  // The row whose filing is being recorded, if any.
  const [marking, setMarking] = React.useState<ResolvedDueDate | null>(null);
  // The row whose date is being changed for this one time, if any.
  const [changing, setChanging] = React.useState<ResolvedDueDate | null>(null);
  // What-if AGM dates, per financial year. Never saved.
  const [agmOverrides, setAgmOverrides] = React.useState<Record<number, string>>({});

  const recordedAgms = React.useMemo(
    () => (client ? agmDatesByFy(client) : new Map<number, Date>()),
    [client],
  );
  const fy = view === "rolling" ? null : view;
  const recordedAgm = fy !== null ? recordedAgms.get(fy) : undefined;
  const agmOverridden = fy !== null && agmOverrides[fy] !== undefined;
  const agmInput =
    fy === null ? "" : (agmOverrides[fy] ?? (recordedAgm ? isoDate(recordedAgm) : ""));
  const agmDate = parseIsoDate(agmInput);
  const agmInvalid = agmInput.trim() !== "" && agmDate === null;

  const resolved = React.useMemo(() => {
    const agm = parseIsoDate(agmInput);
    if (client) {
      return fy === null
        ? clientSchedule(client, directors, reference, DEFAULT_WINDOW, { companyType })
        : resolveClientYear(client, directors, fy, {
            companyType,
            agmDate: agmOverridden ? agm : undefined,
            asOf: reference,
          });
    }
    // No company selected: the generic calendar for an entity type.
    return fy === null
      ? rollingDueDates(
          (y) => resolveDueDates({ companyType, fyEndingYear: y, asOf: reference }),
          reference,
        )
      : resolveDueDates({ companyType, fyEndingYear: fy, agmDate: agm, asOf: reference });
  }, [client, directors, reference, companyType, fy, agmOverridden, agmInput]);
  const { months, undated } = React.useMemo(() => groupByMonth(resolved), [resolved]);

  const usesAgmAnchor = resolved.some((r) => r.anchoredOnAssumedAgm);
  const canRecord = client !== null && companyType === client.type;

  // Only warn about drift once the reader has actually deviated from the
  // client's own saved profile — not merely because a client is selected.
  const editedFromClient =
    client !== null && (companyType !== client.type || Object.keys(agmOverrides).length > 0);

  return (
    <div className="space-y-6">
      {client ? (
        <div className="flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/5 p-3 text-sm">
          <Info className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
          <p>
            Showing <span className="font-medium">{client.name}</span>&apos;s calendar —{" "}
            {typeLabel(client.type)}, worked out from its own incorporation date, AGMs, auditor
            appointment, MSME and listing position, and each director&apos;s DIN.
            {editedFromClient
              ? " You've changed the controls below from this company's saved profile — this only affects what you see here, not the saved record."
              : " Editable below without changing the saved record."}
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <p>
            No company selected. This is a generic calendar — pick a company from the switcher in
            the top bar, or{" "}
            <Link href="/portfolio" className="underline underline-offset-4 hover:text-foreground">
              add one to the portfolio
            </Link>
            , to see its actual dates.
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="space-y-4 rounded-lg border bg-card p-4">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Entity type
          </p>
          <div className="flex flex-wrap gap-1.5">
            {COMPANY_TYPES.map((t) => (
              <Button
                key={t.value}
                size="sm"
                variant={companyType === t.value ? "default" : "outline"}
                onClick={() => setCompanyType(t.value)}
                title={t.label}
              >
                {t.short}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Financial year
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Button
                size="sm"
                variant={view === "rolling" ? "secondary" : "ghost"}
                onClick={() => setView("rolling")}
              >
                <CalendarRange className="size-4" aria-hidden /> Next 12 months
              </Button>
              {years.map((y) => (
                <Button
                  key={y}
                  size="sm"
                  variant={view === y ? "secondary" : "ghost"}
                  onClick={() => setView(y)}
                >
                  {financialYearLabel(y)}
                </Button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {fy === null
                ? `Everything due from ${formatDate(addDays(reference, -DEFAULT_WINDOW.lookbackDays))} to ${formatDate(addDays(reference, DEFAULT_WINDOW.horizonDays))}, whichever financial year it belongs to. Moves on by itself.`
                : `Year ends ${formatDate(financialYearEnd(fy))}`}
            </p>
          </div>

          {fy !== null ? (
          <div>
            <label
              htmlFor="agm-date"
              className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground"
            >
              AGM held for {financialYearLabel(fy)} (optional)
            </label>
            <Input
              id="agm-date"
              type="date"
              value={agmInput}
              onChange={(e) => setAgmOverrides((o) => ({ ...o, [fy]: e.target.value }))}
              aria-invalid={agmInvalid}
              className="tabular"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              {agmInvalid
                ? "That is not a valid date."
                : agmDate
                  ? `Filings counted from ${formatDate(agmDate)}${!agmOverridden && recordedAgm ? " (on record)" : ""}.`
                  : "Left blank, AGM-linked filings count from the statutory last date."}
            </p>
          </div>
          ) : (
            <p className="text-xs text-muted-foreground sm:pt-6">
              {client
                ? "Each year's filings count from that year's own AGM on record, or from the statutory last date where none is recorded. Record AGMs in the company's profile."
                : "AGM-linked filings count from the statutory last date. Pick a single year to enter an actual AGM date."}
            </p>
          )}
        </div>
      </div>

      {usesAgmAnchor ? (
        <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <p>
            Filings marked <span className="font-medium text-foreground">assumed AGM</span> are
            counted from the last date on which the meeting could be held. Holding the meeting
            earlier pulls all of them forward — enter the actual date above to see the real
            deadlines.
          </p>
        </div>
      ) : null}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        {(
          [
            ["overdue", "Overdue"],
            ["due-soon", "Within 30 days"],
            ["upcoming", "Ahead"],
          ] as const
        ).map(([k, label]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={cn("inline-block size-2 rounded-sm", URGENCY_STYLES[k].stripe)} />
            {label}
          </span>
        ))}
        <span className="ml-auto tabular">
          {resolved.length} obligation{resolved.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Dated obligations, grouped by month */}
      {months.map((group) => (
        <section key={group.label}>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {group.label}
          </h2>
          <ul className="grid gap-2">
            {group.items.map((item, i) => (
              <DueRow
                key={`${item.source.id}-${i}`}
                item={item}
                reference={reference}
                showFy={fy === null}
                onMark={canRecord ? setMarking : undefined}
                onChangeDate={canRecord ? setChanging : undefined}
              />
            ))}
          </ul>
        </section>
      ))}

      {/* Cadence obligations */}
      {undated.length > 0 ? (
        <section>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Throughout the year
          </h2>
          <ul className="grid gap-2">
            {undated.map((item) => (
              <DueRow key={item.source.id} item={item} reference={reference} />
            ))}
          </ul>
        </section>
      ) : null}

      {client ? (
        <ChangeDueDialog
          clientId={client.id}
          item={changing}
          onOpenChange={(open) => {
            if (!open) setChanging(null);
          }}
        />
      ) : null}

      {client ? (
        <MarkFiledDialog
          clientId={client.id}
          item={marking}
          onOpenChange={(open) => {
            if (!open) setMarking(null);
          }}
        />
      ) : null}

      {resolved.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <p className="font-heading text-lg">Nothing recurring for this entity type</p>
        </div>
      ) : null}
    </div>
  );
}

function DueRow({
  item,
  reference,
  showFy = false,
  onMark,
  onChangeDate,
}: {
  item: ResolvedDueDate;
  reference: Date;
  showFy?: boolean;
  /** Present when filings can be recorded for this calendar. */
  onMark?: (item: ResolvedDueDate) => void;
  /** Present when a one-off date can be set for this occurrence. */
  onChangeDate?: (item: ResolvedDueDate) => void;
}) {
  const state = item.due && !item.filedOn ? urgency(item.due, reference) : null;
  const styles = state ? URGENCY_STYLES[state] : null;

  return (
    <li className="flex overflow-hidden rounded-lg border bg-card">
      <span
        aria-hidden
        className={cn("w-1 shrink-0", styles ? styles.stripe : "bg-muted-foreground/30")}
      />
      <div className="flex flex-1 flex-wrap items-start gap-x-4 gap-y-2 p-3">
        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{item.source.title}</span>
            {item.source.formCode ? (
              item.source.formId ? (
                <Link
                  href={`/forms?form=${item.source.formId}`}
                  className="rounded border px-1.5 py-0.5 font-mono text-[11px] transition-colors hover:border-primary hover:text-primary"
                >
                  {item.source.formCode}
                </Link>
              ) : (
                <Badge variant="outline" className="font-mono text-[11px]">
                  {item.source.formCode}
                </Badge>
              )
            ) : null}
            <span className="font-mono text-[11px] text-primary">{item.source.section}</span>
            {item.qualifier && item.due ? (
              <Badge variant="secondary" className="text-[10px]">
                {item.qualifier}
              </Badge>
            ) : null}
            {showFy && item.due ? (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                {financialYearLabel(item.fyEndingYear)}
              </Badge>
            ) : null}
            {item.anchoredOnAssumedAgm ? (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                assumed AGM
              </Badge>
            ) : null}
          </div>

          <p className="mt-1 text-xs text-muted-foreground">
            {item.due ? item.source.note : item.qualifier}
          </p>

          {item.relief && !item.filedOn ? (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-sky-800 dark:text-sky-300">
              <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
              {item.relief}
            </p>
          ) : null}

          {item.originalDue ? (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-violet-800 dark:text-violet-300">
              <CalendarClock className="mt-0.5 size-3 shrink-0" aria-hidden />
              Your own date for this time only. Usual date {formatDate(item.originalDue)}
              {item.customNote ? ` — ${item.customNote}` : ""}.
            </p>
          ) : null}

          {item.overrideReason ? (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
              {item.overrideReason}
            </p>
          ) : null}
        </div>

        <div className="ml-auto shrink-0 text-right">
          {item.due ? (
            <>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <p className="tabular font-mono text-sm font-medium">{formatDate(item.due)}</p>
                {item.filedOn && item.srn ? <SrnChip srn={item.srn} kind={referenceKind(item.source.id)} /> : null}
              </div>
              {item.originalDue ? (
                <p className="tabular font-mono text-[11px] text-violet-700 dark:text-violet-300" title="Changed for this time only">
                  your date · usual <span className="line-through">{formatDate(item.originalDue)}</span>
                </p>
              ) : null}
              {item.statutoryDue && !item.originalDue ? (
                <p
                  className="tabular font-mono text-[11px] text-muted-foreground"
                  title="The date in the Act, before the MCA extension"
                >
                  extended from <span className="line-through">{formatDate(item.statutoryDue)}</span>
                </p>
              ) : null}
              {item.filedOn ? (
                <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="size-3" aria-hidden />
                  Filed {formatDate(item.filedOn)}
                  {onMark ? (
                    <button
                      type="button"
                      onClick={() => onMark(item)}
                      className="ml-1 rounded p-0.5 text-muted-foreground hover:text-foreground"
                      title="Edit filing"
                    >
                      <Pencil className="size-3" aria-hidden />
                      <span className="sr-only">Edit filing for {item.source.title}</span>
                    </button>
                  ) : null}
                </p>
              ) : (
                <div className="mt-0.5 flex items-center justify-end gap-2">
                  <p className={cn("tabular font-mono text-[11px]", styles?.text ?? "text-muted-foreground")}>
                    {relativeLabel(item.due, reference)}
                  </p>
                  {onChangeDate ? (
                    <Tip label="Change the due date (this time only)">
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => onChangeDate(item)}
                        aria-label={`Change the due date for ${item.source.title}`}
                      >
                        <CalendarClock className="size-3.5" aria-hidden />
                      </Button>
                    </Tip>
                  ) : null}
                  {onMark ? (
                    <Tip label="Mark filed">
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="outline"
                        onClick={() => onMark(item)}
                        aria-label={`Mark ${item.source.title} filed`}
                      >
                        <CheckCircle2 className="size-3.5" aria-hidden />
                      </Button>
                    </Tip>
                  ) : null}
                </div>
              )}
            </>
          ) : (
            <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
          )}
        </div>
      </div>
    </li>
  );
}
