import { parseIsoDate } from "@/lib/dates";
import { kycDirectorId } from "@/lib/portfolio/filings";
import { normaliseSrn } from "@/lib/portfolio/srn";
import type { ResolvedDueDate } from "@/lib/resolve-due-dates";

/**
 * MCA payment challans: the "G.A.R.7" receipt MCA issues when an e-form's fee
 * is paid. It carries the SRN, the SRN date, the company (CIN, name, address)
 * and the form the fee was for, which is enough to update the company's master
 * data and mark that filing done.
 *
 * Works on the text lines from src/lib/pdf-text.ts. Anything that is not an
 * MCA G.A.R.7 receipt is rejected, so only challans can be uploaded here.
 */

export type ChallanFee = {
  /** As printed, e.g. "Fee for ADT - 1". */
  description: string;
  /** The form, normalised, e.g. "ADT-1"; null when none can be read. */
  formCode: string | null;
  normal: number | null;
  additional: number | null;
};

export type Challan = {
  srn: string;
  /** ISO yyyy-mm-dd: the date the fee was paid, used as the filing date. */
  srnDate: string;
  /** ISO yyyy-mm-dd, when printed. */
  serviceRequestDate: string | null;
  /** CIN / LLPIN / DIN of the entity paid for. */
  cin: string;
  companyName: string;
  address: string;
  payerName: string | null;
  fees: ChallanFee[];
  total: number | null;
};

export type ChallanResult = { ok: true; challan: Challan } | { ok: false; error: string };

export const NOT_A_CHALLAN =
  "Only MCA payment challans (the G.A.R.7 receipt with the SRN) can be uploaded here.";

const HEADER_RE = /^(RECEIVED FROM|ENTITY ON WHOSE BEHALF|FULL PARTICULARS|Service Type|Service Description|Mode of Payment|Received Payment|Note\s*:)/i;

/** "13/10/2026" → "2026-10-13", or null. */
function dmyToIso(raw: string | undefined): string | null {
  if (!raw) return null;
  const m = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(raw);
  if (!m) return null;
  const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return parseIsoDate(iso) ? iso : null;
}

