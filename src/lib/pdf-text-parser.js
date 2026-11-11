import { parseIsoDate } from "@/lib/dates";
import { emptyExtraction, normaliseEmail } from "@/lib/pdf-extraction";

/**
 * Reads company details out of the TEXT of a PDF, without any AI service.
 *
 * Runs in the browser on text-based PDFs: the MCA master data printout, the
 * Certificate of Incorporation, and financial statements exported from
 * accounting software. A scanned PDF has no text layer, so it yields nothing
 * here and the caller falls back to the Claude extractor.
 *
 * Input is the document as lines, where cells on the same line that sit far
 * apart are separated by two or more spaces (see src/lib/pdf-text.ts). That
 * column gap is what lets "Company Name  ACME PRIVATE LIMITED" be read as a
 * label and a value.
 *
 * Same contract as the AI extractor: a field the document does not state is
 * null. Nothing here guesses.
 */

/* ------------------------------------------------------------------ */
/* Lines and labels                                                    */
/* ------------------------------------------------------------------ */

const COL = /\s{2,}/;

function clean(line) {
  return line.replace(/ /g, " ").replace(/\s+$/, "");
}

/** Strips the punctuation that sits between a label and its value. */
function stripLead(value) {
  return value.replace(/^[\s:：\-–—|.]+/, "").trim();
}

/** A currency marker tacked onto a label, e.g. "(Rs)", "(in ₹)". */
const CURRENCY_TAG = String.raw`(?:\s*\((?:in\s*)?(?:rs\.?|₹|inr|rupees)\.?\))?`;

/**
 * Finds a label at the start of a line or of a column, and returns the value
 * in the next column — or, when the label stands alone, the next line. The
 * first occurrence whose value passes `accept` wins.
 */
function labelled(lines, label, accept = () => true) {
  const re = new RegExp(String.raw`(?:^|\s{2,}|\|)\s*(?:${label})${CURRENCY_TAG}\s*(?:[:：\-–|]\s*)?(.*)$`, "i");
  for (let i = 0; i < lines.length; i++) {
    const m = re.exec(lines[i]);
    if (!m) continue;
    const rest = stripLead(m[1] ?? "");
    const firstCol = stripLead(rest.split(COL)[0] ?? "");
    if (firstCol) {
      if (accept(firstCol)) return { value: firstCol, rest, line: i };
      continue;
    }
    const next = lines[i + 1]?.trim();
    if (next) {
      const value = stripLead(next.split(COL)[0] ?? "");
      if (accept(value)) return { value, rest: next, line: i + 1, alone: true };
    }
  }
  return null;
}

function firstLabelled(lines, labels, accept) {
  for (const label of labels) {
    const found = labelled(lines, label, accept);
    if (found) return found;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Numbers and dates                                                   */
/* ------------------------------------------------------------------ */

const UNIT = {
  crore: 1e7,
  crores: 1e7,
  cr: 1e7,
  lakh: 1e5,
  lakhs: 1e5,
  lac: 1e5,
  lacs: 1e5,
  million: 1e6,
  millions: 1e6,
  mn: 1e6,
  thousand: 1e3,
  thousands: 1e3,
};

/**
 * The first amount in a value, in plain rupees. Handles Indian grouping,
 * "₹1.5 crore", and accounts-style negatives "(1,23,456)". A bare one- or
 * two-digit number followed by another amount is a note reference in a
 * financial statement ("Share capital  3  10,00,000") and is skipped.
 */
export function parseAmount(value, multiplier = 1) {
  const tokens = [
    ...value.matchAll(
      /(\(?-?)\s*(?:₹|rs\.?|inr)?\s*(\d[\d,]*(?:\.\d+)?)\s*\)?\s*(crores?|cr\b\.?|lakhs?|lacs?|millions?|mn\b|thousands?)?/gi,
    ),
  ];
  for (let i = 0; i < tokens.length; i++) {
    const [, sign, digits, unit] = tokens[i];
    const isNoteRef = /^\d{1,2}$/.test(digits) && i < tokens.length - 1 && !unit;
    if (isNoteRef) continue;
    const n = Number(digits.replace(/,/g, ""));
    if (!Number.isFinite(n)) continue;
    const scale = unit ? (UNIT[unit.toLowerCase().replace(/\.$/, "")] ?? 1) : multiplier;
    const negative = sign.includes("(") || sign.includes("-");
    return Math.round((negative ? -n : n) * scale);
  }
  return null;
}

const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/** "Jun", "June", "Sept" -> 6, 6, 9. Only real month names or their abbreviations. */
function monthOf(word) {
  const w = word.toLowerCase();
  if (w.length < 3) return null;
  const i = MONTH_NAMES.findIndex((name) => name.startsWith(w));
  return i === -1 ? null : i + 1;
}

function iso(y, m, d) {
  const s = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return parseIsoDate(s) ? s : null;
}

/**
 * A date in any of the forms Indian filings use, as yyyy-mm-dd. Numeric dates
 * are read day-first (14/06/2023), as MCA prints them.
 */
export function parseDate(value) {
  const v = value.trim();
  let m = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/.exec(v);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = /\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})\b/.exec(v);
  if (m) return iso(+m[3], +m[2], +m[1]);
  m = /\b(\d{1,2})(?:st|nd|rd|th)?[\s\-]+(?:day\s+of\s+)?([a-z]{3,9})\.?[\s,\-]+(\d{4})\b/i.exec(v);
  if (m) {
    const month = monthOf(m[2]);
    if (month) return iso(+m[3], month, +m[1]);
  }
  m = /\b([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/i.exec(v);
  if (m) {
    const month = monthOf(m[1]);
    if (month) return iso(+m[3], month, +m[2]);
  }
  return null;
}

const SMALL = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
};
const TENS = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  twentieth: 20,
  thirtieth: 30,
};

