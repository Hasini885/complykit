/**
 * The documents attached to e-Form AOC-4, kept in the firm's own Word layouts
 * (public/doc-templates/aoc4). Every document reads from one set of answers,
 * so the full pack is filled once.
 */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const str = (v, id) => {
  const x = v[id];
  return (Array.isArray(x) ? x.join("\n") : (x ?? "")).trim();
};
const lines = (v, id) => {
  const x = v[id];
  return (Array.isArray(x) ? x : (x ?? "").split("\n")).map((l) => l.trim()).filter(Boolean);
};

function parts(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

export function ordinal(n) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${s}`;
}

/** The date styles these documents use, all from one ISO date. */
export function dateStyles(iso) {
  const p = parts(iso);
  if (!p)
    return { ord: "", ordNoComma: "", ordOf: "", us: "", plain: "", plainComma: "", dots: "", slash: "", year: "" };
  const [y, m, d] = p;
  const month = MONTHS[m - 1];
  const dd = String(d).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return {
    ord: `${ordinal(d)} ${month}, ${y}`, // 31st March, 2026
    ordNoComma: `${ordinal(d)} ${month} ${y}`, // 31st March 2026
    ordOf: `${ordinal(d)} of ${month}, ${y}`, // 14th of August, 2025
    us: `${month} ${d}, ${y}`, // March 31, 2026
    plain: `${d} ${month} ${y}`, // 31 March 2026
    plainComma: `${d} ${month}, ${y}`, // 31 March, 2026
    dots: `${dd}.${mm}.${y}`, // 31.03.2026
    slash: `${dd}/${mm}/${y}`, // 31/03/2026
    year: String(y),
  };
}

/** "14:30" -> "2:30 PM" */
export function clock12(hhmm) {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return "";
  const h = Number(m[1]);
  return `${((h + 11) % 12) + 1}:${m[2]} ${h >= 12 ? "PM" : "AM"}`;
}

/** Whole rupees in Indian grouping, losses in brackets: -1234567 -> "(12,34,567)". */
export function rupees(n) {
  const s = Math.round(Math.abs(n)).toLocaleString("en-IN");
  return n < 0 ? `(${s})` : s;
}

function amount(v, id) {
  const n = Number(
    str(v, id)
      .replace(/[,\s₹]/g, "")
      .replace(/^\((.*)\)$/, "-$1"),
  );
  return Number.isFinite(n) ? n : 0;
}

/** The last 31 March on or before the day: the year whose accounts are being filed. */
function lastYearEnd(day) {
  const y = day.getMonth() >= 3 ? day.getFullYear() : day.getFullYear() - 1;
  return `${y}-03-31`;
}

/** Which annual report this is: 1st for the first financial year after incorporation. */
export function reportNumber(incorporatedOn, fyEnd) {
  const inc = parts(incorporatedOn);
  const end = parts(fyEnd);
  if (!inc || !end) return "";
  const firstEnd = inc[1] >= 4 ? inc[0] + 1 : inc[0];
  const n = end[0] - firstEnd + 1;
  return n >= 1 ? ordinal(n) : "";
}

const director = (ctx, i) => ctx.directors[i] ?? { name: "", din: "" };

/* ------------------------------------------------------------------ */
/* Fields                                                              */
/* ------------------------------------------------------------------ */

const F = {
  email: {
    id: "email",
    label: "Company e-mail (letterhead)",
    type: "text",
    placeholder: "accounts@company.in",
    initial: (ctx) => ctx.email ?? "",
  },
  mobile: {
    id: "mobile",
    label: "Company mobile (letterhead)",
    type: "text",
    placeholder: "98765 43210",
    initial: (ctx) => ctx.mobile ?? "",
  },
  fyEnd: {
    id: "fyEnd",
    label: "Financial year ended",
    type: "date",
    required: true,
    initial: (ctx) => lastYearEnd(ctx.today),
  },
  incorporatedOn: {
    id: "incorporatedOn",
    label: "Date of incorporation",
    type: "date",
    initial: (ctx) => ctx.incorporatedOn ?? "",
  },
  reportOrdinal: {
    id: "reportOrdinal",
    label: "Annual report number",
    type: "text",
    hint: "1st for the first financial year. Worked out from the incorporation date.",
    initial: (ctx) => reportNumber(ctx.incorporatedOn ?? "", lastYearEnd(ctx.today)),
  },
  business: {
    id: "business",
    label: "Business of the company",
    type: "textarea",
    placeholder: "e.g. providing software development and IT consulting services",
  },
  d1: { id: "d1", label: "Director 1", type: "director", initial: (ctx) => director(ctx, 0).name },
  d1Din: { id: "d1Din", label: "Director 1 DIN", type: "text", initial: (ctx) => director(ctx, 0).din },
  d1Address: { id: "d1Address", label: "Director 1 address", type: "text" },
  d2: { id: "d2", label: "Director 2", type: "director", initial: (ctx) => director(ctx, 1).name },
  d2Din: { id: "d2Din", label: "Director 2 DIN", type: "text", initial: (ctx) => director(ctx, 1).din },
  d2Address: { id: "d2Address", label: "Director 2 address", type: "text" },
  signatory: {
    id: "signatory",
    label: "Signing director",
    type: "director",
    initial: (ctx) => director(ctx, 0).name,
  },
  signatoryDin: {
    id: "signatoryDin",
    label: "Signing director's DIN",
    type: "text",
    initial: (ctx) => director(ctx, 0).din,
  },
  boardDate: {
    id: "boardDate",
    label: "Board meeting approving the accounts",
    type: "date",
    required: true,
    initial: (ctx) => isoOf(ctx.today),
  },
  noticeDate: { id: "noticeDate", label: "Date of the AGM notice", type: "date", initial: (ctx) => isoOf(ctx.today) },
  agmDate: { id: "agmDate", label: "AGM date", type: "date", required: true },
  agmTime: { id: "agmTime", label: "AGM time", type: "time", initial: "12:00" },
  agmVenue: { id: "agmVenue", label: "AGM venue", type: "text", initial: "Registered Office" },
  chairperson: {
    id: "chairperson",
    label: "Chairperson of the AGM",
    type: "director",
    initial: (ctx) => director(ctx, 0).name,
  },
  members: {
    id: "members",
    label: "Members present",
    type: "list",
    placeholder: "One per line: name, number of shares\ne.g. Mr. Ravi Kumar, 5000",
    initial: (ctx) => ctx.directors.map((d) => `${d.name}, `),
  },
  minutesDate: { id: "minutesDate", label: "Date the minutes are signed", type: "date" },
  place: { id: "place", label: "Place of signing", type: "text", placeholder: "e.g. Hyderabad" },
  meetings: {
    id: "meetings",
    label: "Board meetings held in the year",
    type: "list",
    placeholder: "One per line: date, directors on the Board, directors present\ne.g. 21/05/2025, 2, 2",
    hint: "The count in the report and the meetings table come from these lines.",
  },
  firmName: { id: "firmName", label: "Audit firm", type: "text", placeholder: "e.g. Rao & Associates" },
  firmFrn: { id: "firmFrn", label: "Firm registration no. (FRN)", type: "text" },
  firmPartner: { id: "firmPartner", label: "Signing CA", type: "text" },
  firmPartnerRole: {
    id: "firmPartnerRole",
    label: "Signing as",
    type: "select",
    initial: "Proprietor",
    options: [
      { value: "Proprietor", label: "Proprietor" },
      { value: "Partner", label: "Partner" },
    ],
  },
  firmMembershipNo: { id: "firmMembershipNo", label: "Membership no.", type: "text" },
  firmAddress: { id: "firmAddress", label: "Firm address (report footer)", type: "text", wide: true },
  udin: { id: "udin", label: "UDIN", type: "text", hint: "Generate on udin.icai.org once the report is final." },
  reportDate: { id: "reportDate", label: "Date of the audit report", type: "date", initial: (ctx) => isoOf(ctx.today) },
  profitOrLoss: {
    id: "profitOrLoss",
    label: "Result for the year",
    type: "select",
    initial: "profit",
    options: [
      { value: "profit", label: "Profit" },
      { value: "loss", label: "Loss" },
    ],
  },
  auditorTerm: {
    id: "auditorTerm",
    label: "Auditor's term (years)",
    type: "number",
    initial: "5",
    hint: "Up to 5 years for an individual auditor or a firm (s.139(2) limits rotation for some companies).",
  },
  auditFee: { id: "auditFee", label: "Statutory audit fee (₹)", type: "number", placeholder: "e.g. 12,000" },
  msmePreviousYear: { id: "msmePreviousYear", label: "MSME dues, previous year", type: "text", initial: "NA" },
};

function isoOf(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const FIN_ROWS = [
  ["revenue", "Revenue from operations"],
  ["otherIncome", "Other income"],
  ["expenses", "Total expenses (excluding tax)"],
  ["tax", "Tax expense"],
  ["broughtForward", "Surplus brought forward"],
];

const FIN_FIELDS = FIN_ROWS.flatMap(([key, label]) => [
  { id: `fin.${key}Cy`, label: `${label}: current year`, type: "number" },
  { id: `fin.${key}Py`, label: `${label}: previous year`, type: "number" },
]);

/* ------------------------------------------------------------------ */
/* Values for the tokens                                               */
/* ------------------------------------------------------------------ */

export function aoc4Data(v, ctx) {
  const fyEnd = dateStyles(str(v, "fyEnd"));
  const fyEndYear = Number(fyEnd.year);
  const board = dateStyles(str(v, "boardDate"));
  const agm = dateStyles(str(v, "agmDate"));
  const term = Number(str(v, "auditorTerm"));
  const d1 = str(v, "d1");
  const d2 = str(v, "d2");

  const values = {
    company: ctx.companyName,
    cin: ctx.cin,
    registeredOffice: ctx.registeredOffice,
    email: str(v, "email"),
    mobile: str(v, "mobile"),
    fy: fyEndYear ? `${fyEndYear - 1}-${String(fyEndYear % 100).padStart(2, "0")}` : "",
    fyEnd: fyEnd.ord,
    fyEndNoComma: fyEnd.ordNoComma,
    fyEndUs: fyEnd.us,
    fyEndPlain: fyEnd.plain,
    fyEndPlainComma: fyEnd.plainComma,
    fyEndDots: fyEnd.dots,
    incorporatedOnOf: dateStyles(str(v, "incorporatedOn")).ordOf,
    reportOrdinal: str(v, "reportOrdinal"),
    business: str(v, "business"),
    d1,
    d1Din: str(v, "d1Din"),
    d1Address: str(v, "d1Address"),
    d2,
    d2Din: str(v, "d2Din"),
    d2Address: str(v, "d2Address"),
    directorsAnd: [d1, d2].filter(Boolean).join(" and "),
    signatory: str(v, "signatory"),
    signatoryDin: str(v, "signatoryDin"),
    boardDate: board.ord,
    boardDatePlain: board.plain,
    noticeDate: dateStyles(str(v, "noticeDate")).ord,
    agmDate: agm.ord,
    agmYear: agm.year,
    agmTime: clock12(str(v, "agmTime")),
    agmVenue: str(v, "agmVenue"),
    termEndYear: agm.year && term > 0 ? String(Number(agm.year) + term) : "",
    chairperson: str(v, "chairperson"),
    minutesDate: dateStyles(str(v, "minutesDate")).ord,
    place: str(v, "place"),
    firmName: str(v, "firmName"),
    firmFrn: str(v, "firmFrn"),
    firmPartner: str(v, "firmPartner"),
    firmPartnerRole: str(v, "firmPartnerRole"),
    firmMembershipNo: str(v, "firmMembershipNo"),
    firmAddress: str(v, "firmAddress"),
    udin: str(v, "udin"),
    reportDateSlash: dateStyles(str(v, "reportDate")).slash,
    profitOrLoss: str(v, "profitOrLoss"),
    auditFee: str(v, "auditFee") ? rupees(amount(v, "auditFee")) : "",
    msmePreviousYear: str(v, "msmePreviousYear"),
  };

  // Financial summary: the totals are worked out, not typed.
  for (const col of ["Cy", "Py"]) {
    const get = (k) => amount(v, `fin.${k}${col}`);
    const totalIncome = get("revenue") + get("otherIncome");
    const pbt = totalIncome - get("expenses");
    const pat = pbt - get("tax");
    const rows = {
      revenue: get("revenue"),
      otherIncome: get("otherIncome"),
      totalIncome,
      expenses: get("expenses"),
      pbt,
      tax: get("tax"),
      pat,
      broughtForward: get("broughtForward"),
      carriedForward: pat + get("broughtForward"),
    };
    for (const [k, n] of Object.entries(rows)) values[`fin.${k}${col}`] = rupees(n);
  }

  const meetings = lines(v, "meetings").map((line, i) => {
    const [date = "", strength = "", present = ""] = line.split(",").map((s) => s.trim());
    const s = Number(strength);
    const p = Number(present);
    return {
      no: String(i + 1),
      date,
      strength,
      present,
      attendance: s > 0 && p >= 0 && present !== "" ? `${Math.round((p / s) * 100)}%` : "",
    };
  });
  values.meetingCount = meetings.length ? String(meetings.length) : "";

  const members = lines(v, "members").map((line) => {
    const cut = line.lastIndexOf(",");
    return cut === -1
      ? { name: line, shares: "" }
      : { name: line.slice(0, cut).trim(), shares: line.slice(cut + 1).trim() };
  });

  return { values, repeats: { meeting: meetings, member: members } };
}

/* ------------------------------------------------------------------ */
/* The documents                                                       */
/* ------------------------------------------------------------------ */

const FILE = (slug) => `/doc-templates/aoc4/${slug}.docx`;

const DOCS = [
  {
    slug: "letterhead",
    title: "Company letterhead",
    reference: "Section 12(3)(c) — name, registered office, CIN, e-mail on letterheads",
    description: "Blank letterhead with the company name, registered office, CIN and e-mail in the header.",
    keywords: ["letterhead", "letter head", "header"],
    fields: [F.email, F.mobile],
  },
  {
    slug: "board-resolution-fs",
    title: "Board resolution: approval of financial statements and Board's report",
    reference: "Sections 129 and 134 — certified true copy",
    description: "Approves the audited accounts and Board's report, names the signing directors, and authorises AOC-4.",
    keywords: ["board resolution", "approval", "financial statements", "accounts", "board report", "aoc-4", "aoc4"],
    fields: [F.email, F.mobile, F.fyEnd, F.boardDate, F.d1, F.d2, F.signatory, F.signatoryDin],
  },
  {
    slug: "boards-report",
    title: "Board's report",
    reference: "Section 134(3) and Rule 8 of the Companies (Accounts) Rules, 2014",
    description:
      "Full Board's report for a small private company: meetings table, responsibility statement, financial summary and every Rule 8 disclosure.",
    keywords: ["board report", "directors report", "annual report", "section 134", "covering letter"],
    fields: [
      F.fyEnd,
      F.reportOrdinal,
      F.business,
      F.meetings,
      F.d1,
      F.d1Din,
      F.d1Address,
      F.d2,
      F.d2Din,
      F.d2Address,
      F.firmName,
      F.firmFrn,
      ...FIN_FIELDS,
      F.boardDate,
      F.place,
    ],
  },
  {
    slug: "auditors-report",
    title: "Independent auditor's report",
    reference: "Section 143 and SA 700 — with CARO 2020 reference",
    description:
      "Unmodified audit report on the standalone financial statements, on the firm's own letterhead and footer.",
    keywords: ["auditor report", "audit report", "independent auditor", "sa 700", "caro", "udin"],
    fields: [
      F.fyEnd,
      F.firmName,
      F.firmFrn,
      F.firmPartner,
      F.firmPartnerRole,
      F.firmMembershipNo,
      F.udin,
      F.reportDate,
      F.place,
      F.firmAddress,
      F.profitOrLoss,
    ],
  },
  {
    slug: "notes-to-accounts",
    title: "Notes to financial statements",
    reference: "Schedule III — significant accounting policies, AS-18 related parties",
    description:
      "Significant accounting policies, related-party tables, managerial remuneration, auditor's remuneration and MSME note.",
    keywords: ["notes to accounts", "accounting policies", "related party", "as 18", "notes"],
    fields: [F.fyEnd, F.incorporatedOn, F.business, F.d1, F.d1Din, F.d2, F.d2Din, F.auditFee, F.msmePreviousYear],
  },
  {
    slug: "agm-notice",
    title: "Notice of AGM (for the accounts)",
    reference: "Sections 96 and 101 — ordinary business",
    description: "AGM notice to adopt the accounts, re-appoint a retiring director and appoint or ratify the auditor.",
    keywords: ["agm notice", "annual general meeting", "notice"],
    fields: [F.email, F.mobile, F.fyEnd, F.noticeDate, F.agmDate, F.agmTime, F.agmVenue, F.signatory],
  },
  {
    slug: "agm-resolution-fs",
    title: "AGM resolution: adoption of financial statements",
    reference: "Section 129 — certified true copy of the ordinary resolution",
    description: "Members' resolution adopting the audited accounts with the Board's and auditors' reports.",
    keywords: ["agm resolution", "adoption", "financial statements", "ordinary resolution"],
    fields: [F.email, F.mobile, F.fyEnd, F.agmDate, F.signatory],
  },
  {
    slug: "agm-resolution-auditor",
    title: "AGM resolution: appointment of statutory auditor",
    reference: "Sections 139 and 141 — certified true copy; ADT-1 within 15 days",
    description: "Appoints the auditor from this AGM to the AGM at the end of the term.",
    keywords: ["auditor appointment", "adt-1", "adt1", "section 139", "statutory auditor"],
    fields: [F.email, F.mobile, F.agmDate, F.firmName, F.firmFrn, F.auditorTerm, F.signatory],
  },
  {
    slug: "agm-minutes",
    title: "Minutes of the AGM",
    reference: "Section 118 and SS-2",
    description: "Minutes recording quorum, notice, the auditors' report and the business transacted.",
    keywords: ["minutes", "agm minutes", "general meeting minutes", "section 118"],
    fields: [F.email, F.mobile, F.agmDate, F.agmTime, F.agmVenue, F.chairperson, F.members, F.minutesDate, F.place],
  },
];

const COMMON = {
  category: "AOC-4 Attachments",
  data: aoc4Data,
};

export const AOC4_TEMPLATES = [
  {
    ...COMMON,
    id: "aoc4-pack",
    title: "AOC-4 attachments: full pack",
    reference: "Section 137 — everything attached to e-Form AOC-4, in one go",
    description: "Fill the details once and download all nine documents as a .zip of Word files in your firm's format.",
    keywords: ["aoc-4", "aoc4", "pack", "all", "annual filing", "attachments"],
    followUp: "AOC-4 within 30 days of the AGM; MGT-7/7A within 60 days.",
    fields: uniqueFields(DOCS.flatMap((d) => d.fields)),
    files: DOCS.map((d) => ({ name: d.title, url: FILE(d.slug) })),
  },
  ...DOCS.map((d) => ({
    ...COMMON,
    id: `aoc4-${d.slug}`,
    title: d.title,
    reference: d.reference,
    description: d.description,
    keywords: [...d.keywords, "aoc-4", "aoc4"],
    fields: d.fields,
    files: [{ name: d.title, url: FILE(d.slug) }],
  })),
];

function uniqueFields(fields) {
  const seen = new Set();
  return fields.filter((f) => !seen.has(f.id) && !!seen.add(f.id));
}

/** Fields whose answers belong to the audit firm and are remembered between documents. */
export const FIRM_FIELD_IDS = [
  "firmName",
  "firmFrn",
  "firmPartner",
  "firmPartnerRole",
  "firmMembershipNo",
  "firmAddress",
];
