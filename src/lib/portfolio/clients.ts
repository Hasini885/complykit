import { COMPANY_TYPES, parseIsoDate, type CompanyType } from "@/lib/dates";
import type { CompanyProfile } from "@/lib/applicability";
import { MOBILE_ERROR, normaliseMobile } from "@/lib/portfolio/mobile";
import { normaliseSrn } from "@/lib/portfolio/srn";
import type { AuditorType, Client, ClientStatus, FilingRecord, PointOfContact } from "@/lib/portfolio/types";

/**
 * Client service. Pure functions over Client records — no storage, no React.
 * The provider composes these with a PortfolioRepository.
 */

export type ClientDraft = {
  name: string;
  cin: string;
  type: CompanyType;
  incorporatedOn: string;
  registeredOffice: string;
  status: ClientStatus;
  /** Required on the form; a 10-digit Indian mobile. Optional in the type for older records. */
  mobile?: string;
  /** Required on the form; validated as an email address. Optional in the type for older records. */
  email?: string;
  /** Reference: a consultant from the consultant master, or null. */
  consultantId?: string | null;
  /** The director who is the authorised person. */
  authorisedDirectorId?: string | null;
  /** The authorised person themself, or the consultant. */
  pointOfContact?: PointOfContact;
  /** The ADT-1 filed for the current (subsequent) auditor: its SRN and date. */
  adt1Srn?: string;
  adt1FiledOn?: string | null;
  lastAgmOn?: string | null;
  notes?: string;
  listed?: boolean;
  workingFyEndingYear?: number | null;
  authorisedCapital?: number;
  paidUpCapital?: number;
  turnover?: number;
  netWorth?: number;
  netProfit?: number;
  borrowings?: number;
  deposits?: number;
  llpContribution?: number;
  directorsCount?: number;
  msmeDuesOver45Days?: boolean;
  securitiesInDemat?: boolean;
  filesDpt3?: boolean;
  filesAdt1?: boolean;
  filesInc20a?: boolean;
  transferPricing?: boolean;
  auditorAppointedAtAgmFy?: number | null;
  auditorTermYears?: number | null;
  auditorType?: AuditorType;
  firstAuditorAppointedOn?: string | null;
};

export type ValidationError = { field: keyof ClientDraft; message: string };

/**
 * CIN is 21 characters: L/U + 5-digit industry code + 2-letter state + 4-digit
 * year + 3-letter ownership + 6-digit registration number.
 * LLPIN is 3 letters + 4 digits.
 */
const CIN = /^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/;
const LLPIN = /^[A-Z]{3}-?\d{4}$/;

export function validateClient(draft: ClientDraft, existing: Client[], id?: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const name = draft.name.trim();
  const cin = draft.cin.trim().toUpperCase();

  if (name === "") errors.push({ field: "name", message: "Enter the registered name." });
  if (name.length > 200) errors.push({ field: "name", message: "That name is too long." });

  if (cin === "") {
    errors.push({ field: "cin", message: "Enter the CIN or LLPIN." });
  } else if (draft.type === "llp") {
    if (!LLPIN.test(cin)) {
      errors.push({ field: "cin", message: "An LLPIN looks like AAB-1234." });
    }
  } else if (!CIN.test(cin)) {
    errors.push({
      field: "cin",
      message: "A CIN is 21 characters, e.g. U62099KA2019PTC128740.",
    });
  }

  if (existing.some((c) => c.id !== id && c.cin.toUpperCase() === cin && cin !== "")) {
    errors.push({ field: "cin", message: "Another client already uses that number." });
  }

  const incorporated = parseIsoDate(draft.incorporatedOn);
  if (!incorporated) {
    errors.push({ field: "incorporatedOn", message: "Enter a valid date of incorporation." });
  } else if (incorporated.getTime() > Date.now()) {
    errors.push({ field: "incorporatedOn", message: "That date is in the future." });
  }

  if (draft.registeredOffice.trim() === "") {
    errors.push({ field: "registeredOffice", message: "Enter the registered office." });
  }

  if (!draft.mobile || draft.mobile.trim() === "") {
    errors.push({ field: "mobile", message: "Enter the company's mobile number." });
  } else if (!normaliseMobile(draft.mobile)) {
    errors.push({ field: "mobile", message: MOBILE_ERROR });
  }

  const email = draft.email?.trim() ?? "";
  if (email === "") {
    errors.push({ field: "email", message: "Enter the company's email address." });
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push({ field: "email", message: "That email address is not valid." });
  }

  // Section 2(8): what is issued and paid up cannot exceed what the MOA authorises.
  if ((draft.authorisedCapital ?? 0) > 0 && (draft.paidUpCapital ?? 0) > (draft.authorisedCapital ?? 0)) {
    errors.push({ field: "paidUpCapital", message: "Paid-up capital cannot be more than the authorised capital." });
  }

  if (draft.auditorType === "first" && draft.firstAuditorAppointedOn) {
    const appointed = parseIsoDate(draft.firstAuditorAppointedOn);
    const inc = parseIsoDate(draft.incorporatedOn);
    if (!appointed) {
      errors.push({ field: "firstAuditorAppointedOn", message: "That date is not valid." });
    } else if (inc && appointed.getTime() < inc.getTime()) {
      errors.push({ field: "firstAuditorAppointedOn", message: "The first auditor is appointed after incorporation." });
    }
  }

  if (draft.auditorType === "subsequent" && draft.adt1FiledOn) {
    const filed = parseIsoDate(draft.adt1FiledOn);
    const inc = parseIsoDate(draft.incorporatedOn);
    if (!filed) errors.push({ field: "adt1FiledOn", message: "That date is not valid." });
    else if (inc && filed.getTime() < inc.getTime()) {
      errors.push({ field: "adt1FiledOn", message: "ADT-1 is filed after incorporation." });
    }
  }

  if (draft.lastAgmOn && !parseIsoDate(draft.lastAgmOn)) {
    errors.push({ field: "lastAgmOn", message: "That AGM date is not valid." });
  }

  for (const field of ["authorisedCapital", "paidUpCapital", "turnover", "netWorth", "netProfit", "borrowings", "deposits", "llpContribution", "directorsCount"] as const) {
    const v = draft[field];
    if (v !== undefined && (Number.isNaN(v) || v < 0)) {
      errors.push({ field, message: "Enter a figure of zero or more." });
    }
  }

  return errors;
}