/** "Twenty first" -> 21, "Two thousand and twenty-three" -> 2023. Null if any word is not a number. */
export function wordsToNumber(words) {
  const tokens = words
    .toLowerCase()
    .split(/[\s\-]+/)
    .filter((t) => t && t !== "and");
  if (tokens.length === 0) return null;
  let total = 0;
  let current = 0;
  for (const t of tokens) {
    if (t in SMALL) current += SMALL[t];
    else if (t in TENS) current += TENS[t];
    else if (t === "hundred") current = (current || 1) * 100;
    else if (t === "thousand") {
      total += (current || 1) * 1000;
      current = 0;
    } else return null;
  }
  return total + current;
}

/** The Certificate of Incorporation writes the date in words. */
function certificateDate(text) {
  const m =
    /incorporated\s+on\s+this\s+([a-z\s\-]+?)\s+day\s+of\s+([a-z]+)\s*,?\s+([a-z\s\-]+?)\s+(?:under|and)\b/i.exec(text);
  if (m) {
    const day = wordsToNumber(m[1]);
    const month = monthOf(m[2]);
    const year = wordsToNumber(m[3]);
    if (day && month && year) return iso(year, month, day);
  }
  const numeric = /incorporated\s+on\s+(?:this\s+)?(.{6,30}?)\s+under\b/i.exec(text);
  return numeric ? parseDate(numeric[1]) : null;
}

/* ------------------------------------------------------------------ */
/* Identity                                                            */
/* ------------------------------------------------------------------ */

const CIN_RE = /\b([LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6})\b/;
const LLPIN_RE = /\b([A-Z]{3}-\d{4})\b/;

/** The ownership code inside a CIN says what kind of company it is. */
const CIN_OWNERSHIP = {
  PTC: "Private Limited Company",
  PLC: "Public Limited Company",
  OPC: "One Person Company",
  NPL: "Section 8 company (not for profit)",
};

function findCin(lines) {
  for (const line of lines) {
    const m = CIN_RE.exec(line) ?? CIN_RE.exec(line.replace(/\s+/g, ""));
    if (m) return m[1];
  }
  return null;
}

function findLlpin(lines) {
  for (let i = 0; i < lines.length; i++) {
    if (!/\bLLPIN\b|\bLLP\s+Identification/i.test(lines[i])) continue;
    const m = LLPIN_RE.exec(lines[i]) ?? LLPIN_RE.exec(lines[i + 1] ?? "");
    if (m) return m[1];
  }
  return null;
}

const NAME_SUFFIX = /\b(private\s+limited|pvt\.?\s*ltd\.?|limited|ltd\.?|llp|foundation)\s*\.?$/i;

function findName(lines, text) {
  const certified = /certify\s+that\s+(.+?)\s+is\s+(?:incorporated|registered)/i.exec(text);
  if (certified) return certified[1].trim();

  const found = firstLabelled(
    lines,
    [
      String.raw`company\s+name`,
      String.raw`name\s+of\s+(?:the\s+)?company`,
      String.raw`llp\s+name`,
      String.raw`name\s+of\s+(?:the\s+)?llp`,
    ],
    (v) => v.length > 2,
  );
  if (found) return found.value;

  // Financial statements open with the company's name on a line of its own.
  for (const line of lines.slice(0, 15)) {
    const first = line.trim().split(COL)[0].trim();
    if (first.length < 120 && NAME_SUFFIX.test(first) && !/\b(act|rules)\b/i.test(first)) {
      return first;
    }
  }
  return null;
}

