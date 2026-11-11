import { financialYearLabel, formatDate, parseIsoDate } from "@/lib/dates";
import { auditorAnchorFy, auditorTermOf, firstFyEndingYear, resolveClientYear } from "@/lib/portfolio/schedule";
import { agmFyOf } from "@/lib/portfolio/clients";
import { withFiling, withoutFiling } from "@/lib/portfolio/filings";
import { AUDITOR_TERM_YEARS } from "@/lib/resolve-due-dates";
/** "10/10/2025": the day/month/year style the ADT-1 note is written in. */
function dmy(d) {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/** The current auditor's term, or null when no appointment year can be worked out. */
export function auditorTerm(client, asOf) {
  const fromFy = auditorAnchorFy(client);
  if (fromFy === null) return null;
  const years = auditorTermOf(client);
  const untilFy = fromFy + years;
  const first = firstFyEndingYear(client);
  const next = resolveClientYear(client, [], untilFy, { asOf }).find((i) => i.source.id === "adt-1");
  return {
    srn: client.adt1Srn ?? "",
    filedOn: client.adt1FiledOn ? parseIsoDate(client.adt1FiledOn) : null,
    fromFy,
    years,
    untilFy,
    untilAgmNumber: first !== null ? untilFy - first + 1 : null,
    nextDue: next?.due ?? null,
  };
}

/** The year whose AGM made the appointment running in `fy`: the appointment year, then every term after it. */
export function appointmentFyFor(client, fy) {
  const anchor = auditorAnchorFy(client);
  if (anchor === null) return null;
  if (fy <= anchor) return anchor;
  const term = auditorTermOf(client);
  return anchor + Math.floor((fy - anchor) / term) * term;
}

/**
 * The company with its auditor appointed at this year's AGM for this many
 * years (1 to 5, Section 139(1)). A different appointment year means the SRN
 * and date kept for the old appointment no longer describe the current one.
 */
export function withAuditorTerm(client, appointedFy, years, now = new Date()) {
  const same = auditorAnchorFy(client) === appointedFy;
  const term = clampTerm(years);
  return {
    ...client,
    auditorAppointedAtAgmFy: appointedFy,
    auditorTermYears: term,
    ...(same ? {} : { adt1Srn: undefined, adt1FiledOn: null }),
    ...(client.filings ? { filings: withYearsOnFiling(client.filings, appointedFy, term) } : {}),
    updatedAt: now.toISOString(),
  };
}

function clampTerm(years) {
  return Math.min(AUDITOR_TERM_YEARS, Math.max(1, Math.trunc(years)));
}

function withYearsOnFiling(filings, fy, years) {
  const key = `adt-1|${fy}|`;
  return filings.map((f) => (f.key === key ? { ...f, years } : f));
}

/** Every recorded ADT-1 for a subsequent auditor. */
export function auditorAppointments(client) {
  const found = [];
  for (const f of client.filings ?? []) {
    const m = /^adt-1\|(\d+)\|$/.exec(f.key);
    if (!m) continue;
    found.push({
      fy: Number(m[1]),
      years: clampTerm(f.years ?? auditorTermOf(client)),
      srn: f.srn,
      filedOn: parseIsoDate(f.filedOn),
    });
  }
  return found;
}

/** The recorded ADT-1 whose appointment covers this year; the latest, where two overlap. */
export function appointmentCovering(client, fy) {
  return (
    auditorAppointments(client)
      .filter((a) => a.fy <= fy && fy < a.fy + a.years)
      .sort((a, b) => b.fy - a.fy)[0] ?? null
  );
}

/**
 * The company with a subsequent auditor's ADT-1 recorded: its SRN, date of
 * filing and years appointed. The filing date gives the AGM it reports (never
 * earlier than the company's first). An appointment from before the current
 * one is only added to the record; it does not move the running term back.
 * `replacesFy` is the appointment being corrected, if any.
 */
export function withAdt1Appointment(client, input, years, replacesFy = null, now = new Date()) {
  const filed = parseIsoDate(input.filedOn);
  if (!filed) return client;
  const fy = Math.max(agmFyOf(filed), firstFyEndingYear(client) ?? -Infinity);
  const term = clampTerm(years);
  const anchor = auditorAnchorFy(client);
  const cleared =
    replacesFy !== null && replacesFy !== fy ? withoutFiling(client, `adt-1|${replacesFy}|`, now) : client;
  const recorded = withFiling(cleared, `adt-1|${fy}|`, input, now);
  const filings = withYearsOnFiling(recorded.filings ?? [], fy, term);
  if (anchor !== null && fy < anchor) return { ...recorded, filings };
  return {
    ...withAuditorTerm({ ...recorded, filings }, fy, term, now),
    // The record above now holds these; the older single fields would only disagree with it.
    adt1Srn: undefined,
    adt1FiledOn: null,
  };
}

/** "6th" */
export function ordinal(n) {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
}

/**
 * Why ADT-1 is NA in this year: the appointment that covers it, with its SRN,
 * and when the next one falls due. "Auditor appointed for 3 years at the AGM
 * for FY 2024–25 (SRN AB1234567 filed dated 10/10/2025), next due 15/10/2028".
 * Says "taken as" while nobody has entered the term, since five years is only
 * the assumption.
 */
export function adtNaReason(client, fy, asOf) {
  const anchor = auditorAnchorFy(client);
  if (anchor === null) return "auditor's term running";
  const recorded = appointmentCovering(client, fy);
  if (!recorded && fy < anchor) return `Auditor appointed later, at the AGM for ${financialYearLabel(anchor)}`;
  const at = recorded?.fy ?? appointmentFyFor(client, fy);
  const term = auditorTerm(
    {
      ...client,
      auditorAppointedAtAgmFy: at,
      auditorTermYears: recorded?.years ?? client.auditorTermYears,
      // The SRN kept on the company belongs to its appointment year, not to later renewals.
      ...(at === anchor ? {} : { adt1Srn: undefined, adt1FiledOn: null }),
    },
    asOf,
  );
  const srn = recorded?.srn ?? term.srn;
  const filedOn = recorded?.filedOn ?? term.filedOn;
  const years = `${term.years} year${term.years === 1 ? "" : "s"}`;
  const appointed =
    recorded || client.auditorTermYears ? `Auditor appointed for ${years}` : `Auditor taken as appointed for ${years}`;
  const proof = srn
    ? ` (SRN ${srn}${filedOn ? ` filed dated ${dmy(filedOn)}` : ""})`
    : filedOn
      ? ` (ADT-1 filed dated ${dmy(filedOn)})`
      : "";
  const next = term.nextDue ? `next due ${dmy(term.nextDue)}` : `next ADT-1 for ${financialYearLabel(term.untilFy)}`;
  return `${appointed} at the AGM for ${financialYearLabel(at)}${proof}, ${next}`;
}

/**
 * The plain-words summary shown with the ADT-1 entry: appointed at the AGM
 * for one year, up to the conclusion of the Nth AGM, next ADT-1 due then.
 */
export function auditorTermSummary(client, asOf) {
  const term = auditorTerm(client, asOf);
  if (!term) return null;
  const until = term.untilAgmNumber
    ? `the conclusion of the ${ordinal(term.untilAgmNumber)} AGM (for ${financialYearLabel(term.untilFy)})`
    : `the conclusion of the AGM for ${financialYearLabel(term.untilFy)}`;
  const next = term.nextDue ? `, so the next ADT-1 is due by ${formatDate(term.nextDue)}` : "";
  const between =
    term.years > 1 ? ` ADT-1 is NA for the ${term.years - 1} year${term.years === 2 ? "" : "s"} in between.` : "";
  return `Appointed at the AGM for ${financialYearLabel(term.fromFy)} for ${term.years} year${term.years === 1 ? "" : "s"}, up to ${until}${next}.${between}`;
}