export function newClient(draft: ClientDraft, now = new Date()): Client {
  const iso = now.toISOString();
  return withAdt1Filing({
    id: newId(),
    name: draft.name.trim(),
    cin: draft.cin.trim().toUpperCase(),
    type: draft.type,
    incorporatedOn: draft.incorporatedOn,
    registeredOffice: draft.registeredOffice.trim(),
    status: draft.status,
    mobile: normaliseMobile(draft.mobile ?? "") || undefined,
    email: draft.email?.trim() || undefined,
    consultantId: draft.consultantId ?? null,
    authorisedPerson: undefined,
    authorisedDirectorId: draft.authorisedDirectorId ?? null,
    pointOfContact: draft.pointOfContact ?? "authorised",
    lastAgmOn: draft.lastAgmOn ?? null,
    notes: draft.notes?.trim() || undefined,
    listed: draft.listed ?? false,
    workingFyEndingYear: draft.workingFyEndingYear ?? null,
    authorisedCapital: draft.authorisedCapital ?? 0,
    paidUpCapital: draft.paidUpCapital ?? 0,
    turnover: draft.turnover ?? 0,
    netWorth: draft.netWorth ?? 0,
    netProfit: draft.netProfit ?? 0,
    borrowings: draft.borrowings ?? 0,
    deposits: draft.deposits ?? 0,
    llpContribution: draft.llpContribution ?? 0,
    directorsCount: draft.directorsCount ?? 0,
    msmeDuesOver45Days: draft.msmeDuesOver45Days ?? false,
    securitiesInDemat: draft.securitiesInDemat ?? false,
    filesDpt3: draft.filesDpt3 ?? false,
    // Every company appoints an auditor (Section 139), so ADT-1 always applies.
    filesAdt1: true,
    filesInc20a: draft.filesInc20a ?? true,
    transferPricing: draft.transferPricing ?? false,
    auditorAppointedAtAgmFy: draft.auditorAppointedAtAgmFy ?? null,
    auditorTermYears: draft.auditorTermYears ?? null,
    auditorType: draft.auditorType,
    firstAuditorAppointedOn: draft.auditorType === "first" ? draft.firstAuditorAppointedOn || null : null,
    ...adt1Fields(draft),
    createdAt: iso,
    updatedAt: iso,
  });
}