function findEntityType(lines, text, cin, llpin) {
  if (llpin || (!cin && /limited\s+liability\s+partnership/i.test(text))) {
    return "Limited Liability Partnership";
  }
  if (/one\s+person\s+company/i.test(text)) return "One Person Company";

  const cls = firstLabelled(lines, [String.raw`class\s+of\s+company`, String.raw`company\s+type`]);
  if (cls) {
    if (/one\s*person/i.test(cls.value)) return "One Person Company";
    if (/^private/i.test(cls.value)) return "Private Limited Company";
    if (/^public/i.test(cls.value)) return "Public Limited Company";
  }
  if (cin) return CIN_OWNERSHIP[cin.slice(12, 15)] ?? null;
  return null;
}

/* ------------------------------------------------------------------ */
/* Address                                                             */
/* ------------------------------------------------------------------ */

const PIN = /\b\d{3}\s?\d{3}\b/;

function findAddress(lines) {
  const found = firstLabelled(lines, [
    String.raw`registered\s+office\s+address`,
    String.raw`registered\s+address`,
    String.raw`address\s+of\s+(?:the\s+)?registered\s+office`,
    String.raw`registered\s+office`,
    String.raw`mailing\s+address\s+as\s+per\s+record[^:]*?office`,
  ]);
  if (!found) return null;
  // An address wraps across lines; keep reading until the PIN code.
  const parts = [found.value];
  // MCA's printout centres a label against a wrapped value, so the value's
  // first line can sit ABOVE a label that stands alone: "Plot 1, Road X,",
  // "Registered Address", "500090".
  if (found.alone) {
    // OCR can leave a stray mark from the table border in front: "N    Plot No 38, ...".
    const before = lines[found.line - 2]?.trim().replace(/^\S{1,2}\s{2,}/, "");
    if (before && !COL.test(before) && !before.includes(":") && /,$/.test(before)) parts.unshift(before);
  }
  if (!PIN.test(found.value)) {
    for (const line of lines.slice(found.line + 1, found.line + 4)) {
      const t = line.trim().split(COL)[0];
      if (!t || /:\s*$|^\w[\w\s]{0,30}:/.test(t)) break;
      parts.push(t);
      if (PIN.test(t)) break;
    }
    // No PIN code within reach: the extra lines were probably not address.
    if (!parts.some((p) => PIN.test(p))) parts.splice(1);
  }
  const address = parts.join(", ").replace(/,\s*,/g, ",").trim();
  return address.length > 5 ? address : null;
}

