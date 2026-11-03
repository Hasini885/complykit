"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, BellOff, BellRing, CalendarPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePortfolio } from "@/components/portfolio/portfolio-provider";
import { formatDate, today } from "@/lib/dates";
import { downloadIcs } from "@/lib/ics";
import type { DuesRow } from "@/lib/portfolio/dues-table";
import {
  REMIND_DAYS_BEFORE,
  dueInWords,
  notYetNotified,
  pruneNotified,
  reminderCalendarEvents,
  remindersFor,
} from "@/lib/portfolio/reminders";
import { cn } from "@/lib/utils";

/** Per-browser settings: whether desktop notifications are on, and what was already shown. */
const PREF_KEY = "complykit.desktop-notifications.v1";
const NOTIFIED_KEY = "complykit.notified.v1";
const LIST_LIMIT = 6;
/** Re-check while the app stays open, so a new day's reminders appear without a reload. */
const RECHECK_MS = 60 * 60 * 1000;

type Permission = NotificationPermission | "unsupported";

function readPref(): boolean {
  try {
    return window.localStorage.getItem(PREF_KEY) === "on";
  } catch {
    return false;
  }
}

function writePref(on: boolean) {
  try {
    window.localStorage.setItem(PREF_KEY, on ? "on" : "off");
  } catch {
    // Private mode or blocked storage: the setting just won't persist.
  }
}

function readNotified(): Set<string> {
  try {
    const raw = window.localStorage.getItem(NOTIFIED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function writeNotified(ids: Set<string>) {
  try {
    window.localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...ids]));
  } catch {
    // Non-fatal: at worst a reminder is shown again next time.
  }
}

/**
 * The header bell: every open due in the next week (the reminder window),
 * plus anything already overdue. Optionally shows a desktop notification for
 * each due as it enters the window, once per due, while the app is open.
 */