export function applyDraft(client: Client, draft: ClientDraft, now = new Date()): Client {
  return withAdt1Filing({
    ...client,
    name: draft.name.trim(),
    cin: draft.cin.trim().toUpperCase(),
    type: draft.type,
    incorporatedOn: draft.incorporatedOn,
    registeredOffice: draft.registeredOffice.trim(),
    status: draft.status,
    mobile: normaliseMobile(draft.mobile ?? "") || undefined,
    email: draft.email?.trim() || undefined,
    consultantId: draft.consultantId ?? null,
    authorisedPerson: undefined,
    authorisedDirectorId: draft.authorisedDirectorId ?? null,
    pointOfContact: draft.pointOfContact ?? "authorised",
    lastAgmOn: draft.lastAgmOn ?? null,
    agmHistory: keepPreviousAgm(client, draft.lastAgmOn ?? null),
    notes: draft.notes?.trim() || undefined,
    listed: draft.listed ?? false,
    workingFyEndingYear: draft.workingFyEndingYear ?? null,
    authorisedCapital: draft.authorisedCapital ?? 0,
    paidUpCapital: draft.paidUpCapital ?? 0,
    turnover: draft.turnover ?? 0,
    netWorth: draft.netWorth ?? 0,
    netProfit: draft.netProfit ?? 0,
    borrowings: draft.borrowings ?? 0,
    deposits: draft.deposits ?? 0,
    llpContribution: draft.llpContribution ?? 0,
    directorsCount: draft.directorsCount ?? 0,
    msmeDuesOver45Days: draft.msmeDuesOver45Days ?? false,
    securitiesInDemat: draft.securitiesInDemat ?? false,
    filesDpt3: draft.filesDpt3 ?? false,
    // Every company appoints an auditor (Section 139), so ADT-1 always applies.
    filesAdt1: true,
    filesInc20a: draft.filesInc20a ?? true,
    transferPricing: draft.transferPricing ?? false,
    auditorAppointedAtAgmFy: draft.auditorAppointedAtAgmFy ?? null,
    auditorTermYears: draft.auditorTermYears ?? null,
    auditorType: draft.auditorType,
    firstAuditorAppointedOn: draft.auditorType === "first" ? draft.firstAuditorAppointedOn || null : null,
    ...adt1Fields(draft),
    auditorAppointedThisYear: undefined,
    updatedAt: now.toISOString(),
  });
}

/**
 * A subsequent auditor's ADT-1: its SRN and filing date are kept, the AGM it
 * reports (the one before the filing) becomes the start of the term, and the
 * filing is recorded against that year so ADT-1 shows as filed there.
 */
function adt1Fields(draft: ClientDraft): Pick<Client, "adt1Srn" | "adt1FiledOn"> & { auditorAppointedAtAgmFy?: number | null } {
  const filed = draft.auditorType === "subsequent" && draft.adt1FiledOn ? parseIsoDate(draft.adt1FiledOn) : null;
  if (!filed) return { adt1Srn: undefined, adt1FiledOn: null };
  return {
    adt1Srn: normaliseSrn(draft.adt1Srn ?? "") || undefined,
    adt1FiledOn: draft.adt1FiledOn,
    auditorAppointedAtAgmFy: agmFyOf(filed),
  };
}

/** The client's filings with the subsequent auditor's ADT-1 recorded (or replaced). */
export function withAdt1Filing(client: Client): Client {
  if (client.auditorType !== "subsequent" || !client.adt1FiledOn || client.auditorAppointedAtAgmFy == null) return client;
  const key = `adt-1|${client.auditorAppointedAtAgmFy}|`;
  const record: FilingRecord = { key, filedOn: client.adt1FiledOn, srn: client.adt1Srn ?? "" };
  return { ...client, filings: [...(client.filings ?? []).filter((f) => f.key !== key), record] };
}

