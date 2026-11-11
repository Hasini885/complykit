import { makeDate, midnight, parseIsoDate, today } from "@/lib/dates";
import { newId } from "@/lib/portfolio/clients";
import { checkSrn, normaliseSrn } from "@/lib/portfolio/srn";
import { formatMobile, normaliseMobile } from "@/lib/portfolio/mobile";

export { formatMobile, normaliseMobile };

/* ------------------------------------------------------------------ */
/* DIR-3 KYC — triennial cycle                                         */
/* ------------------------------------------------------------------ */

/**
 * The Companies (Appointment and Qualification of Directors) Amendment Rules,
 * 2025, effective 31 March 2026, changed DIR-3 KYC from an annual filing due
 * 30 September to a filing due once every three consecutive financial years,
 * on or before 30 JUNE of the year following the third financial year.
 *
 * The cycle is anchored to the financial year in which the DIN was ALLOTTED,
 * not to the date of the last filing — so filing early does not shift the next
 * due date.
 *
 * Worked example: a DIN allotted 15 July 2023 falls in FY 2023-24, which ends
 * 31 March 2024. The three consecutive years are FY 2023-24, 2024-25 and
 * 2025-26, so the first due date is 30 June 2026, then 30 June 2029, and so on.
 *
 * UNVERIFIED: confirm against the current rule before relying on it.
 */
export const KYC_DUE_MONTH = 6;
export const KYC_DUE_DAY = 30;
export const KYC_CYCLE_YEARS = 3;
export const KYC_LATE_FEE = 5000;

/** Calendar year in which the financial year containing `date` ends. */
export function financialYearEndYear(date) {
  // FY runs 1 April to 31 March, so Jan-Mar belong to the FY ending that year.
  return date.getMonth() <= 2 ? date.getFullYear() : date.getFullYear() + 1;
}

/** The first DIR-3 KYC due date for a DIN allotted on the given date. */
export function firstKycDueDate(dinAllottedOn) {
  const fyEnd = financialYearEndYear(midnight(dinAllottedOn));
  // Three consecutive FYs: the one of allotment, plus two more.
  const thirdFyEndYear = fyEnd + (KYC_CYCLE_YEARS - 1);
  return makeDate(thirdFyEndYear, KYC_DUE_MONTH, KYC_DUE_DAY);
}

/** Every due date in the cycle, as a lazy sequence up to `limit` entries. */
export function kycDueDates(dinAllottedOn, limit = 8) {
  const first = firstKycDueDate(dinAllottedOn);
  return Array.from({ length: limit }, (_, i) =>
    makeDate(first.getFullYear() + i * KYC_CYCLE_YEARS, KYC_DUE_MONTH, KYC_DUE_DAY),
  );
}

/**
 * Where a director stands in the current KYC cycle.
 *
 * A filing is attributed to the first due date falling on or after it, because
 * that is the deadline it was made for. The director is compliant when the most
 * recent deadline that has already passed was covered by such a filing.
 */
export function kycStatus(director, asOf = today()) {
  const allotted = parseIsoDate(director.dinAllottedOn);
  if (!allotted) return null;

  const reference = midnight(asOf);
  const dates = kycDueDates(allotted, 12);
  const previousDueOn = [...dates].reverse().find((d) => d.getTime() < reference.getTime()) ?? null;
  const dueOn = dates.find((d) => d.getTime() >= reference.getTime()) ?? dates[dates.length - 1];

  const lastFiledOn = director.lastKycFiledOn ? parseIsoDate(director.lastKycFiledOn) : null;

  /*
   * Which due date a filing counts towards: the first one falling on or after
   * the filing date. People file BEFORE a deadline, so a filing on 20 May 2026
   * is a filing for the 30 June 2026 cycle — not for the one after it.
   */
  const coveredDueOn = lastFiledOn === null ? null : (dates.find((x) => x.getTime() >= lastFiledOn.getTime()) ?? null);

  let state;
  if (previousDueOn === null) {
    // No deadline has passed yet.
    state = coveredDueOn !== null && coveredDueOn.getTime() === dueOn.getTime() ? "filed" : "not-yet-due";
  } else if (coveredDueOn !== null && coveredDueOn.getTime() >= previousDueOn.getTime()) {
    // The most recent deadline that passed was covered by a filing.
    state = "filed";
  } else {
    state = "overdue";
  }

  // Inside the run-up to an unmet due date, call it "due" rather than "overdue":
  // the deadline has not actually passed.
  if (state === "not-yet-due" && daysBetweenDates(reference, dueOn) <= 90) {
    state = "due";
  }

  return {
    state,
    dueOn,
    previousDueOn,
    lastFiledOn,
    daysUntilDue: daysBetweenDates(reference, dueOn),
  };
}

