"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { financialYearLabel, formatDate, monthName } from "@/lib/dates";
import type { ReportItem } from "@/lib/portfolio/report";
import { cn } from "@/lib/utils";

/** Building blocks shared by the admin and company dashboards. */

/** How far ahead "Coming up" looks, beyond the 30-day exceptions window. */
export const COMING_UP_DAYS = 90;
const LIST_LIMIT = 8;

/* ------------------------------------------------------------------ */

export function Panel({
  title,
  subtitle,
  count,
  action,
  className,
  compact = false,
  children,
}: {
  title: string;
  subtitle?: string;
  count?: number;
  /** Small link or control at the right of the header, e.g. "View all". */
  action?: React.ReactNode;
  className?: string;
  /** Tighter padding and a smaller title, for a narrow side panel. */
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("min-w-0 rounded-3xl border bg-card shadow-card", className)}>
      <header className={cn("flex items-start justify-between gap-3", compact ? "px-4 pt-3.5 pb-2" : "px-5 pt-5 pb-3")}>
        <div className="min-w-0">
          <h2 className={cn("flex items-center gap-2 font-bold", compact ? "text-sm" : "text-base")}>
            {title}
            {count !== undefined ? (
              <span className="tabular rounded-full bg-primary/10 px-2 py-px text-[11px] font-semibold text-primary">
                {count}
              </span>
            ) : null}
          </h2>
          {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className={compact ? "px-2 pb-2.5" : "px-3 pb-3"}>{children}</div>
    </section>
  );
}

/** Mono chip for an MCA form code (AOC-4, MGT-7...). */
export function FormChip({ code, className }: { code: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center truncate rounded-full bg-accent px-2 py-0.5 font-mono text-[11px] font-semibold text-accent-foreground",
        className,
      )}
    >
      {code}
    </span>
  );
}

const DUE_PILL: Record<ReportItem["bucket"], string> = {
  overdue: "bg-destructive/10 text-destructive",
  "due-soon": "bg-amber-500/12 text-amber-700 dark:text-amber-400",
  upcoming: "bg-muted text-muted-foreground",
  completed: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
};

/** "4 days overdue" / "2 days left" / "Filed", coloured by bucket. */
export function DuePill({ item }: { item: ReportItem }) {
  const label =
    item.bucket === "completed"
      ? "Filed"
      : item.days < 0
        ? `${-item.days} day${item.days === -1 ? "" : "s"} overdue`
        : item.days === 0
          ? "Due today"
          : `${item.days} day${item.days === 1 ? "" : "s"} left`;
  return (
    <span
      className={cn(
        "tabular inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium",
        DUE_PILL[item.bucket],
      )}
    >
      {label}
    </span>
  );
}

/**
 * Upcoming or overdue items. `onOpen` makes each row a button (the admin view
 * opens that company); without it rows are plain, and the company name is
 * left out since the page is already about one company.
 */