function amount(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** "ADT - 1", "Form ADT-1", "e-Form MGT 7A" → "ADT-1", "MGT-7A". */
export function normaliseFormCode(raw: string): string | null {
  const s = raw
    .toUpperCase()
    .replace(/\b(E-?FORM|FORM|FEE FOR|FEES FOR)\b/g, " ")
    .trim();
  const m = /([A-Z]{2,6})\s*[-–]?\s*(\d{1,3}[A-Z]?)\b/.exec(s);
  return m ? `${m[1]}-${m[2]}` : null;
}

const clean = (s: string) => s.replace(/\s{2,}/g, " ").trim();

/** Reads a G.A.R.7 receipt from its text lines. */
export function parseMcaChallan(lines: string[]): ChallanResult {
  const text = lines.join("\n");
  const flat = text.replace(/\s+/g, " ");
  if (!/MINISTRY OF CORPORATE AFFAIRS/i.test(flat) || !/G\s*\.?\s*A\s*\.?\s*R\s*\.?\s*7\b/i.test(flat)) {
    return { ok: false, error: NOT_A_CHALLAN };
  }

  const srnMatch = /\bSRN\s*:\s*([A-Z0-9]{6,20})/i.exec(text);
  const srnDate = dmyToIso(/SRN\s*Date\s*:\s*([\d/.-]{8,10})/i.exec(text)?.[1]);
  if (!srnMatch || !srnDate) {
    return { ok: false, error: "This challan has no readable SRN and SRN date." };
  }

  // The entity block: from its heading to the fee table.
  const start = lines.findIndex((l) => /ENTITY ON WHOSE BEHALF/i.test(l));
  const block: string[] = [];
  if (start >= 0) {
    for (let i = start + 1; i < lines.length && !/FULL PARTICULARS|Service Type/i.test(lines[i]); i++) {
      block.push(lines[i]);
    }
  }
  let cin = "";
  let companyName = "";
  const address: string[] = [];
  let inAddress = false;
  for (const line of block) {
    const c = /(?:LLPIN|CIN|DIN)[^:]*:\s*([A-Z0-9-]{6,25})/i.exec(line);
    if (c) {
      cin = c[1].toUpperCase();
      inAddress = false;
      continue;
    }
    const n = /^\s*Name\s*:\s*(.+)$/i.exec(line);
    if (n) {
      companyName = clean(n[1]);
      inAddress = false;
      continue;
    }
    const a = /^\s*Address\s*:\s*(.*)$/i.exec(line);
    if (a) {
      inAddress = true;
      if (a[1].trim()) address.push(clean(a[1]));
      continue;
    }
    if (inAddress && line.trim() && !HEADER_RE.test(line.trim())) address.push(clean(line));
  }
  if (!cin || !companyName) {
    return { ok: false, error: "Could not read the company (CIN and name) from this challan." };
  }

  // The payer: first "Name:" under RECEIVED FROM.
  const fromIdx = lines.findIndex((l) => /RECEIVED FROM/i.test(l));
  let payerName: string | null = null;
  if (fromIdx >= 0) {
    for (let i = fromIdx + 1; i < (start >= 0 ? start : lines.length); i++) {
      const n = /^\s*Name\s*:\s*(.+)$/i.exec(lines[i]);
      if (n) {
        payerName = clean(n[1]);
        break;
      }
    }
  }

  // Fees: "Fee for ADT - 1    Normal    200", then "Additional    0" on its own line.
  const fees: ChallanFee[] = [];
  for (const line of lines) {
    const f = /^\s*(Fee[s]?\s+for\s+.+?)\s{2,}(?:Normal\s+)?([\d,]+(?:\.\d+)?)?\s*$/i.exec(line)
      ?? /^\s*(Fee[s]?\s+for\s+.+?)\s+Normal\s+([\d,]+(?:\.\d+)?)\s*$/i.exec(line);
    if (f) {
      const description = clean(f[1].replace(/\s+Normal$/i, ""));
      fees.push({ description, formCode: normaliseFormCode(description), normal: amount(f[2]), additional: null });
      continue;
    }
    const add = /^\s*Additional\s+([\d,]+(?:\.\d+)?)\s*$/i.exec(line);
    if (add && fees.length > 0 && fees[fees.length - 1].additional === null) {
      fees[fees.length - 1].additional = amount(add[1]);
    }
  }
  const total = amount(/^\s*Total\s+([\d,]+(?:\.\d+)?)\s*$/im.exec(text)?.[1]);

  return {
    ok: true,
    challan: {
      srn: normaliseSrn(srnMatch[1]),
      srnDate,
      serviceRequestDate: dmyToIso(/Service\s*Request\s*Date\s*:\s*([\d/.-]{8,10})/i.exec(text)?.[1]),
      cin,
      companyName,
      address: address.join(", ").replace(/,\s*,/g, ","),
      payerName,
      fees,
      total,
    },
  };
}

/** Form codes a row answers to: "ITR-7 / ITR-6" → ["ITR-7", "ITR-6"]. */
function rowCodes(item: ResolvedDueDate): string[] {
  const code = item.source.formCode;
  if (!code) return [];
  return code
    .split("/")
    .map((c) => normaliseFormCode(c))
    .filter((c): c is string => c !== null);
}

/** The company's rows this challan's form could be the filing for, oldest due first. */
export function challanCandidates(items: ResolvedDueDate[], formCodes: string[]): ResolvedDueDate[] {
  const wanted = new Set(formCodes);
  return items
    .filter((i) => i.due !== null && !kycDirectorId(i) && rowCodes(i).some((c) => wanted.has(c)))
    .sort((a, b) => a.due!.getTime() - b.due!.getTime());
}

/**
 * The row to mark: one already holding this SRN; otherwise the not-yet-filed
 * row whose due date is nearest the SRN date; otherwise the nearest of any.
 */
export function bestChallanRow(candidates: ResolvedDueDate[], challan: Challan): ResolvedDueDate | null {
  if (candidates.length === 0) return null;
  const same = candidates.find((c) => c.srn && normaliseSrn(c.srn) === challan.srn);
  if (same) return same;
  const paid = parseIsoDate(challan.srnDate)!.getTime();
  const nearest = (list: ResolvedDueDate[]) =>
    list.reduce((best, c) =>
      Math.abs(c.due!.getTime() - paid) < Math.abs(best.due!.getTime() - paid) ? c : best,
    );
  const open = candidates.filter((c) => !c.filedOn);
  return nearest(open.length > 0 ? open : candidates);
}

/** Same CIN, ignoring case, spaces and dashes. */
export function sameCin(a: string, b: string): boolean {
  const n = (s: string) => s.replace(/[\s-]/g, "").toUpperCase();
  return n(a) !== "" && n(a) === n(b);
}
