"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { TOOLS } from "@/config/navigation";
import { usePortfolio } from "@/components/portfolio/portfolio-provider";
import { useStoredJson } from "@/lib/stored-json";
import { buildPortfolioReport } from "@/lib/portfolio/report";
import { today } from "@/lib/dates";
import { EMPTY_GST, GST_KEY, currentMonth, monthSummary } from "@/lib/gst/register";
import { EMPTY_TASKS, TASKS_KEY, isoToday, taskSummary } from "@/lib/tasks/tasks";

/** The order of the boxes on the main dashboard. */
const ORDER = ["gst", "mca", "late-fee", "bank", "documents", "tasks"];

/**
 * The main dashboard: one box per tool. Opening a box shows that tool, with
 * its own items in the top bar.
 */
export function ToolHub() {
  const { ready, clients, directors } = usePortfolio();
  const [gst, , gstReady] = useStoredJson(GST_KEY, EMPTY_GST);
  const [tasks, , tasksReady] = useStoredJson(TASKS_KEY, EMPTY_TASKS);

  const mca = React.useMemo(() => {
    if (!ready || clients.length === 0) return null;
    return buildPortfolioReport(clients, directors, { asOf: today() }).totals;
  }, [ready, clients, directors]);

  const lines = {
    gst: gstReady
      ? (() => {
          const s = monthSummary(gst, currentMonth());
          return gst.clients.length === 0
            ? "No GST clients yet"
            : `${s.total} clients · ${s.notFiled} not filed this month`;
        })()
      : null,
    mca: ready
      ? clients.length === 0
        ? "No companies yet"
        : `${clients.length} ${clients.length === 1 ? "company" : "companies"} · ${mca?.overdue ?? 0} overdue`
      : null,
    tasks: tasksReady
      ? (() => {
          const s = taskSummary(tasks.rows, isoToday());
          return tasks.rows.length === 0 ? "No tasks yet" : `${s.pending} pending · ${s.overdue} overdue`;
        })()
      : null,
  };

  const tools = ORDER.map((id) => TOOLS.find((t) => t.id === id));

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-[3.25rem] sm:leading-[1.05]">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.id}
              href={tool.href}
              className="group flex min-h-48 flex-col rounded-3xl border-2 border-dashed border-primary/25 p-6 transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="liquid-metal flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <Icon className="size-6" aria-hidden />
                </span>
                <ArrowRight
                  className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary"
                  aria-hidden
                />
              </span>
              <span className="mt-5 font-heading text-2xl font-semibold">{tool.title}</span>
              <span className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{tool.description}</span>
              {lines[tool.id] ? (
                <span className="mt-auto pt-4 text-sm font-medium text-primary">{lines[tool.id]}</span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