export function ItemList({
  items,
  onOpen,
  moreHref,
}: {
  items: ReportItem[];
  onOpen?: (clientId: string) => void;
  moreHref: string;
}) {
  const shown = items.slice(0, LIST_LIMIT);
  return (
    <>
      <ul className="divide-y divide-border/70">
        {shown.map((r) => {
          const body = (
            <>
              <span className="shrink-0 pt-0.5 sm:w-[5.5rem]">
                <FormChip code={r.item.source.formCode ?? "No form"} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {onOpen ? r.client.name : r.item.source.title}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {onOpen ? `${r.item.source.title} · ` : ""}
                  {financialYearLabel(r.item.fyEndingYear)}
                </span>
              </span>
              <span className="tabular hidden w-24 shrink-0 pt-0.5 text-right font-mono text-xs text-muted-foreground sm:block">
                {formatDate(r.item.due!)}
              </span>
              <span className="flex shrink-0 justify-end pt-0.5 sm:w-28">
                <DuePill item={r} />
              </span>
            </>
          );
          const key = `${r.client.id}-${r.item.source.id}-${r.item.due!.getTime()}`;
          return (
            <li key={key}>
              {onOpen ? (
                <button
                  type="button"
                  onClick={() => onOpen(r.client.id)}
                  className="flex w-full items-start gap-3 rounded-2xl px-2 py-3 text-left transition-colors hover:bg-accent/50"
                  title={`Show ${r.client.name}'s details`}
                >
                  {body}
                </button>
              ) : (
                <div className="flex items-start gap-3 px-2 py-3">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      {items.length > shown.length ? (
        <Link href={moreHref} className="mt-1 block px-2 py-1.5 text-xs font-medium text-primary hover:underline">
          +{items.length - shown.length} more in the report
        </Link>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

const DOT: Record<ReportItem["bucket"], string> = {
  overdue: "bg-destructive",
  "due-soon": "bg-amber-500",
  upcoming: "bg-primary",
  completed: "bg-emerald-500",
};

/** Lower is more urgent: a day's dot takes the colour of its worst item. */
/** A due day's whole circle, filled in its most urgent item's colour. */
const FILL: Record<ReportItem["bucket"], string> = {
  overdue: "bg-destructive/25 text-destructive hover:bg-destructive/35",
  "due-soon": "bg-amber-500/30 text-amber-900 hover:bg-amber-500/40 dark:text-amber-200",
  upcoming: "bg-primary/30 text-foreground hover:bg-primary/40",
  completed: "bg-emerald-500/25 text-emerald-800 hover:bg-emerald-500/35 dark:text-emerald-200",
};

const RANK: Record<ReportItem["bucket"], number> = { overdue: 0, "due-soon": 1, upcoming: 2, completed: 3 };

/**
 * Month grid with every day something falls due filled in, coloured by the
 * most urgent item that day. Selecting a day lists what is due on it.
 */
export function MiniCalendar({
  items,
  reference,
  onOpen,
}: {
  items: ReportItem[];
  reference: Date;
  onOpen?: (clientId: string) => void;
}) {
  const [month, setMonth] = React.useState(() => new Date(reference.getFullYear(), reference.getMonth(), 1));
  const [selected, setSelected] = React.useState<number | null>(null);

  const byDay = React.useMemo(() => {
    const map = new Map<number, ReportItem[]>();
    for (const r of items) {
      const d = r.item.due!;
      if (d.getFullYear() !== month.getFullYear() || d.getMonth() !== month.getMonth()) continue;
      const list = map.get(d.getDate()) ?? [];
      list.push(r);
      map.set(d.getDate(), list);
    }
    return map;
  }, [items, month]);

  const lead = (month.getDay() + 6) % 7; // Monday-first offset
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const isThisMonth = month.getFullYear() === reference.getFullYear() && month.getMonth() === reference.getMonth();

  function shift(n: number) {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
    setSelected(null);
  }

  const dayItems = selected ? (byDay.get(selected) ?? []) : [];

  return (
    <div className="px-2">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-xs font-medium">
          {monthName(month.getMonth())} {month.getFullYear()}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shift(-1)}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Next month"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-0.5 text-center">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="pb-0.5 text-[10px] font-medium text-muted-foreground">
            {w}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`lead-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const due = byDay.get(day);
          const worst = due?.reduce((a, b) => (RANK[b.bucket] < RANK[a.bucket] ? b : a));
          const isToday = isThisMonth && day === reference.getDate();
          const isSelected = selected === day;
          return (
            <button
              key={day}
              type="button"
              disabled={!due}
              onClick={() => setSelected(isSelected ? null : day)}
              aria-pressed={isSelected}
              aria-label={`${day} ${monthName(month.getMonth())}${due ? `, ${due.length} due` : ""}`}
              className={cn(
                "tabular relative mx-auto flex size-6 flex-col items-center justify-center rounded-full text-[11px] transition-colors",
                worst ? cn("cursor-pointer font-semibold", FILL[worst.bucket]) : "cursor-default text-muted-foreground",
                // Today: filled in periwinkle; outlined too, to stand apart from an upcoming due.
                isToday && !worst && "bg-primary/30 font-semibold text-foreground",
                isToday && "ring-1 ring-primary ring-offset-1 ring-offset-card",
                isSelected && "bg-primary text-primary-foreground hover:bg-primary",
              )}
            >
              {day}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1 text-[10px] text-muted-foreground">
        <Legend dot={DOT.overdue} label="Overdue" />
        <Legend dot={DOT["due-soon"]} label="Due soon" />
        <Legend dot={DOT.upcoming} label="Upcoming" />
      </div>

      {selected ? (
        <ul className="mt-3 space-y-1 border-t pt-3">
          {dayItems.map((r) => (
            <li key={`${r.client.id}-${r.item.source.id}`}>
              <button
                type="button"
                disabled={!onOpen}
                onClick={() => onOpen?.(r.client.id)}
                className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-xs enabled:hover:bg-accent/50"
              >
                <FormChip code={r.item.source.formCode ?? "No form"} />
                <span className="min-w-0 flex-1 truncate">{onOpen ? r.client.name : r.item.source.title}</span>
                <DuePill item={r} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * The compliance calendar as frosted glass: a translucent, blurred card over
 * soft sky, violet and pink light, glass day tiles with a coloured dot for
 * each kind of due (overdue, due soon, upcoming, filed), and the chosen day's
 * dues in a glass tray below. Same data and behaviour as MiniCalendar.
 */
export function GlassCalendar({
  items,
  reference,
  onOpen,
  title = "Compliance calendar",
}: {
  items: ReportItem[];
  reference: Date;
  onOpen?: (clientId: string) => void;
  title?: string;
}) {
  const [month, setMonth] = React.useState(() => new Date(reference.getFullYear(), reference.getMonth(), 1));
  const [selected, setSelected] = React.useState<number | null>(null);

  const byDay = React.useMemo(() => {
    const map = new Map<number, ReportItem[]>();
    for (const r of items) {
      const d = r.item.due!;
      if (d.getFullYear() !== month.getFullYear() || d.getMonth() !== month.getMonth()) continue;
      const list = map.get(d.getDate()) ?? [];
      list.push(r);
      map.set(d.getDate(), list);
    }
    return map;
  }, [items, month]);

  const lead = (month.getDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const isThisMonth = month.getFullYear() === reference.getFullYear() && month.getMonth() === reference.getMonth();
  const monthTotal = [...byDay.values()].reduce((n, l) => n + l.length, 0);

  function shift(n: number) {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
    setSelected(null);
  }
  function goToday() {
    setMonth(new Date(reference.getFullYear(), reference.getMonth(), 1));
    setSelected(reference.getDate());
  }

  const dayItems = selected ? (byDay.get(selected) ?? []) : [];
  const navButton =
    "flex size-6 items-center justify-center rounded-full border border-white/50 bg-white/40 text-foreground/80 shadow-[inset_0_1px_0_rgb(255_255_255/0.6)] backdrop-blur-md transition-colors hover:bg-white/70 dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/20";

  return (
    <section aria-label={title} className="relative isolate overflow-hidden rounded-2xl">
      {/* Light behind the glass. */}
      <div aria-hidden className="pointer-events-none absolute -top-12 -left-10 -z-10 size-32 rounded-full bg-sky-400/45 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute top-1/3 -right-12 -z-10 size-36 rounded-full bg-violet-500/45 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-14 left-4 -z-10 size-32 rounded-full bg-pink-400/40 blur-3xl" />

      <div className="rounded-2xl border border-white/60 bg-white/30 p-2.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.7),0_14px_34px_-14px_rgb(76_61_160/0.45)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.06] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_14px_34px_-14px_rgb(0_0_0/0.6)]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.12em] text-foreground/60 uppercase">{title}</p>
            <p className="font-heading text-sm leading-tight font-bold">
              {monthName(month.getMonth())} <span className="font-medium text-foreground/60">{month.getFullYear()}</span>
            </p>
            <p className="text-[10px] text-foreground/60">
              {monthTotal === 0 ? "Nothing due" : `${monthTotal} due this month`}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => shift(-1)} className={navButton} aria-label="Previous month">
              <ChevronLeft className="size-3.5" aria-hidden />
            </button>
            <button type="button" onClick={() => shift(1)} className={navButton} aria-label="Next month">
              <ChevronRight className="size-3.5" aria-hidden />
            </button>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-7 gap-0.5 text-center">
          {WEEKDAYS.map((w, i) => (
            <span key={i} className="pb-0.5 text-[9px] font-semibold text-foreground/50">
              {w}
            </span>
          ))}
          {Array.from({ length: lead }, (_, i) => (
            <span key={`lead-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const due = byDay.get(day);
            const kinds = due ? [...new Set(due.map((r) => r.bucket))].sort((a, b) => RANK[a] - RANK[b]) : [];
            const isToday = isThisMonth && day === reference.getDate();
            const isSelected = selected === day;
            return (
              <button
                key={day}
                type="button"
                disabled={!due}
                onClick={() => setSelected(isSelected ? null : day)}
                aria-pressed={isSelected}
                aria-label={`${day} ${monthName(month.getMonth())}${due ? `, ${due.length} due` : ""}${isToday ? ", today" : ""}`}
                className={cn(
                  "tabular relative mx-auto flex size-6 flex-col items-center justify-center rounded-lg text-[10px] transition-all",
                  due
                    ? "cursor-pointer border border-white/60 bg-white/50 font-semibold shadow-[inset_0_1px_0_rgb(255_255_255/0.7)] backdrop-blur-md hover:bg-white/75 dark:border-white/15 dark:bg-white/10 dark:hover:bg-white/20"
                    : "cursor-default text-foreground/55",
                  isToday && "ring-2 ring-primary/70",
                  isSelected &&
                    "liquid-metal border-transparent text-primary-foreground hover:bg-transparent dark:hover:bg-transparent",
                )}
              >
                {day}
                {kinds.length > 0 ? (
                  <span className="absolute bottom-0.5 flex gap-px" aria-hidden>
                    {kinds.map((k) => (
                      <span key={k} className={cn("size-[3px] rounded-full", isSelected ? "bg-white" : DOT[k])} />
                    ))}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-[10px] text-foreground/60">
            <Legend dot={DOT.overdue} label="Overdue" />
            <Legend dot={DOT["due-soon"]} label="Due soon" />
            <Legend dot={DOT.upcoming} label="Upcoming" />
          </div>
          {!isThisMonth || selected !== reference.getDate() ? (
            <button
              type="button"
              onClick={goToday}
              className="rounded-full border border-white/50 bg-white/40 px-2.5 py-0.5 text-[10px] font-semibold backdrop-blur-md hover:bg-white/70 dark:border-white/10 dark:bg-white/10"
            >
              Today
            </button>
          ) : null}
        </div>

        {selected ? (
          <div className="mt-2 rounded-xl border border-white/50 bg-white/40 p-1.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.6)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.07]">
            <p className="px-1.5 pt-0.5 pb-1 text-[10px] font-semibold tracking-wide text-foreground/60 uppercase">
              {selected} {monthName(month.getMonth())}
            </p>
            {dayItems.length === 0 ? (
              <p className="px-1.5 pb-1.5 text-xs text-foreground/60">Nothing due.</p>
            ) : (
              <ul className="space-y-0.5">
                {dayItems.map((r) => (
                  <li key={`${r.client.id}-${r.item.source.id}`}>
                    <button
                      type="button"
                      disabled={!onOpen}
                      onClick={() => onOpen?.(r.client.id)}
                      className="flex w-full items-center gap-2 rounded-xl px-1.5 py-1.5 text-left text-xs enabled:hover:bg-white/60 dark:enabled:hover:bg-white/10"
                    >
                      <FormChip code={r.item.source.formCode ?? "No form"} />
                      <span className="min-w-0 flex-1 truncate">{onOpen ? r.client.name : r.item.source.title}</span>
                      <DuePill item={r} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-1.5 rounded-full", dot)} aria-hidden />
      {label}
    </span>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="flex items-center gap-2 px-2 py-8 text-sm text-muted-foreground">{children}</p>;
}