export function NotificationsBell() {
  const { ready, clients, directors, setActiveClient } = usePortfolio();
  const router = useRouter();

  // Today's date, refreshed hourly so the window moves on in a long-open tab.
  const [reference, setReference] = React.useState(() => today());
  React.useEffect(() => {
    const t = window.setInterval(() => setReference(today()), RECHECK_MS);
    return () => window.clearInterval(t);
  }, []);

  const reminders = React.useMemo(
    () => remindersFor(clients, directors, reference),
    [clients, directors, reference],
  );
  const count = reminders.dueThisWeek.length + reminders.overdue.length;

  // Browser capability and the user's choice. Read once on the client: the
  // bell renders nothing until the portfolio has loaded, so there is no
  // server-rendered markup for this to disagree with.
  const [permission, setPermission] = React.useState<Permission>(() =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );
  const [enabled, setEnabled] = React.useState(
    () => typeof Notification !== "undefined" && Notification.permission === "granted" && readPref(),
  );

  // Announce dues entering the 7-day window that have not been announced yet.
  React.useEffect(() => {
    if (!ready || !enabled || permission !== "granted") return;
    const notified = pruneNotified(readNotified(), reminders.dueThisWeek);
    const fresh = notYetNotified(reminders.dueThisWeek, notified);
    if (fresh.length === 0) {
      writeNotified(notified);
      return;
    }
    try {
      if (fresh.length <= 3) {
        for (const r of fresh) {
          const n = new Notification(`${r.obligation} — ${dueInWords(r.days)}`, {
            body: `${r.company}${r.form ? ` · ${r.form}` : ""} · ${formatDate(r.due)}`,
            tag: r.id,
          });
          n.onclick = () => window.focus();
        }
      } else {
        const n = new Notification(`${fresh.length} dues in the next ${REMIND_DAYS_BEFORE} days`, {
          body: fresh
            .slice(0, 4)
            .map((r) => `${formatDate(r.due)} · ${r.company} · ${r.form || r.obligation}`)
            .join("\n"),
          tag: "complykit-weekly",
        });
        n.onclick = () => window.focus();
      }
      fresh.forEach((r) => notified.add(r.id));
      writeNotified(notified);
    } catch {
      // Some browsers only allow notifications from a service worker; the bell still works.
    }
  }, [ready, enabled, permission, reminders.dueThisWeek]);

  async function turnOn() {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      writePref(true);
      setEnabled(true);
      toast.success("Desktop notifications on", {
        description: `You'll be notified ${REMIND_DAYS_BEFORE} days before each due while ComplyKit is open.`,
      });
    } else {
      toast.error("Notifications were not allowed", {
        description: "Allow them for this site in the browser's settings to turn this on.",
      });
    }
  }

  function turnOff() {
    writePref(false);
    setEnabled(false);
    toast.success("Desktop notifications off");
  }

  function downloadCalendar() {
    const events = reminderCalendarEvents(clients, directors, reference);
    if (events.length === 0) {
      toast.info("Nothing upcoming to add");
      return;
    }
    downloadIcs(events, "complykit-reminders.ics", "ComplyKit — compliance reminders");
    toast.success(`Calendar file with ${events.length} dues downloaded`, {
      description: `Import it into Outlook, Apple or Google Calendar. Each due reminds you ${REMIND_DAYS_BEFORE} days before, at 9 am.`,
    });
  }

  async function open(row: DuesRow) {
    await setActiveClient(row.clientId);
    router.push("/due-dates");
  }

  if (!ready || clients.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={count > 0 ? `${count} reminders` : "Reminders"}
        >
          {count > 0 ? <BellRing className="size-4" aria-hidden /> : <Bell className="size-4" aria-hidden />}
          {count > 0 ? (
            <span
              className={cn(
                "absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[10px] font-bold text-white",
                reminders.overdue.length > 0 ? "bg-destructive" : "bg-amber-500",
              )}
            >
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-96 max-w-[calc(100vw-2rem)]">
        <DropdownMenuLabel className="flex items-baseline justify-between">
          <span>Reminders</span>
          <span className="text-[11px] font-normal text-muted-foreground">
            {REMIND_DAYS_BEFORE} days ahead, all companies
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="max-h-[22rem] overflow-y-auto">
          <Group title={`Due within ${REMIND_DAYS_BEFORE} days`} rows={reminders.dueThisWeek} onOpen={open} tone="soon" />
          {reminders.overdue.length > 0 ? (
            <Group title="Overdue" rows={reminders.overdue} onOpen={open} tone="overdue" />
          ) : null}
          {count === 0 ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">
              Nothing due in the next {REMIND_DAYS_BEFORE} days, and nothing overdue.
            </p>
          ) : null}
        </div>

        <DropdownMenuSeparator />
        <div className="space-y-2 p-2">
          {permission === "unsupported" ? null : permission === "denied" ? (
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <BellOff className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Desktop notifications are blocked for this site. Allow them in the browser&apos;s
              site settings to get them.
            </p>
          ) : enabled ? (
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                <BellRing className="size-3.5" aria-hidden /> Desktop notifications on
              </span>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={turnOff}>
                <BellOff className="size-3.5" aria-hidden /> Turn off
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="w-full justify-start text-xs" onClick={turnOn}>
              <BellRing className="size-3.5" aria-hidden /> Notify me {REMIND_DAYS_BEFORE} days before each due
            </Button>
          )}
          <Button size="sm" variant="outline" className="w-full justify-start text-xs" onClick={downloadCalendar}>
            <CalendarPlus className="size-3.5" aria-hidden /> Add reminders to my calendar (.ics)
          </Button>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Desktop notifications appear while ComplyKit is open. For reminders when it is closed,
            add the calendar file to Outlook, Apple or Google Calendar.
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Group({
  title,
  rows,
  onOpen,
  tone,
}: {
  title: string;
  rows: DuesRow[];
  onOpen: (row: DuesRow) => void;
  tone: "soon" | "overdue";
}) {
  if (rows.length === 0) return null;
  const shown = rows.slice(0, LIST_LIMIT);
  return (
    <div className="pb-1">
      <p className="px-2 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {title} · {rows.length}
      </p>
      {shown.map((r) => (
        <DropdownMenuItem key={r.id} onSelect={() => onOpen(r)} className="items-start gap-3 py-2">
          <span
            className={cn(
              "w-20 shrink-0 font-mono text-[11px] font-medium",
              tone === "overdue" ? "text-destructive" : "text-amber-700 dark:text-amber-400",
            )}
          >
            {tone === "overdue" ? `${-r.days}d overdue` : dueInWords(r.days).replace("Due ", "")}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium">
              {r.obligation}
              {r.form ? ` (${r.form})` : ""}
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {r.company} · {formatDate(r.due)}
            </span>
          </span>
        </DropdownMenuItem>
      ))}
      {rows.length > shown.length ? (
        <p className="px-2 py-1 text-[11px] text-muted-foreground">
          +{rows.length - shown.length} more on the dashboard
        </p>
      ) : null}
    </div>
  );
}
