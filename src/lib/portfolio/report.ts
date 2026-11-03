import { daysBetween, midnight, today } from "@/lib/dates";
import type { ResolvedDueDate } from "@/lib/resolve-due-dates";
import { computeClientHealth, type ClientHealth } from "@/lib/portfolio/health";
import { DEFAULT_WINDOW, clientSchedule, firstFyEndingYear, resolveClientYear } from "@/lib/portfolio/schedule";
import { directorsForClient, kycStatus, type KycStatus } from "@/lib/portfolio/directors";
import { sortClients } from "@/lib/portfolio/clients";
import type { Client, Director } from "@/lib/portfolio/types";

/**
 * The firm-wide (or single-client) compliance MIS.
 *
 * Built from the same rolling schedule and health as the portfolio page, so
 * the printed report can never disagree with the screen. Pure: no React, no
 * browser, so it is tested directly.
 */

export type ReportBucket = "overdue" | "due-soon" | "upcoming" | "completed";

export type ReportItem = {
  client: Client;
  item: ResolvedDueDate;
  bucket: ReportBucket;
  /** Days from the report date: negative when overdue. */
  days: number;
};

export type ClientSection = {
  client: Client;
  health: ClientHealth;
  items: ReportItem[];
  /** Standing requirements with no single date (Board meeting rhythm, KYC prompts). */
  standing: ResolvedDueDate[];
  directors: { director: Director; kyc: KycStatus | null }[];
};

export type PortfolioReport = {
  generatedOn: Date;
  /** Null for the firm-wide report. */
  scope: Client | null;
  sections: ClientSection[];
  /** Overdue and due within 30 days, across every client, most urgent first. */
  exceptions: ReportItem[];
  /**
   * Directors who missed an earlier KYC cycle: their DIN may already be
   * deactivated, however far back that deadline was. Once per director, with
   * every in-scope company they sit on.
   */
  kycExceptions: { director: Director; kyc: KycStatus; companies: Client[] }[];
  totals: Record<ReportBucket, number> & { companies: number; averageHealth: number | null };
  window: typeof DEFAULT_WINDOW;
};

/** Due within this many days counts as "due soon", matching the portfolio page. */
export const DUE_SOON_DAYS = 30;

export function bucketFor(item: ResolvedDueDate, asOf: Date): ReportBucket {
  if (item.filedOn) return "completed";
  const days = daysBetween(asOf, item.due!);
  if (days < 0) return "overdue";
  if (days <= DUE_SOON_DAYS) return "due-soon";
  return "upcoming";
}

export function buildPortfolioReport(
  clients: Client[],
  directors: Director[],
  opts: {
    clientId?: string | null;
    asOf?: Date;
    /**
     * One financial year (by the calendar year its 31 March falls in) instead
     * of the rolling window: every due belonging to that year, bucketed
     * against `asOf` as usual. Null or absent keeps the rolling window.
     */
    fyEndingYear?: number | null;
  } = {},
): PortfolioReport {
  const asOf = midnight(opts.asOf ?? today());
  const scope = opts.clientId ? (clients.find((c) => c.id === opts.clientId) ?? null) : null;
  // An unknown id means an empty report, never a silent fall-back to the whole firm.
  const inScope = opts.clientId ? (scope ? [scope] : []) : sortClients(clients);

  const sections: ClientSection[] = inScope.map((client) => {
    const fy = opts.fyEndingYear ?? null;
    const first = firstFyEndingYear(client);
    const schedule =
      fy === null
        ? clientSchedule(client, directors, asOf)
        : // Years before the company existed have nothing in them.
          first !== null && fy < first
          ? []
          : resolveClientYear(client, directors, fy, { asOf });
    const items = schedule
      .filter((r) => r.due !== null)
      .map<ReportItem>((item) => ({
        client,
        item,
        bucket: bucketFor(item, asOf),
        days: daysBetween(asOf, item.due!),
      }));
    return {
      client,
      health: computeClientHealth(client, asOf, directors),
      items,
      standing: schedule.filter((r) => r.due === null),
      directors: directorsForClient(directors, client.id, asOf).map((director) => ({
        director,
        kyc: kycStatus(director, asOf),
      })),
    };
  });

  const all = sections.flatMap((s) => s.items);
  const count = (b: ReportBucket) => all.filter((i) => i.bucket === b).length;
  const exceptions = all
    .filter((i) => i.bucket === "overdue" || i.bucket === "due-soon")
    .sort((a, b) => a.days - b.days || a.client.name.localeCompare(b.client.name));

  const kycExceptions = new Map<string, PortfolioReport["kycExceptions"][number]>();
  for (const s of sections) {
    for (const { director, kyc } of s.directors) {
      if (kyc?.state !== "overdue") continue;
      const entry = kycExceptions.get(director.id) ?? { director, kyc, companies: [] };
      entry.companies.push(s.client);
      kycExceptions.set(director.id, entry);
    }
  }

  return {
    generatedOn: asOf,
    scope,
    sections,
    exceptions,
    kycExceptions: [...kycExceptions.values()].sort((a, b) =>
      a.director.name.localeCompare(b.director.name),
    ),
    totals: {
      companies: sections.length,
      averageHealth:
        sections.length === 0
          ? null
          : Math.round(sections.reduce((sum, s) => sum + s.health.score, 0) / sections.length),
      overdue: count("overdue"),
      "due-soon": count("due-soon"),
      upcoming: count("upcoming"),
      completed: count("completed"),
    },
    window: DEFAULT_WINDOW,
  };
}
