import { z } from "zod";

import { parseIsoDate } from "@/lib/dates";
import type { ClientDraft } from "@/lib/portfolio/clients";
import type { CompanyProfile } from "@/lib/applicability";
import type { CompanyType } from "@/lib/dates";
import type { DirectorDraft } from "@/lib/portfolio/directors";
import type { ClientStatus } from "@/lib/portfolio/types";

/**
 * Shared between the extraction API route and every form that consumes it, so
 * the schema, the "how many fields did we get" count, and the mapping onto
 * each form's own field names all come from one place.
 *
 * Every field is nullable by design — the extraction prompt is explicit that
 * a missing value must come back as null, never a guess. Nothing here
 * invents a number or a date that wasn't actually in the document.
 */

export const ExtractedCompanySchema = z.object({
  companyName: z.string().nullable(),
  cin: z.string().nullable(),
  /** Free text as it appeared in the document, e.g. "Private Limited Company". Classified separately — see classifyEntityType. */
  entityTypeRaw: z.string().nullable(),
  /** ISO 8601, yyyy-mm-dd. */
  incorporationDate: z.string().nullable(),
  registeredOfficeAddress: z.string().nullable(),
  /** The company's email. MCA prints it as name[at]domain[dot]com; see normaliseEmail. */
  email: z.string().nullable(),
  paidUpCapital: z.number().nullable(),
  authorisedCapital: z.number().nullable(),
  turnover: z.number().nullable(),
  netWorth: z.number().nullable(),
  netProfit: z.number().nullable(),
  borrowings: z.number().nullable(),
  deposits: z.number().nullable(),
  listed: z.boolean().nullable(),
  auditorName: z.string().nullable(),
  /** ISO 8601, yyyy-mm-dd. */
  lastAgmDate: z.string().nullable(),
  /** LLPs only: total obligation of contribution, in plain rupees. */
  llpContribution: z.number().nullable(),
  /** A stated count of directors / designated partners, where the document gives one. */
  numberOfDirectors: z.number().nullable(),
  /** Status as the document states it, e.g. "Active", "Strike Off". Mapped by classifyCompanyStatus. */
  companyStatusRaw: z.string().nullable(),
  msmeDuesOver45Days: z.boolean().nullable(),
  securitiesInDemat: z.boolean().nullable(),
  directors: z
    .array(
      z.object({
        name: z.string(),
        din: z.string().nullable(),
      }),
    )
    .nullable(),
});

export type ExtractedCompany = z.infer<typeof ExtractedCompanySchema>;

/** Every top-level field that counts toward the "N of M fields extracted" summary. */
const SCALAR_FIELDS = [
  "companyName",
  "cin",
  "entityTypeRaw",
  "incorporationDate",
  "registeredOfficeAddress",
  "email",
  "paidUpCapital",
  "authorisedCapital",
  "turnover",
  "netWorth",
  "netProfit",
  "borrowings",
  "deposits",
  "listed",
  "auditorName",
  "lastAgmDate",
  "llpContribution",
  "numberOfDirectors",
  "companyStatusRaw",
  "msmeDuesOver45Days",
  "securitiesInDemat",
] as const satisfies readonly (keyof ExtractedCompany)[];

export function countExtractedFields(data: ExtractedCompany): { found: number; total: number } {
  const total = SCALAR_FIELDS.length + 1; // +1 for the directors list.
  let found = 0;
  for (const key of SCALAR_FIELDS) {
    if (data[key] !== null) found++;
  }
  if (data.directors && data.directors.length > 0) found++;
  return { found, total };
}

/**
 * Maps free-text entity descriptions onto this app's five known types.
 * Deliberately a classifier we own rather than forcing the model's structured
 * output into the enum directly — a PDF says "Private Limited Company" in a
 * hundred different phrasings, and this keeps that judgment call testable and
 * out of the prompt.
 */
export function classifyEntityType(raw: string | null): CompanyType | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (/\bopc\b|one\s*person\s*company/.test(s)) return "opc";
  if (/\bllp\b|limited\s*liability\s*partnership/.test(s)) return "llp";
  if (/section\s*-?\s*8|not[\s-]for[\s-]profit|non[\s-]profit/.test(s)) return "section8";
  if (/public\s*limited/.test(s)) return "public";
  if (/private\s*limited/.test(s)) return "private";
  return null;
}