/** True where the director needs to act this cycle. */
export function kycPending(director, asOf = today()) {
  const status = kycStatus(director, asOf);
  return status !== null && (status.state === "due" || status.state === "overdue");
}

function daysBetweenDates(from, to) {
  return Math.round((midnight(to).getTime() - midnight(from).getTime()) / 86_400_000);
}

/* ------------------------------------------------------------------ */
/* Section 165 — limit on number of directorships                      */
/* ------------------------------------------------------------------ */

/**
 * Section 165(1): a person may not hold office as director in more than
 * twenty companies at the same time, of which not more than ten may be public
 * companies.
 *
 * For counting the ten-company limit, a private company that is a holding or
 * subsidiary of a public company is treated as a public company. That nuance
 * is NOT modelled here, and the count only sees companies inside this
 * portfolio — a director's other boards are invisible to us. The UI must say so.
 */
export const SECTION_165_TOTAL_LIMIT = 20;
export const SECTION_165_PUBLIC_LIMIT = 10;

/** Directorships currently in force (cessation not recorded, or in the future). */
export function activeDirectorships(director, asOf = today()) {
  const reference = midnight(asOf);
  return director.directorships.filter((ds) => {
    if (!ds.cessationOn) return true;
    const ceased = parseIsoDate(ds.cessationOn);
    return ceased === null || ceased.getTime() > reference.getTime();
  });
}