export function draftFrom(client: Client): ClientDraft {
  return {
    name: client.name,
    cin: client.cin,
    type: client.type,
    incorporatedOn: client.incorporatedOn,
    registeredOffice: client.registeredOffice,
    status: client.status,
    mobile: client.mobile ?? "",
    email: client.email ?? "",
    consultantId: client.consultantId ?? null,
    // An older save's single choice: a director, or "consultant".
    authorisedDirectorId:
      client.authorisedDirectorId ??
      (client.authorisedPerson?.kind === "director" ? client.authorisedPerson.directorId : null),
    pointOfContact: client.pointOfContact ?? (client.authorisedPerson?.kind === "consultant" ? "consultant" : "authorised"),
    adt1Srn: client.adt1Srn ?? "",
    adt1FiledOn: client.adt1FiledOn ?? null,
    lastAgmOn: client.lastAgmOn ?? null,
    notes: client.notes ?? "",
    listed: client.listed ?? false,
    workingFyEndingYear: client.workingFyEndingYear ?? null,
    authorisedCapital: client.authorisedCapital ?? 0,
    paidUpCapital: client.paidUpCapital ?? 0,
    turnover: client.turnover ?? 0,
    netWorth: client.netWorth ?? 0,
    netProfit: client.netProfit ?? 0,
    borrowings: client.borrowings ?? 0,
    deposits: client.deposits ?? 0,
    llpContribution: client.llpContribution ?? 0,
    directorsCount: client.directorsCount ?? 0,
    msmeDuesOver45Days: client.msmeDuesOver45Days ?? false,
    securitiesInDemat: client.securitiesInDemat ?? false,
    filesDpt3: client.filesDpt3 ?? false,
    filesAdt1: client.filesAdt1 ?? true,
    filesInc20a: client.filesInc20a ?? true,
    transferPricing: client.transferPricing ?? false,
    auditorAppointedAtAgmFy: client.auditorAppointedAtAgmFy ?? null,
    auditorTermYears: client.auditorTermYears ?? null,
    auditorType: client.auditorType,
    firstAuditorAppointedOn: client.firstAuditorAppointedOn ?? null,
  };
}

/**
 * When the "most recent AGM" changes to a later year's meeting, the old date
 * is history, not a mistake: keep it, so that year's filings stay anchored on
 * its own AGM. A change within the same year is a correction and replaces it.
 */
export function keepPreviousAgm(client: Client, nextAgmOn: string | null): string[] {
  const history = [...(client.agmHistory ?? [])];
  const previous = client.lastAgmOn ? parseIsoDate(client.lastAgmOn) : null;
  const next = nextAgmOn ? parseIsoDate(nextAgmOn) : null;
  if (previous && client.lastAgmOn !== nextAgmOn) {
    const sameYear = next !== null && agmFyOf(previous) === agmFyOf(next);
    if (!sameYear && !history.includes(client.lastAgmOn!)) history.push(client.lastAgmOn!);
  }
  // One AGM per year: a newer entry for a year replaces an older one.
  const byFy = new Map<number, string>();
  for (const iso of history.sort()) {
    const d = parseIsoDate(iso);
    if (d && (!next || agmFyOf(d) !== agmFyOf(next))) byFy.set(agmFyOf(d), iso);
  }
  return [...byFy.values()].sort();
}

/**
 * The financial year an AGM is held FOR: the one that closed before it.
 * An AGM must fall within nine months (first) or six months (later, plus up to
 * three on extension) of its year end, so it always lands inside the next
 * financial year: an AGM on 26 Sep 2025 is for FY 2024-25, year ending 2025.
 */
export function agmFyOf(agm: Date): number {
  return (agm.getMonth() <= 2 ? agm.getFullYear() : agm.getFullYear() + 1) - 1;
}

/**
 * Feeds a client's stored figures into the Applicability Analyzer, so the
 * page can open pre-filled from the active client instead of starting blank
 * every time.
 */
export function applicabilityProfileFor(client: Client): CompanyProfile {
  return {
    entityType: client.type,
    listed: client.listed ?? false,
    paidUpCapital: client.paidUpCapital ?? 0,
    turnover: client.turnover ?? 0,
    netWorth: client.netWorth ?? 0,
    netProfit: client.netProfit ?? 0,
    borrowings: client.borrowings ?? 0,
    deposits: client.deposits ?? 0,
    msmeDuesOver45Days: client.msmeDuesOver45Days ?? false,
    securitiesInDemat: client.securitiesInDemat ?? false,
  };
}

export function typeLabel(type: CompanyType): string {
  return COMPANY_TYPES.find((t) => t.value === type)?.short ?? type;
}

export function typeLabelLong(type: CompanyType): string {
  return COMPANY_TYPES.find((t) => t.value === type)?.label ?? type;
}

/**
 * Maps a client's entity type onto the coarse company/LLP split the forms
 * library filters by. This is deliberately coarse — it does not account for
 * size, listing or other entity-specific thresholds, which is why the UI that
 * uses it says so.
 */
export function formEntityScopeFor(type: CompanyType): "company" | "llp" {
  return type === "llp" ? "llp" : "company";
}

/** Two-letter monogram for the switcher and the portfolio grid. */
export function initials(name: string): string {
  const words = name
    .replace(/\b(private|public|limited|ltd|llp|company|and|the|&)\b/gi, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const source = words.length > 0 ? words : name.trim().split(/\s+/).filter(Boolean);
  return source
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function sortClients(clients: Client[]): Client[] {
  return [...clients].sort((a, b) => a.name.localeCompare(b.name, "en-IN"));
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
