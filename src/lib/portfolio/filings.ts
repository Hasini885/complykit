import { parseIsoDate, today } from "@/lib/dates";
import type { ResolvedDueDate } from "@/lib/resolve-due-dates";
import { checkSrn, normaliseSrn } from "@/lib/portfolio/srn";
import type { Client, FilingRecord } from "@/lib/portfolio/types";

/**
 * Deadlines met, with their SRNs.
 *
 * A filing is matched to its row by obligation and year, never by due date:
 * the due date of AOC-4 moves when the AGM date is recorded, and the record
 * must stay with it. Half-yearly returns add the half they cover; one-time
 * duties from incorporation have no year of their own.
 */
export function filingKey(item: ResolvedDueDate): string {
  if (item.source.onlyWithinDaysOfIncorporation !== undefined) return `${item.source.id}|once`;
  return [item.source.id, item.fyEndingYear, item.qualifier ?? ""].join("|");
}

/** DIR-3 KYC rows are per director and stored on the director, not the company. */
export function kycDirectorId(item: ResolvedDueDate): string | null {
  const m = /^dir-3-kyc:(.+)$/.exec(item.source.id);
  return m ? m[1] : null;
}

/** Attaches the company's recorded filings to its resolved rows. */
export function applyFilings(items: ResolvedDueDate[], client: Client): ResolvedDueDate[] {
  const byKey = new Map((client.filings ?? []).map((f) => [f.key, f]));
  return items.map((item) => {
    if (item.due === null || kycDirectorId(item)) return item;
    const record = byKey.get(filingKey(item));
    const filedOn = record ? parseIsoDate(record.filedOn) : null;
    return filedOn ? { ...item, filedOn, srn: record!.srn || null } : item;
  });
}

export type FilingInput = { filedOn: string; srn: string };

/**
 * What number proves a filing: MCA forms get a Service Request Number; an
 * income-tax return (ITR-5 / ITR-6 / ITR-7) gets the acknowledgement number
 * from the e-filing portal instead. Both are kept in the record's `srn` field.
 */
export type ReferenceKind = "srn" | "ack";

export function referenceKind(sourceId: string): ReferenceKind {
  return sourceId.split(":")[0] === "itr" ? "ack" : "srn";
}

/** An ITR acknowledgement number is 15 digits. */
export const ACK_LENGTH = 15;

/** A reason the acknowledgement number looks wrong, or null when it is acceptable. */
export function checkAck(raw: string): string | null {
  const ack = normaliseSrn(raw);
  if (ack === "") return null;
  if (!/^\d+$/.test(ack)) return "An acknowledgement number has digits only.";
  if (ack.length !== ACK_LENGTH) return `An ITR acknowledgement number is ${ACK_LENGTH} digits.`;
  return null;
}

/** Problems with a filing as entered, by field. Empty when it can be saved. */
export function validateFiling(
  input: FilingInput,
  opts: { srnRequired: boolean; asOf?: Date; kind?: ReferenceKind },
): Partial<Record<keyof FilingInput, string>> {
  const errors: Partial<Record<keyof FilingInput, string>> = {};
  const filed = parseIsoDate(input.filedOn);
  if (!filed) errors.filedOn = "Enter the date it was filed.";
  else if (filed.getTime() > (opts.asOf ?? today()).getTime()) {
    errors.filedOn = "That date is in the future.";
  }
  const ack = opts.kind === "ack";
  if (opts.srnRequired && normaliseSrn(input.srn) === "") {
    errors.srn = ack
      ? "Enter the acknowledgement number from the ITR-V."
      : "Enter the SRN from the MCA payment challan or acknowledgement.";
  } else {
    const problem = ack ? checkAck(input.srn) : checkSrn(input.srn);
    if (problem) errors.srn = problem;
  }
  return errors;
}

/** The company with this filing recorded (replacing any earlier record for the row). */
export function withFiling(client: Client, key: string, input: FilingInput, now = new Date()): Client {
  const record: FilingRecord = { key, filedOn: input.filedOn, srn: normaliseSrn(input.srn) };
  const others = (client.filings ?? []).filter((f) => f.key !== key);
  return { ...client, filings: [...others, record], updatedAt: now.toISOString() };
}

/** The company with this row's filing removed, e.g. one marked by mistake. */
export function withoutFiling(client: Client, key: string, now = new Date()): Client {
  return {
    ...client,
    filings: (client.filings ?? []).filter((f) => f.key !== key),
    updatedAt: now.toISOString(),
  };
}

/** Keeps only well-formed records from storage. */
export function cleanFilings(raw: unknown): FilingRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (f): f is FilingRecord =>
      !!f &&
      typeof f.key === "string" &&
      typeof f.filedOn === "string" &&
      parseIsoDate(f.filedOn) !== null &&
      typeof f.srn === "string",
  );
}