export function countDirectorships(director, clients, asOf = today()) {
  const byId = new Map(clients.map((c) => [c.id, c]));
  const active = activeDirectorships(director, asOf);

  const total = active.length;
  const publicCount = active.filter((ds) => byId.get(ds.clientId)?.type === "public").length;

  return {
    total,
    public: publicCount,
    overTotalLimit: total > SECTION_165_TOTAL_LIMIT,
    overPublicLimit: publicCount > SECTION_165_PUBLIC_LIMIT,
    overAnyLimit: total > SECTION_165_TOTAL_LIMIT || publicCount > SECTION_165_PUBLIC_LIMIT,
  };
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

/** The DIN a director is recorded under at one company: that seat's own, else their main DIN. */
export function dinAt(director, clientId) {
  const seat = director.directorships.find((ds) => ds.clientId === clientId && ds.din);
  return seat?.din ?? director.din;
}

/** Every DIN recorded for a director: the main one first, then any per-company ones. */
export function allDins(director) {
  const dins = [director.din, ...director.directorships.map((ds) => ds.din ?? "")].map((d) => d.trim());
  return [...new Set(dins.filter(Boolean))];
}

/**
 * Seats as stored: a seat DIN is trimmed, and dropped when it is just the
 * main DIN again, so "absent" keeps meaning "the main DIN".
 */
function cleanSeats(draft) {
  const main = draft.din.trim();
  return draft.directorships.map(({ din, ...ds }) => {
    const own = din?.trim() ?? "";
    return own && own !== main ? { ...ds, din: own } : ds;
  });
}

export function directorsForClient(directors, clientId, asOf = today()) {
  return directors.filter((d) => activeDirectorships(d, asOf).some((ds) => ds.clientId === clientId));
}

export function clientsForDirector(director, clients, asOf = today()) {
  const byId = new Map(clients.map((c) => [c.id, c]));
  return activeDirectorships(director, asOf)
    .map((ds) => byId.get(ds.clientId))
    .filter((c) => c !== undefined);
}

/** Directors sitting on more than one board inside this portfolio. */
export function onMultipleBoards(directors, asOf = today()) {
  return directors.filter((d) => activeDirectorships(d, asOf).length > 1);
}

const DIN = /^\d{8}$/;

/** The authorised-person fields as stored: consultant details only when a consultant is named. */
function authorisedFields(draft) {
  if (draft.isAuthorisedPerson === undefined) {
    return { isAuthorisedPerson: undefined, consultantName: undefined, consultantMobile: undefined };
  }
  const consultant = draft.isAuthorisedPerson === false;
  return {
    isAuthorisedPerson: draft.isAuthorisedPerson,
    consultantName: consultant ? draft.consultantName?.trim() || undefined : undefined,
    consultantMobile: consultant ? normaliseMobile(draft.consultantMobile ?? "") || undefined : undefined,
  };
}

/** Directors' names are kept in capitals, however they were typed. */
export function directorName(raw) {
  return raw.trim().replace(/\s+/g, " ").toUpperCase();
}

export function validateDirector(draft, existing, id) {
  const errors = [];
  const din = draft.din.trim();

  if (draft.name.trim() === "") errors.push({ field: "name", message: "Enter the director's name." });

  if (din === "") {
    errors.push({ field: "din", message: "Enter the DIN." });
  } else if (!DIN.test(din)) {
    errors.push({ field: "din", message: "A DIN is exactly 8 digits." });
  } else if (existing.some((d) => d.id !== id && allDins(d).includes(din))) {
    errors.push({ field: "din", message: "Another director already has that DIN." });
  }

  // Dates at each company: cessation cannot come before the appointment.
  for (const ds of draft.directorships) {
    if (!ds.cessationOn) continue;
    const ceased = parseIsoDate(ds.cessationOn);
    const appointed = parseIsoDate(ds.appointedOn);
    if (!ceased) {
      errors.push({ field: "directorships", message: "That date of cessation is not valid." });
    } else if (appointed && ceased.getTime() < appointed.getTime()) {
      errors.push({ field: "directorships", message: "The date of cessation is before the date of appointment." });
    }
  }

  // Per-company DINs: eight digits each, and not another person's.
  for (const ds of draft.directorships) {
    const own = ds.din?.trim() ?? "";
    if (!own || own === din) continue;
    if (!DIN.test(own)) {
      errors.push({ field: "directorships", message: `The DIN for a company must be exactly 8 digits (${own}).` });
    } else if (existing.some((d) => d.id !== id && allDins(d).includes(own))) {
      errors.push({ field: "directorships", message: `DIN ${own} belongs to another director.` });
    }
  }

  // Optional: without it the DIR-3 KYC cycle cannot be worked out, so that
  // director simply has no KYC due date shown. A date given must be real.
  if (draft.dinAllottedOn && !parseIsoDate(draft.dinAllottedOn)) {
    errors.push({ field: "dinAllottedOn", message: "That DIN allotment date is not valid." });
  }
  if (draft.lastKycFiledOn && !parseIsoDate(draft.lastKycFiledOn)) {
    errors.push({ field: "lastKycFiledOn", message: "That KYC date is not valid." });
  }
  const srnProblem = draft.lastKycSrn ? checkSrn(draft.lastKycSrn) : null;
  if (srnProblem) errors.push({ field: "lastKycSrn", message: srnProblem });

  if (draft.isAuthorisedPerson === false) {
    if (!draft.consultantName?.trim()) {
      errors.push({ field: "consultantName", message: "Enter the consultant's name." });
    }
    const mobile = draft.consultantMobile?.trim() ?? "";
    if (mobile === "") {
      errors.push({ field: "consultantMobile", message: "Enter the consultant's mobile number." });
    } else if (!normaliseMobile(mobile)) {
      errors.push({ field: "consultantMobile", message: "Enter a 10-digit mobile number starting 6–9." });
    }
  }

  return errors;
}

export function newDirector(draft, now = new Date()) {
  const iso = now.toISOString();
  return {
    id: newId(),
    name: directorName(draft.name),
    din: draft.din.trim(),
    dinAllottedOn: draft.dinAllottedOn,
    lastKycFiledOn: draft.lastKycFiledOn ?? null,
    lastKycSrn: draft.lastKycFiledOn ? normaliseSrn(draft.lastKycSrn ?? "") || null : null,
    email: draft.email?.trim() || undefined,
    ...authorisedFields(draft),
    directorships: cleanSeats(draft),
    createdAt: iso,
    updatedAt: iso,
  };
}

export function applyDirectorDraft(director, draft, now = new Date()) {
  return {
    ...director,
    name: directorName(draft.name),
    din: draft.din.trim(),
    dinAllottedOn: draft.dinAllottedOn,
    lastKycFiledOn: draft.lastKycFiledOn ?? null,
    lastKycSrn: draft.lastKycFiledOn ? normaliseSrn(draft.lastKycSrn ?? "") || null : null,
    email: draft.email?.trim() || undefined,
    ...authorisedFields(draft),
    directorships: cleanSeats(draft),
    updatedAt: now.toISOString(),
  };
}