/** "Email Id  NAME[at]GMAIL[dot]COM" on the master data; any address in the text otherwise. */
function findEmail(lines) {
  const found = firstLabelled(lines, [String.raw`e-?mail\s*(?:id|address)?`], (v) => normaliseEmail(v) !== null);
  if (found) return normaliseEmail(found.value);
  for (const line of lines) {
    const m =
      /[A-Za-z0-9._%+-]+\s*(?:@|[[(]\s*at\s*[\])])\s*[A-Za-z0-9.-]+(?:\.|\s*[[(]\s*dot\s*[\])]\s*)[A-Za-z]{2,}(?:(?:\.|\s*[[(]\s*dot\s*[\])]\s*)[A-Za-z]{2,})?/i.exec(
        line,
      );
    const email = m ? normaliseEmail(m[0]) : null;
    if (email) return email;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Financials                                                          */
/* ------------------------------------------------------------------ */

/** "(All amounts in ₹ lakhs)" at the head of a financial statement. */
function statementMultiplier(text) {
  const m =
    /(?:\b(?:amounts?|figures?|rupees)\b|₹|\brs\.?|\binr\b)[^.\n]{0,30}?\bin\s+(?:₹|rs\.?|inr|rupees)?\s*(crores?|lakhs?|lacs?|millions?|thousands?)\b/i.exec(
      text,
    );
  return m ? (UNIT[m[1].toLowerCase()] ?? 1) : 1;
}

/** Labels in financial statements may be preceded by "(a)", "ii.", "1." etc. */
const ITEM = String.raw`(?:\(?(?:[ivx]{1,4}|[a-h]|\d{1,2})[).]\s*)?`;

/** A value that opens with an amount, not a sentence that mentions one. */
const AMOUNT_START = /^\(?\s*-?\s*(?:₹|rs\.?|inr)?\s*\d/i;

function amountAt(lines, labels, multiplier) {
  for (const label of labels) {
    const found = labelled(lines, ITEM + label, (v) => AMOUNT_START.test(v));
    if (!found) continue;
    // The whole rest of the line: a note number may sit in the first column.
    const n = parseAmount(found.rest, multiplier);
    if (n !== null) return n;
  }
  return null;
}

/** Long-term plus short-term (or non-current plus current) borrowings. */
function findBorrowings(lines, multiplier) {
  const re = new RegExp(
    String.raw`^\s*${ITEM}((?:long|short)[\s-]term|non[\s-]current|current)?\s*borrowings\b\s*[:\-]?\s*(.*)$`,
    "i",
  );
  let total = 0;
  const kinds = new Set();
  for (const line of lines) {
    const m = re.exec(line);
    if (!m || !AMOUNT_START.test(m[2].trim())) continue;
    const kind = (m[1] ?? `bare-${kinds.size}`).toLowerCase().replace(/[\s-]/g, "");
    if (kinds.has(kind)) continue;
    const n = parseAmount(m[2], multiplier);
    if (n === null) continue;
    kinds.add(kind);
    total += n;
    if (kinds.size === 2) break;
  }
  return kinds.size > 0 ? total : null;
}

/* ------------------------------------------------------------------ */
/* People                                                              */
/* ------------------------------------------------------------------ */

const ROLE_WORDS =
  /\b(director|designated|partner|managing|chairman|chairperson|whole[\s-]?time|nominee|additional|independent|secretary|chief|officer|cfo|ceo|signatory|name|din|dpin|pan|date|place|begin|end|cessation|appointment|details|membership|executive|non|m\.?\s?no)\b/gi;

function nameLike(s) {
  const t = s.replace(ROLE_WORDS, " ").replace(/[:|/]/g, " ").replace(/\s+/g, " ").trim();
  if (!/^[A-Za-z][A-Za-z.'\- ]{2,60}$/.test(t)) return null;
  return t;
}

function stripDates(s) {
  return s.replace(/\d{1,2}[/.\-]\d{1,2}[/.\-]\d{4}/g, " ").replace(/(^|\s)-(\s|$)/g, " ");
}

/**
 * Directors with their DINs. Two layouts are common: the MCA master data
 * table (a "DIN ... Name" header, then one row per director) and signature
 * blocks in financial statements, where the name sits a line or two above
 * "DIN: 07712345", often with two directors side by side in columns.
 */
/** Words in an MCA director table that are never part of a name. */
const TABLE_WORDS =
  /^(?:sr\.?|no\.?|yes|promoter|professional|independent|nominee|category|designation|signatory|appointment|date|cessation|of|director|managing|whole[\s-]?time|additional|designated|partner|company|secretary|ceo|cfo|chief|financial|executive|officer|manager|authorised|representative|-)$/i;

/** ROLE_WORDS without the global flag, to test one word at a time. */
const ROLE_WORD = new RegExp(`^(?:${ROLE_WORDS.source})$`, "i");

/** The name fragments in one line of an MCA director table. */
function nameBits(line) {
  return line
    .trim()
    .split(COL)
    .flatMap((c) => c.trim().split(/\s+/))
    .filter((w) => /^[A-Za-z][A-Za-z.'\-]*$/.test(w) && !TABLE_WORDS.test(w) && !ROLE_WORD.test(w));
}

/**
 * In MCA's director table a long name wraps, and the printout centres each
 * row's cells vertically, so the name's lines sit above and below the line
 * carrying the DIN. Lines between two rows are split: the upper half belongs
 * to the row above, the lower half to the row below.
 */
function wrappedTableNames(lines, rows, headerAt, end, ys) {
  const names = new Map();
  // A line between two rows: with positions, it goes to the nearer row;
  // without, the upper half of the gap goes up and the lower half down.
  const ownedByUpper = (i, upper, lower, gap, offset) =>
    ys ? Math.abs(ys[i] - ys[upper]) < Math.abs(ys[i] - ys[lower]) : offset < Math.ceil(gap / 2);
  rows.forEach((row, k) => {
    const prev = k > 0 ? rows[k - 1] : headerAt;
    const next = k < rows.length - 1 ? rows[k + 1] : end;
    const gapAbove = row - prev - 1;
    const gapBelow = next - row - 1;
    let aboveStart = row;
    if (k === 0) aboveStart = prev + 1;
    else
      while (aboveStart - 1 > prev && !ownedByUpper(aboveStart - 1, prev, row, gapAbove, aboveStart - 1 - prev - 1))
        aboveStart--;
    let belowEnd = row;
    if (k === rows.length - 1) belowEnd = Math.min(next - 1, row + 3);
    else
      while (belowEnd + 1 < next && ownedByUpper(belowEnd + 1, row, next, gapBelow, belowEnd + 1 - row - 1)) belowEnd++;
    const bits = [];
    for (let i = aboveStart; i < row; i++) bits.push(...nameBits(lines[i]));
    bits.push(...nameBits(lines[row]));
    for (let i = row + 1; i <= belowEnd; i++) bits.push(...nameBits(lines[i]));
    const name = bits.join(" ").trim();
    if (/^[A-Za-z][A-Za-z.'\- ]{2,80}$/.test(name)) names.set(row, name);
  });
  return names;
}

function findDirectors(lines, ys) {
  const out = new Map();
  const wrapped = wrappedNamesByLine(lines, ys);
  let inTable = false;
  for (let i = 0; i < lines.length && out.size < 50; i++) {
    const line = lines[i];
    if (/\b(din|dpin)\b/i.test(line) && /\bname\b/i.test(line) && !/\d{8}/.test(line)) {
      inTable = true;
      continue;
    }
    if (/\b(?:charges|index\s+of\s+charges|financial\s+details)\b/i.test(line)) inTable = false;

    const cols = line.trim().split(COL);
    cols.forEach((col, j) => {
      const din =
        /\b(?:DIN|DPIN)\b\s*(?:no\.?)?\s*[:\-]?\s*(\d{8})\b/i.exec(col)?.[1] ??
        (inTable ? /^\d{8}$/.exec(col.trim())?.[0] : undefined);
      if (!din || out.has(din)) return;

      // Same row (table layout), else the same column one or two lines up.
      let name = wrapped.get(i) ?? null;
      if (inTable && !name) {
        name = cols.map((c) => (c.includes(din) ? null : nameLike(stripDates(c)))).find((n) => n) ?? null;
      }
      name ??= nameLike(stripDates(col.replace(din, " ")));
      for (let back = 1; !name && back <= 2 && i - back >= 0; back++) {
        const above = lines[i - back].trim().split(COL);
        const cell = above.length === cols.length ? above[j] : above.length === 1 ? above[0] : undefined;
        if (!cell || /\d{8}/.test(cell)) break;
        name = nameLike(cell);
      }
      if (name) out.set(din, name);
    });
  }
  return [...out].map(([din, name]) => ({ name, din }));
}

/** Table rows (by line) whose names wrap, read with wrappedTableNames. */
function wrappedNamesByLine(lines, ys) {
  const headerAt = lines.findIndex((l) => /\b(din|dpin)\b/i.test(l) && /\bname\b/i.test(l) && !/\d{8}/.test(l));
  if (headerAt < 0) return new Map();
  let end = lines.length;
  const rows = [];
  for (let i = headerAt + 1; i < lines.length; i++) {
    if (/\b(?:charges|index\s+of\s+charges|financial\s+details)\b/i.test(lines[i])) {
      end = i;
      break;
    }
    if (
      lines[i]
        .trim()
        .split(COL)
        .some((c) => /^\d{8}$/.test(c.trim()))
    )
      rows.push(i);
  }
  // Only when the rows are not one per line: otherwise the plain reading is right.
  const wraps =
    rows.some((r, k) => (k === 0 ? r - headerAt > 1 : r - rows[k - 1] > 1)) ||
    (rows.length > 0 && end - rows[rows.length - 1] > 1 && end !== lines.length);
  return wraps ? wrappedTableNames(lines, rows, headerAt, end, ys) : new Map();
}

function findAuditor(lines) {
  const named = firstLabelled(
    lines,
    [String.raw`name\s+of\s+(?:the\s+)?(?:statutory\s+)?auditors?`, String.raw`statutory\s+auditors?`],
    (v) => /[A-Za-z]{3}/.test(v),
  );
  if (named) return named.value;

  // Audit report signature: "For Rao & Associates" over "Chartered Accountants".
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*for\s+(.+?)\s*$/i.exec(lines[i].trim().split(COL)[0] ?? "");
    if (!m || /^(?:and\s+on\s+behalf|the\s+year|the\s+period)/i.test(m[1])) continue;
    const near = lines.slice(i, i + 4).join(" ");
    if (/chartered\s+accountants|firm\s+reg/i.test(near)) {
      return m[1].replace(/,?\s*chartered\s+accountants.*$/i, "").trim();
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */

function yesNo(value, yes, no) {
  if (!value) return null;
  if (no.test(value)) return false;
  if (yes.test(value)) return true;
  return null;
}

export function parseCompanyText(rawLines, rawYs) {
  // `rawYs`, when given, is each line's height down the document, used to tell
  // which row of a table a wrapped line belongs to.
  const kept = rawLines.map((l, i) => ({ l: clean(l), y: rawYs?.[i] })).filter((x) => x.l.trim() !== "");
  const lines = kept.map((x) => x.l);
  const ys = rawYs && rawYs.length === rawLines.length ? kept.map((x) => x.y) : undefined;
  const text = lines
    .map((l) => l.trim())
    .join(" ")
    .replace(/\s+/g, " ");
  const result = emptyExtraction();
  if (lines.length === 0) return result;

  const cin = findCin(lines);
  const llpin = cin ? null : findLlpin(lines);
  result.cin = cin ?? llpin;
  result.companyName = findName(lines, text);
  result.entityTypeRaw = findEntityType(lines, text, cin, llpin);

  const incorporated = firstLabelled(
    lines,
    [String.raw`date\s+of\s+incorporation`, String.raw`incorporation\s+date`, String.raw`date\s+of\s+registration`],
    (v) => parseDate(v) !== null,
  );
  result.incorporationDate = incorporated ? parseDate(incorporated.value) : certificateDate(text);

  const agm = firstLabelled(
    lines,
    [String.raw`date\s+of\s+(?:the\s+)?last\s+agm`, String.raw`last\s+agm\s+date`],
    (v) => parseDate(v) !== null,
  );
  result.lastAgmDate = agm ? parseDate(agm.value) : null;

  result.registeredOfficeAddress = findAddress(lines);
  result.email = findEmail(lines);

  const status = firstLabelled(lines, [String.raw`(?:company|llp)\s+status`], (v) => /[a-z]{4}/i.test(v));
  result.companyStatusRaw = status?.value ?? null;

  const listing = firstLabelled(lines, [
    String.raw`whether\s+listed\s+or\s+not`,
    String.raw`listing\s+status`,
    String.raw`listed\s+status`,
  ]);
  result.listed =
    yesNo(listing?.value, /\blisted\b/i, /\bunlisted\b|\bnot\s+listed\b/i) ?? (cin ? cin[0] === "L" : null);

  // Master data figures are plain rupees; a financial statement may say "in lakhs".
  const k = statementMultiplier(text);
  result.authorisedCapital = amountAt(lines, [String.raw`authori[sz]ed\s+(?:share\s+)?capital`], k);
  result.paidUpCapital = amountAt(
    lines,
    [String.raw`paid[\s-]*up\s+(?:share\s+)?capital`, String.raw`(?:equity\s+)?share\s+capital`],
    k,
  );
  result.llpContribution = amountAt(
    lines,
    [String.raw`total\s+obligation\s+of\s+contribution`, String.raw`total\s+contribution`],
    k,
  );
  result.turnover = amountAt(
    lines,
    [String.raw`(?:total\s+)?revenue\s+from\s+operations`, String.raw`turnover`, String.raw`(?:net\s+)?sales`],
    k,
  );
  result.netProfit = amountAt(
    lines,
    [
      String.raw`(?:net\s+)?profit\s*(?:\/\s*\(loss\)\s*)?(?:after\s+tax\s+)?for\s+the\s+(?:year|period)`,
      String.raw`profit\s+after\s+tax`,
      String.raw`net\s+profit`,
    ],
    k,
  );
  result.netWorth = amountAt(
    lines,
    [String.raw`net\s+worth`, String.raw`total\s+equity`, String.raw`(?:total\s+)?shareholders['’]?\s+funds`],
    k,
  );
  result.borrowings = findBorrowings(lines, k);

  const count = firstLabelled(
    lines,
    [String.raw`(?:number|no\.?)\s+of\s+(?:designated\s+)?(?:directors|partners)`],
    (v) => /^\d{1,3}\b/.test(v),
  );
  result.numberOfDirectors = count ? Number(/^\d{1,3}/.exec(count.value)[0]) || null : null;

  const directors = findDirectors(lines, ys);
  result.directors = directors.length > 0 ? directors : null;
  result.auditorName = findAuditor(lines);

  return result;
}
