import { sections } from "@/data/sections";
import { dueDates } from "@/data/due-dates";
import { allNavItems } from "@/config/navigation";
import { COMPANY_TYPES } from "@/lib/dates";
import { matchesTerms, normalise, sectionHaystack, terms } from "@/lib/search";

/** Calculators on /tools, kept here so the palette can jump straight to one. */
const TOOLS = [
  {
    id: "filing-fee",
    badge: null,
    title: "Filing fee calculator",
    subtitle: "The normal, on-time MCA fee by nominal share capital",
    keywords: "normal fee slab share capital 200 300 400 500 600 registration offices fees rules",
  },
  {
    id: "late-fee",
    badge: "s.403",
    title: "Late filing fee calculator",
    subtitle: "Normal fee by capital, plus the additional fee for a delay",
    keywords: "penalty additional fee late filing cost 100 per day slab multiple rupees",
  },
  {
    id: "dir3-kyc",
    badge: null,
    title: "DIR-3 KYC fee calculator",
    subtitle: "Flat fee if filed after the triennial cycle due date",
    keywords: "dir-3 kyc flat fee 5000 din deactivation reactivation triennial 30 june",
  },
  {
    id: "penalty",
    badge: null,
    title: "Penalty estimator",
    subtitle: "Statutory penalty for a chosen violation, company and officer-in-default",
    keywords: "violation fine penalty officer in default aoc-4 mgt-7 auditor sbo agm board report",
  },
  {
    id: "deadline",
    badge: null,
    title: "Deadline from an event",
    subtitle: "Event date plus the days allowed, giving the last date",
    keywords: "due date days counter 15 30 60 180 last date event resolution allotment",
  },
  {
    id: "board-meetings",
    badge: "s.173",
    title: "Board meeting gap check",
    subtitle: "Four meetings a year, no more than 120 days apart",
    keywords: "board meeting 120 days gap cadence quorum OPC small dormant 90 days",
  },
];

export const SEARCH_GROUPS = ["Sections", "Due dates", "Tools", "Pages"];
/**
 * One flat, pre-built index over every dataset.
 *
 * Built once at module load from static data, so the palette does no work on
 * open. Each entry carries an href that lands on something specific — a form
 * opens its detail sheet, a section opens its own — rather than dropping the
 * user on a list page to search again.
 */
export const searchIndex = [
  ...sections.map((s) => ({
    id: `section:${s.id}`,
    group: "Sections",
    badge: `s.${s.number}`,
    title: s.title,
    subtitle: s.penalty ? s.penalty.summary : s.theme,
    href: `/sections?section=${s.id}`,
    haystack: sectionHaystack(s),
  })),

  ...dueDates.map((d) => ({
    id: `due:${d.id}`,
    group: "Due dates",
    badge: d.formCode,
    title: d.title,
    subtitle: `${d.section} · ${d.category}`,
    href: "/due-dates",
    haystack: [
      d.title,
      d.formCode ?? "",
      d.section,
      d.category,
      d.note,
      d.rule.kind === "cadence" ? d.rule.description : "",
      // Findable by the entity types it applies to.
      ...d.appliesTo.map((t) => COMPANY_TYPES.find((c) => c.value === t)?.label ?? t),
    ].join(" "),
  })),

  ...TOOLS.map((t) => ({
    id: `tool:${t.id}`,
    group: "Tools",
    badge: t.badge,
    title: t.title,
    subtitle: t.subtitle,
    href: `/tools#${t.id}`,
    haystack: `${t.title} ${t.subtitle} ${t.keywords}`,
  })),

  ...allNavItems.map((n) => ({
    id: `page:${n.href}`,
    group: "Pages",
    badge: null,
    title: n.title,
    subtitle: n.description,
    href: n.href,
    haystack: `${n.title} ${n.description}`,
  })),
];

const byId = new Map(searchIndex.map((i) => [i.id, i]));

export function getSearchItem(id) {
  return byId.get(id) ?? null;
}

/**
 * Relevance score for one item. 0 means "hide".
 *
 * cmdk sorts by this, so the ordering rules live here:
 *   - an exact badge match ("aoc-4", "s.137") always wins
 *   - a badge prefix match ranks above a title match
 *   - a title match ranks above a body-text match
 */
export function scoreItem(item, query) {
  if (terms(query).length === 0) return 1;
  if (!matchesTerms(item.haystack, query)) return 0;

  const q = normalise(query);
  const squash = (s) => normalise(s).replace(/ /g, "");
  const badge = item.badge ? normalise(item.badge) : "";
  const qSquashed = q.replace(/ /g, "");

  if (badge && (badge === q || squash(item.badge) === qSquashed)) return 100;
  if (badge && (badge.startsWith(q) || squash(item.badge).startsWith(qSquashed))) return 50;
  if (normalise(item.title).includes(q)) return 25;
  return 10;
}

export function searchAll(query) {
  return searchIndex
    .map((item) => ({ item, score: scoreItem(item, query) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item);
}