/** Maps a status as the document words it onto this app's client statuses. */
export function classifyCompanyStatus(raw: string | null): ClientStatus | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (/strik|struck/.test(s)) return "strike-off";
  if (/dormant/.test(s)) return "dormant";
  if (/dissolved|liquidat|amalgamated|converted|closed|wound/.test(s)) return "closed";
  if (/\bactive\b/.test(s)) return "active";
  return null;
}

/**
 * An email as MCA prints it ("NAME[at]GMAIL[dot]COM", also "(at)", " at ",
 * "[.]") as a plain lower-case address, or null when it is not one.
 */
export function normaliseEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw
    .trim()
    // OCR misreads the closing bracket as J, l, I, 1 or |: "[dotJcom".
    .replace(/\s*[[({]\s*at\s*[\])}JlI1|]\s*/gi, "@")
    .replace(/\s*[[({]\s*(?:dot|\.)\s*[\])}JlI1|]\s*/gi, ".")
    .replace(/\s+at\s+/gi, "@")
    .replace(/\s+dot\s+/gi, ".")
    .replace(/\s+/g, "")
    .toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(s) ? s : null;
}

/** Every field the extraction schema knows about, for merging. */
const ALL_FIELDS = [...SCALAR_FIELDS, "directors"] as const satisfies readonly (keyof ExtractedCompany)[];

/** An extraction with every field unknown. */
export function emptyExtraction(): ExtractedCompany {
  return Object.fromEntries(ALL_FIELDS.map((k) => [k, null])) as ExtractedCompany;
}

/**
 * Combines two extractions of the same document, field by field: `primary`
 * wins wherever it found something, and `secondary` fills the gaps. Used to
 * keep what the in-browser reader found when the AI reader missed it.
 */
export function mergeExtractions(
  primary: ExtractedCompany,
  secondary: ExtractedCompany,
): ExtractedCompany {
  const merged = { ...primary };
  for (const key of ALL_FIELDS) {
    const value = primary[key];
    const missing = value === null || (Array.isArray(value) && value.length === 0);
    if (missing && secondary[key] !== null) {
      (merged as Record<string, unknown>)[key] = secondary[key];
    }
  }
  return merged;
}

/**
 * Parses an incorporation date, accepting only what actually parses as a real
 * calendar date. A malformed or hallucinated string becomes null rather than
 * silently reaching the form as garbage.
 */
export function normaliseIncorporationDate(raw: string | null): string | null {
  if (!raw) return null;
  const parsed = parseIsoDate(raw.trim());
  return parsed ? raw.trim() : null;
}

/**
 * Applies extracted data onto an existing draft, filling only the fields the
 * PDF actually covered. Fields the document didn't mention are left exactly
 * as they were — this pre-fills, it never blanks out something the user
 * already typed.
 */
export function applyExtractionToClientDraft(
  draft: ClientDraft,
  extracted: ExtractedCompany,
): ClientDraft {
  const entityType = classifyEntityType(extracted.entityTypeRaw);
  const incorporatedOn = normaliseIncorporationDate(extracted.incorporationDate);
  const lastAgmOn = normaliseIncorporationDate(extracted.lastAgmDate);
  const directorsCount =
    extracted.numberOfDirectors ??
    (extracted.directors && extracted.directors.length > 0 ? extracted.directors.length : null);

  return {
    ...draft,
    name: extracted.companyName?.trim() || draft.name,
    cin: extracted.cin?.trim().toUpperCase() || draft.cin,
    type: entityType ?? draft.type,
    incorporatedOn: incorporatedOn ?? draft.incorporatedOn,
    registeredOffice: extracted.registeredOfficeAddress?.trim() || draft.registeredOffice,
    listed: extracted.listed ?? draft.listed,
    paidUpCapital: extracted.paidUpCapital ?? draft.paidUpCapital,
    turnover: extracted.turnover ?? draft.turnover,
    netWorth: extracted.netWorth ?? draft.netWorth,
    netProfit: extracted.netProfit ?? draft.netProfit,
    borrowings: extracted.borrowings ?? draft.borrowings,
    deposits: extracted.deposits ?? draft.deposits,
    status: classifyCompanyStatus(extracted.companyStatusRaw) ?? draft.status,
    // Optional draft fields: only set when the PDF covered them, so a draft
    // that never had the key does not gain one holding undefined.
    ...definedOnly({
      email: normaliseEmail(extracted.email),
      lastAgmOn,
      llpContribution: extracted.llpContribution,
      directorsCount,
      msmeDuesOver45Days: extracted.msmeDuesOver45Days,
      securitiesInDemat: extracted.securitiesInDemat,
    }),
  };
}

