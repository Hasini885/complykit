import { daysBetween, midnight, today } from "@/lib/dates";
import { computeClientHealth } from "@/lib/portfolio/health";
import { DEFAULT_WINDOW, clientSchedule, firstFyEndingYear, resolveClientYear } from "@/lib/portfolio/schedule";
import { directorsForClient, kycStatus } from "@/lib/portfolio/directors";
import { sortClients } from "@/lib/portfolio/clients";
/** Due within this many days counts as "due soon", matching the portfolio page. */
export const DUE_SOON_DAYS = 30;

export function bucketFor(item, asOf) {
  if (item.filedOn) return "completed";
  const days = daysBetween(asOf, item.due);
  if (days < 0) return "overdue";
  if (days <= DUE_SOON_DAYS) return "due-soon";
  return "upcoming";
}

export function buildPortfolioReport(clients, directors, opts = {}) {
  const asOf = midnight(opts.asOf ?? today());
  const scope = opts.clientId ? (clients.find((c) => c.id === opts.clientId) ?? null) : null;
  // An unknown id means an empty report, never a silent fall-back to the whole firm.
  const inScope = opts.clientId ? (scope ? [scope] : []) : sortClients(clients);

  const sections = inScope.map((client) => {
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
      .map((item) => ({
        client,
        item,
        bucket: bucketFor(item, asOf),
        days: daysBetween(asOf, item.due),
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
  const count = (b) => all.filter((i) => i.bucket === b).length;
  const exceptions = all
    .filter((i) => i.bucket === "overdue" || i.bucket === "due-soon")
    .sort((a, b) => a.days - b.days || a.client.name.localeCompare(b.client.name));

  const kycExceptions = new Map();
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
    kycExceptions: [...kycExceptions.values()].sort((a, b) => a.director.name.localeCompare(b.director.name)),
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
