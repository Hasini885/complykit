import { parseIsoDate } from "@/lib/dates";
import { kycDirectorId } from "@/lib/portfolio/filings";
import { normaliseSrn } from "@/lib/portfolio/srn";
export const NOT_A_CHALLAN = "Only MCA payment challans (the G.A.R.7 receipt with the SRN) can be uploaded here.";

const HEADER_RE =
  /^(RECEIVED FROM|ENTITY ON WHOSE BEHALF|FULL PARTICULARS|Service Type|Service Description|Mode of Payment|Received Payment|Note\s*:)/i;

/** "13/10/2026" → "2026-10-13", or null. */
function dmyToIso(raw) {
  if (!raw) return null;
  const m = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(raw);
  if (!m) return null;
  const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return parseIsoDate(iso) ? iso : null;
}

function amount(raw) {
  if (raw === undefined) return null;
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** "ADT - 1", "Form ADT-1", "e-Form MGT 7A" → "ADT-1", "MGT-7A". */
export function normaliseFormCode(raw) {
  const s = raw
    .toUpperCase()
    .replace(/\b(E-?FORM|FORM|FEE FOR|FEES FOR)\b/g, " ")
    .trim();
  const m = /([A-Z]{2,6})\s*[-–]?\s*(\d{1,3}[A-Z]?)\b/.exec(s);
  return m ? `${m[1]}-${m[2]}` : null;
}

const clean = (s) => s.replace(/\s{2,}/g, " ").trim();

/** Reads a G.A.R.7 receipt from its text lines. */
export function parseMcaChallan(lines) {
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
  const block = [];
  if (start >= 0) {
    for (let i = start + 1; i < lines.length && !/FULL PARTICULARS|Service Type/i.test(lines[i]); i++) {
      block.push(lines[i]);
    }
  }
  let cin = "";
  let companyName = "";
  const address = [];
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
  let payerName = null;
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
  const fees = [];
  for (const line of lines) {
    const f =
      /^\s*(Fee[s]?\s+for\s+.+?)\s{2,}(?:Normal\s+)?([\d,]+(?:\.\d+)?)?\s*$/i.exec(line) ??
      /^\s*(Fee[s]?\s+for\s+.+?)\s+Normal\s+([\d,]+(?:\.\d+)?)\s*$/i.exec(line);
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

const MONTHS = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

/** "25-Oct-2026" or "25/10/2026" → "2026-10-25". */
function anyDateToIso(raw) {
  if (!raw) return null;
  const m = /(\d{1,2})[-/ ]([A-Za-z]{3})[A-Za-z]*[-/ ](\d{4})/.exec(raw);
  if (m) {
    const month = MONTHS[m[2].toLowerCase()];
    if (!month) return null;
    const iso = `${m[3]}-${String(month).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return parseIsoDate(iso) ? iso : null;
  }
  return dmyToIso(raw);
}

export const NOT_A_DOCUMENT = "Only MCA payment challans (G.A.R.7) and ITR acknowledgements can be uploaded here.";

/**
 * Reads the income-tax return acknowledgement (ITR-V) the e-filing portal
 * issues: acknowledgement number, date of filing, assessment year, PAN, name
 * and form. Returned in the challan's shape (srn = acknowledgement number) so
 * the same review marks the ITR row filed.
 */
export function parseItrAck(lines) {
  const text = lines.join("\n");
  if (!/INCOME\s*TAX\s*RETURN\s*ACKNOWLEDGEMENT|ITR-V/i.test(text)) return { ok: false, error: NOT_A_DOCUMENT };
  const ack = /Acknowledgement\s*Number\s*:?\s*(\d{15})/i.exec(text)?.[1];
  const filedOn = anyDateToIso(/Date\s*of\s*filing\s*:?\s*([0-9A-Za-z/ -]{8,12})/i.exec(text)?.[1]);
  if (!ack || !filedOn) {
    return { ok: false, error: "This acknowledgement has no readable acknowledgement number and date of filing." };
  }
  // The assessment year, e.g. 2026-27 (the second part is the next year).
  let fyEndingYear;
  for (const m of text.matchAll(/\b(20\d{2})\s*-\s*(\d{2})\b/g)) {
    const a = Number(m[1]);
    if ((a + 1) % 100 === Number(m[2])) {
      fyEndingYear = a;
      break;
    }
  }
  const pan = /\bPAN\s+([A-Z]{5}\d{4}[A-Z])\b/.exec(text)?.[1];
  let name = "";
  for (const line of lines) {
    const n = /^\s*Name\s*:?\s{2,}(.+)$/i.exec(line) ?? /^\s*Name\s*:\s*(.+)$/i.exec(line);
    if (n) {
      name = clean(n[1].split(/\s{4,}/)[0]);
      break;
    }
  }
  if (!name) return { ok: false, error: "Could not read the name on this acknowledgement." };
  const formRaw = /Form\s*Number\s*:?\s*(ITR\s*-?\s*\d)/i.exec(text)?.[1];
  const form = formRaw ? normaliseFormCode(formRaw) : null;
  const ay = fyEndingYear ? `${fyEndingYear}-${String((fyEndingYear + 1) % 100).padStart(2, "0")}` : null;
  return {
    ok: true,
    challan: {
      kind: "itr",
      fyEndingYear,
      pan,
      srn: ack,
      srnDate: filedOn,
      serviceRequestDate: null,
      cin: "",
      companyName: name,
      address: "",
      payerName: null,
      fees: [
        {
          description: `${form ?? "Income-tax return"}${ay ? ` for AY ${ay}` : ""}`,
          formCode: form ?? "ITR",
          normal: null,
          additional: null,
        },
      ],
      total: null,
    },
  };
}

/** An MCA challan or an ITR acknowledgement; anything else is refused. */
export function parseFilingDocument(lines) {
  const challan = parseMcaChallan(lines);
  if (challan.ok || challan.error !== NOT_A_CHALLAN) return challan;
  const itr = parseItrAck(lines);
  if (itr.ok || itr.error !== NOT_A_DOCUMENT) return itr;
  return { ok: false, error: NOT_A_DOCUMENT };
}

/** Form codes a row answers to: "ITR-7 / ITR-6" → ["ITR-7", "ITR-6"]. */
function rowCodes(item) {
  const code = item.source.formCode;
  if (!code) return [];
  return code
    .split("/")
    .map((c) => normaliseFormCode(c))
    .filter((c) => c !== null);
}

/** The company's rows this challan's form could be the filing for, oldest due first. */
export function challanCandidates(items, formCodes) {
  const wanted = new Set(formCodes);
  const usable = items.filter((i) => i.due !== null && !kycDirectorId(i));
  let found = usable.filter((i) => rowCodes(i).some((c) => wanted.has(c)));
  // An ITR acknowledgement fits the company's ITR row whichever ITR form it names.
  if (found.length === 0 && formCodes.some((c) => c.startsWith("ITR"))) {
    found = usable.filter((i) => i.source.id.split(":")[0] === "itr");
  }
  return found.sort((a, b) => a.due.getTime() - b.due.getTime());
}

/**
 * The row to mark: one already holding this SRN; otherwise the not-yet-filed
 * row whose due date is nearest the SRN date; otherwise the nearest of any.
 */
export function bestChallanRow(candidates, challan) {
  if (candidates.length === 0) return null;
  const same = candidates.find((c) => c.srn && normaliseSrn(c.srn) === challan.srn);
  if (same) return same;
  // An ITR acknowledgement names its year: that year's row.
  if (challan.fyEndingYear !== undefined) {
    const year = candidates.find((c) => c.fyEndingYear === challan.fyEndingYear);
    if (year) return year;
  }
  const paid = parseIsoDate(challan.srnDate).getTime();
  const nearest = (list) =>
    list.reduce((best, c) => (Math.abs(c.due.getTime() - paid) < Math.abs(best.due.getTime() - paid) ? c : best));
  const open = candidates.filter((c) => !c.filedOn);
  return nearest(open.length > 0 ? open : candidates);
}

/**
 * Same CIN, ignoring case, spaces, dashes, invisible characters, and the
 * look-alikes a PDF's text layer can swap (letter O for zero, I or L for one).
 */
export function sameCin(a, b) {
  const n = (s) =>
    s
      .normalize("NFKC")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .replace(/O/g, "0")
      .replace(/[IL]/g, "1");
  return n(a) !== "" && n(a) === n(b);
}

/** A company name without punctuation, "the", or how "private limited" is spelt. */
function nameKey(s) {
  return s
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\b(PRIVATE|PVT|LIMITED|LTD|THE|LLP|OPC|COMPANY|CO)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The company this challan is for: by CIN, else by name. */
export function findChallanCompany(clients, challan) {
  const byCin = clients.find((c) => sameCin(c.cin, challan.cin));
  if (byCin) return { client: byCin, by: "cin" };
  const key = nameKey(challan.companyName);
  const byName = key ? clients.filter((c) => nameKey(c.name) === key) : [];
  return byName.length === 1 ? { client: byName[0], by: "name" } : null;
}