function definedOnly<T extends object>(values: T): Partial<{ [K in keyof T]: NonNullable<T[K]> }> {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v !== null && v !== undefined)) as Partial<{
    [K in keyof T]: NonNullable<T[K]>;
  }>;
}

/** Same idea, for the standalone Applicability Analyzer's profile form. */
export function applyExtractionToApplicabilityProfile(
  profile: CompanyProfile,
  extracted: ExtractedCompany,
): CompanyProfile {
  const entityType = classifyEntityType(extracted.entityTypeRaw);
  return {
    ...profile,
    entityType: entityType ?? profile.entityType,
    listed: extracted.listed ?? profile.listed,
    paidUpCapital: extracted.paidUpCapital ?? profile.paidUpCapital,
    turnover: extracted.turnover ?? profile.turnover,
    netWorth: extracted.netWorth ?? profile.netWorth,
    netProfit: extracted.netProfit ?? profile.netProfit,
    borrowings: extracted.borrowings ?? profile.borrowings,
    deposits: extracted.deposits ?? profile.deposits,
    msmeDuesOver45Days: extracted.msmeDuesOver45Days ?? profile.msmeDuesOver45Days,
    securitiesInDemat: extracted.securitiesInDemat ?? profile.securitiesInDemat,
  };
}

/**
 * One director draft per person the PDF listed. Empty when the document
 * named no directors — callers should keep manual entry available either way.
 */
export function extractionToDirectorDrafts(
  extracted: ExtractedCompany,
  dinAllottedOn: string,
): DirectorDraft[] {
  if (!extracted.directors) return [];
  return extracted.directors
    .filter((d) => d.name.trim() !== "")
    .map((d) => ({
      name: d.name.trim(),
      din: d.din?.trim() ?? "",
      dinAllottedOn,
      directorships: [],
    }));
}

export const PDF_MAX_BYTES = 10 * 1024 * 1024; // 10MB, per the spec's cap.

export const EXTRACTION_SYSTEM_PROMPT = `You extract structured company data from Indian corporate filings and registration documents (Certificate of Incorporation, MCA master data printouts, financial statements, board resolutions, and similar).

Extract ONLY these fields and return them as the specified structured output — no other fields, no commentary, no markdown:
- companyName: the registered name of the company or LLP
- cin: the Corporate Identity Number or LLPIN
- entityTypeRaw: the entity type exactly as described in the document (e.g. "Private Limited Company", "One Person Company", "LLP")
- incorporationDate: the date of incorporation, in ISO 8601 format (yyyy-mm-dd)
- registeredOfficeAddress: the full registered office address
- paidUpCapital: paid-up share capital, in plain rupees (e.g. 3200000 for ₹32,00,000). Convert lakh/crore figures to plain rupees.
- authorisedCapital: authorised share capital, in plain rupees
- turnover: turnover or revenue, in plain rupees
- netWorth: net worth, in plain rupees
- netProfit: net profit for the period shown, in plain rupees
- borrowings: outstanding borrowings, in plain rupees
- deposits: outstanding deposits, in plain rupees
- listed: true if the document states the company is listed on a stock exchange, false if it states the company is unlisted, null if not stated
- auditorName: the name of the statutory auditor, if named
- lastAgmDate: the date of the last annual general meeting, in ISO 8601 format (yyyy-mm-dd)
- llpContribution: for an LLP, the total obligation of contribution, in plain rupees
- numberOfDirectors: the number of directors (or designated partners, for an LLP) where the document states a count
- companyStatusRaw: the company's status exactly as the document states it (e.g. "Active", "Strike Off", "Dormant")
- msmeDuesOver45Days: true if the document discloses amounts owed to micro or small enterprises outstanding for more than 45 days, false if it states there are none, null if not stated
- securitiesInDemat: true if the document states the company's securities are held in dematerialised form or gives an ISIN for them, false if it states they are not, null if not stated
- directors: an array of every director or designated partner named, each with their name and DIN/DPIN if given

CRITICAL RULES:
- If a field is not present in the document, return null for it. Never guess, estimate, or infer a value that is not actually stated.
- Do not use information from outside the document. Do not fill in a "typical" or "example" value.
- Only extract director entries where a name is actually stated — do not invent placeholder directors.
- Convert all monetary figures to plain rupees (e.g. "₹1.5 crore" becomes 15000000, "₹40 lakh" becomes 4000000).`;
