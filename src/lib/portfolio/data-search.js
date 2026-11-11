import { dueDates } from "@/data/due-dates";
import { financialYearLabel, formatDate, parseIsoDate } from "@/lib/dates";
import { matchesTerms, normalise, terms } from "@/lib/search";
import { typeLabel } from "@/lib/portfolio/clients";
import { allDins } from "@/lib/portfolio/directors";
import { formatMobile } from "@/lib/portfolio/mobile";
/**
 * Search over the user's own records, for the command palette: companies,
 * directors, consultants and the filings recorded against them (by SRN or
 * acknowledgement number). Pure, so it is tested without a browser; the
 * palette rebuilds it whenever the portfolio changes.
 */

export const DATA_GROUPS = ["Companies", "Directors", "Consultants", "Filings"];
const FORM_CODE = new Map(dueDates.map((d) => [d.id, d.formCode ?? d.title]));

/** "AOC-4" for a filing key like "aoc-4|2026|"; the due's title where it has no form. */
function formOf(sourceId) {
  return FORM_CODE.get(sourceId) ?? sourceId.toUpperCase();
}

export function buildDataIndex(clients, directors, consultants) {
  const items = [];
  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  const consultantName = new Map(consultants.map((c) => [c.id, c.name]));

  for (const c of clients) {
    const consultant = c.consultantId ? consultantName.get(c.consultantId) : undefined;
    items.push({
      id: `data:company:${c.id}`,
      group: "Companies",
      badge: c.cin,
      title: c.name,
      subtitle: [
        typeLabel(c.type),
        c.mobile ? formatMobile(c.mobile) : "",
        c.email ?? "",
        consultant ? `Consultant: ${consultant}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      target: { kind: "company", clientId: c.id },
      haystack: [
        c.name,
        c.cin,
        c.mobile ?? "",
        c.email ?? "",
        c.registeredOffice,
        consultant ?? "",
        typeLabel(c.type),
      ].join(" "),
    });

    for (const f of c.filings ?? []) {
      if (!f.srn) continue;
      const [sourceId, fy, period] = f.key.split("|");
      const form = formOf(sourceId);
      const year = Number(fy) ? financialYearLabel(Number(fy)) : "";
      const filed = parseIsoDate(f.filedOn);
      items.push({
        id: `data:filing:${c.id}:${f.key}`,
        group: "Filings",
        badge: f.srn,
        title: `${form}${year ? ` · ${year}` : ""}${period ? ` · ${period}` : ""}`,
        subtitle: `${c.name}${filed ? ` · filed ${formatDate(filed)}` : ""}`,
        target: { kind: "company", clientId: c.id },
        haystack: [f.srn, form, year, period ?? "", c.name, c.cin].join(" "),
      });
    }
  }

  for (const d of directors) {
    const boards = d.directorships.map((ds) => clientName.get(ds.clientId)).filter((n) => !!n);
    const dins = allDins(d);
    items.push({
      id: `data:director:${d.id}`,
      group: "Directors",
      badge: dins.join(", "),
      title: d.name,
      subtitle: boards.length > 0 ? boards.join(", ") : "No company yet",
      target: { kind: "href", href: "/directors" },
      haystack: [d.name, ...dins, d.email ?? "", d.consultantName ?? "", d.consultantMobile ?? "", ...boards].join(" "),
    });
    if (d.lastKycSrn) {
      const filed = d.lastKycFiledOn ? parseIsoDate(d.lastKycFiledOn) : null;
      items.push({
        id: `data:kyc:${d.id}`,
        group: "Filings",
        badge: d.lastKycSrn,
        title: `DIR-3 KYC · ${d.name}`,
        subtitle: `DIN ${dins.join(", ")}${filed ? ` · filed ${formatDate(filed)}` : ""}`,
        target: { kind: "href", href: "/directors" },
        haystack: [d.lastKycSrn, "DIR-3 KYC", d.name, ...dins].join(" "),
      });
    }
  }

  for (const c of consultants) {
    const companies = clients.filter((x) => x.consultantId === c.id).map((x) => x.name);
    items.push({
      id: `data:consultant:${c.id}`,
      group: "Consultants",
      badge: formatMobile(c.mobile),
      title: c.name,
      subtitle: [c.firm ?? "", `${companies.length} ${companies.length === 1 ? "company" : "companies"}`]
        .filter(Boolean)
        .join(" · "),
      target: { kind: "href", href: "/consultants" },
      haystack: [c.name, c.mobile, c.email ?? "", c.firm ?? "", ...companies].join(" "),
    });
  }
  return items;
}

/**
 * Ranks a record against the query, on the same scale as the static index
 * (0 = no match): an exact identifier first, then one starting with the
 * query, then a name containing it. Digits typed with spaces ("98765 43210")
 * still find the stored mobile.
 */
export function scoreDataItem(item, query) {
  if (terms(query).length === 0) return 0; // nothing of the user's shows until they type
  const squash = (s) => normalise(s).replace(/ /g, "");
  const q = squash(query);
  const hay = squash(item.haystack);
  if (!matchesTerms(item.haystack, query) && !hay.includes(q)) return 0;
  const ids = (item.badge ?? "").split(",").map(squash);
  if (ids.some((b) => b === q)) return 120;
  if (ids.some((b) => b.startsWith(q))) return 60;
  if (squash(item.title).includes(q)) return 30;
  return 12;
}
