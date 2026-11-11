import { isoDate } from "@/lib/dates";
import { AOC4_TEMPLATES } from "@/lib/documents/aoc4";
/**
 * Document templates for company secretarial work.
 *
 * Drafted for this toolkit against the Companies Act, 2013, its Rules and the
 * Secretarial Standards (SS-1 for Board meetings, SS-2 for general meetings).
 * Every draft is a starting point: the user reviews it, and a CS/CA settles it
 * before it is signed or filed.
 */

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const str = (v, id, fallback = "") => {
  const x = v[id];
  const s = Array.isArray(x) ? x.join(", ") : (x ?? "");
  return s.trim() || fallback;
};
const list = (v, id) => {
  const x = v[id];
  return (Array.isArray(x) ? x : x ? [x] : []).map((s) => s.trim()).filter(Boolean);
};

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

/** "2026-10-28" -> "28 October 2026"; blanks become a fill-in line. */
export function longDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return "__________";
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

/** "14:30" -> "2:30 p.m." */
export function clockTime(hhmm) {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return "__________";
  const h = Number(m[1]);
  const suffix = h >= 12 ? "p.m." : "a.m.";
  return `${((h + 11) % 12) + 1}:${m[2]} ${suffix}`;
}

const blank = (s) => s || "__________";
const today = (ctx) => isoDate(ctx.today);

function letterhead(ctx) {
  return {
    kind: "letterhead",
    name: blank(ctx.companyName).toUpperCase(),
    lines: [
      ctx.cin ? `CIN: ${ctx.cin}` : "CIN: __________",
      `Registered office: ${blank(ctx.registeredOffice)}`,
      `Mobile: ${blank(ctx.mobile ?? "")}  |  Email: ${blank(ctx.email ?? "")}`,
    ],
  };
}

function certifiedCopy(ctx, v, meetingDateField = "meetingDate") {
  return [
    { kind: "gap" },
    { kind: "para", text: `For ${blank(ctx.companyName)}` },
    { kind: "gap" },
    {
      kind: "signature",
      lines: [
        blank(str(v, "signatory")),
        str(v, "signatoryRole", "Director"),
        str(v, "signatoryDin") ? `DIN: ${str(v, "signatoryDin")}` : "DIN: __________",
        `Date: ${longDate(str(v, "issueDate", str(v, meetingDateField)))}`,
        `Place: ${blank(str(v, "place"))}`,
      ],
    },
  ];
}

/** "Certified true copy of the resolution passed by the Board ... on <date>". */
function resolutionHeader(ctx, v) {
  return [
    letterhead(ctx),
    { kind: "title", text: "Certified true copy of the resolution passed by the Board of Directors" },
    {
      kind: "para",
      align: "center",
      text: `at its meeting held on ${longDate(str(v, "meetingDate"))} at ${blank(str(v, "venue", ctx.registeredOffice))}`,
    },
    { kind: "gap" },
  ];
}

/* Fields reused across templates. */
const meetingDate = {
  id: "meetingDate",
  label: "Date of the Board meeting",
  type: "date",
  required: true,
  initial: today,
};
const venue = {
  id: "venue",
  label: "Venue",
  type: "text",
  initial: (ctx) => ctx.registeredOffice,
  hint: "The registered office, or 'through video conferencing' for a VC meeting.",
  wide: true,
};
const place = { id: "place", label: "Place of signing", type: "text", placeholder: "e.g. Bengaluru" };
const signatory = {
  id: "signatory",
  label: "Signed by",
  type: "director",
  initial: (ctx) => ctx.directors[0]?.name ?? "",
  hint: "Pick a director of the company, or type a name.",
};
const signatoryRole = {
  id: "signatoryRole",
  label: "Designation",
  type: "select",
  options: [
    { value: "Director", label: "Director" },
    { value: "Managing Director", label: "Managing Director" },
    { value: "Whole-time Director", label: "Whole-time Director" },
    { value: "Company Secretary", label: "Company Secretary" },
  ],
  initial: "Director",
};
const signatoryDin = {
  id: "signatoryDin",
  label: "DIN / membership no. of signatory",
  type: "text",
  initial: (ctx) => ctx.directors[0]?.din ?? "",
};
const SIGNING = [signatory, signatoryRole, signatoryDin, place];

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */

export const DOC_TEMPLATES = [
  /* ---------------- Board Meetings ---------------- */
  {
    id: "board-meeting-notice",
    title: "Notice of Board Meeting & Agenda",
    category: "Board Meetings",
    reference: "Section 173(3), Companies Act, 2013; Secretarial Standard-1",
    description: "Notice to every director, at least seven days before the meeting, with the agenda.",
    keywords: ["board meeting", "notice", "agenda", "ss-1", "convene", "call a meeting"],
    fields: [
      { id: "meetingNo", label: "Meeting number (optional)", type: "text", placeholder: "e.g. 3/2026-27" },
      meetingDate,
      { id: "meetingTime", label: "Time", type: "time", initial: "11:00" },
      venue,
      {
        id: "mode",
        label: "Mode",
        type: "select",
        options: [
          { value: "physical", label: "In person" },
          { value: "vc", label: "In person, with video conferencing available" },
          { value: "vc-only", label: "Through video conferencing only" },
        ],
        initial: "physical",
      },
      {
        id: "agenda",
        label: "Agenda items",
        type: "list",
        wide: true,
        initial: [
          "To grant leave of absence, if any",
          "To confirm the minutes of the previous meeting of the Board",
          "To note the disclosures of interest received from directors (Form MBP-1)",
          "To consider any other matter with the permission of the Chairperson",
        ],
      },
      {
        id: "issueDate",
        label: "Date of the notice",
        type: "date",
        initial: today,
        hint: "At least 7 days before the meeting (SS-1).",
      },
      ...SIGNING,
    ],
    render: (v, ctx) => {
      const mode = str(v, "mode");
      const where =
        mode === "vc-only"
          ? "through video conferencing / other audio-visual means"
          : `at ${blank(str(v, "venue", ctx.registeredOffice))}${mode === "vc" ? ", with the facility to participate through video conferencing" : ""}`;
      return [
        letterhead(ctx),
        {
          kind: "title",
          text: `Notice of ${str(v, "meetingNo") ? `the ${str(v, "meetingNo")} ` : ""}Meeting of the Board of Directors`,
        },
        { kind: "para", text: "To," },
        { kind: "para", text: "All the Directors of the Company" },
        { kind: "gap" },
        {
          kind: "para",
          align: "justify",
          text: `NOTICE is hereby given that a meeting of the Board of Directors of ${blank(ctx.companyName)} will be held on ${longDate(str(v, "meetingDate"))} at ${clockTime(str(v, "meetingTime"))} ${where}, to transact the business set out in the agenda below.`,
        },
        {
          kind: "details",
          rows: [
            ["Date", longDate(str(v, "meetingDate"))],
            ["Time", clockTime(str(v, "meetingTime"))],
            ["Venue / mode", mode === "vc-only" ? "Video conferencing" : blank(str(v, "venue", ctx.registeredOffice))],
          ],
        },
        { kind: "heading", text: "Agenda" },
        { kind: "list", ordered: true, items: list(v, "agenda").length ? list(v, "agenda") : ["__________"] },
        {
          kind: "para",
          align: "justify",
          text: "Notes to the agenda are enclosed. Directors who wish to participate through video conferencing are requested to inform the Company in advance, so that the necessary arrangements can be made. Kindly confirm your attendance.",
        },
        ...certifiedCopy(ctx, v),
      ];
    },
  },

  /* ---------------- Board Resolutions ---------------- */
  {
    id: "resolution-additional-director",
    title: "Board Resolution: Appointment of Additional Director",
    category: "Board Resolutions",
    reference: "Section 161(1), Companies Act, 2013",
    description: "Appoints an additional director to hold office until the next AGM, and authorises the filing.",
    keywords: ["additional director", "appoint director", "new director", "dir-12", "161"],
    followUp: "File DIR-12 within 30 days of the appointment; obtain DIR-2 and DIR-8 before it.",
    fields: [
      meetingDate,
      venue,
      { id: "appointee", label: "Name of the appointee", type: "text", required: true },
      { id: "appointeeDin", label: "DIN of the appointee", type: "text", placeholder: "8 digits" },
      {
        id: "category",
        label: "Category",
        type: "select",
        options: [
          { value: "Non-Executive", label: "Non-Executive Director" },
          { value: "Executive", label: "Executive Director" },
          { value: "Independent", label: "Independent Director" },
        ],
        initial: "Non-Executive",
      },
      { id: "effectiveDate", label: "Appointment effective from", type: "date", initial: today },
      ...SIGNING,
    ],
    render: (v, ctx) => {
      const who = blank(str(v, "appointee"));
      const din = str(v, "appointeeDin") ? ` (DIN: ${str(v, "appointeeDin")})` : "";
      return [
        ...resolutionHeader(ctx, v),
        { kind: "heading", text: `Appointment of ${who} as an Additional Director` },
        {
          kind: "resolution",
          text: `RESOLVED THAT pursuant to Section 161(1) and other applicable provisions of the Companies Act, 2013 and the rules made thereunder, and the Articles of Association of the Company, ${who}${din}, who has given his/her consent in Form DIR-2 and a declaration in Form DIR-8 that he/she is not disqualified, be and is hereby appointed as an Additional Director (${str(v, "category", "Non-Executive")}) of the Company with effect from ${longDate(str(v, "effectiveDate"))}, to hold office up to the date of the next Annual General Meeting of the Company.`,
        },
        {
          kind: "resolution",
          text: "RESOLVED FURTHER THAT any Director or the Company Secretary of the Company be and is hereby severally authorised to file Form DIR-12 with the Registrar of Companies, to make the necessary entries in the statutory registers, and to do all such acts, deeds and things as may be necessary to give effect to this resolution.",
        },
        ...certifiedCopy(ctx, v),
      ];
    },
  },
  {
    id: "resolution-interim-dividend",
    title: "Board Resolution: Declaration of Interim Dividend",
    category: "Board Resolutions",
    reference: "Sections 123(3) and 127, Companies Act, 2013",
    description: "Declares an interim dividend and fixes the record date and payment timeline.",
    keywords: ["dividend", "interim dividend", "declare dividend", "123", "record date"],
    followUp:
      "Deposit the dividend in a separate bank account within 5 days, and pay within 30 days of declaration (s.127).",
    fields: [
      meetingDate,
      venue,
      {
        id: "perShare",
        label: "Dividend per equity share (₹)",
        type: "number",
        required: true,
        placeholder: "e.g. 2.50",
      },
      { id: "faceValue", label: "Face value per share (₹)", type: "number", initial: "10" },
      { id: "fy", label: "Financial year", type: "text", placeholder: "e.g. 2026-27", initial: "" },
      { id: "recordDate", label: "Record date", type: "date" },
      {
        id: "bank",
        label: "Bank for the dividend account",
        type: "text",
        placeholder: "e.g. HDFC Bank, MG Road branch",
        wide: true,
      },
      ...SIGNING,
    ],
    render: (v, ctx) => {
      const per = Number(str(v, "perShare")) || 0;
      const face = Number(str(v, "faceValue")) || 0;
      const pct = per && face ? ` (${Math.round((per / face) * 10000) / 100}% of the face value)` : "";
      return [
        ...resolutionHeader(ctx, v),
        { kind: "heading", text: "Declaration of interim dividend" },
        {
          kind: "resolution",
          text: `RESOLVED THAT pursuant to Section 123(3) and other applicable provisions of the Companies Act, 2013 and the rules made thereunder, an interim dividend of ₹${blank(str(v, "perShare"))} per equity share of ₹${blank(str(v, "faceValue"))} each${pct} for the financial year ${blank(str(v, "fy"))} be and is hereby declared out of the profits of the Company, and be paid to the members whose names appear in the Register of Members as on ${longDate(str(v, "recordDate"))}, being the record date fixed for the purpose.`,
        },
        {
          kind: "resolution",
          text: `RESOLVED FURTHER THAT a separate bank account be opened with ${blank(str(v, "bank"))} for the purpose, the total amount of the dividend be deposited in that account within five days of this declaration, and the dividend be paid within thirty days of the date of declaration in accordance with Section 127 of the Act.`,
        },
        {
          kind: "resolution",
          text: "RESOLVED FURTHER THAT any Director or the Company Secretary be and is hereby authorised to sign the dividend warrants and to do all such acts as may be necessary to give effect to this resolution, including deduction of tax at source as applicable.",
        },
        ...certifiedCopy(ctx, v),
      ];
    },
  },
  {
    id: "resolution-bank-account",
    title: "Board Resolution: Opening of a Bank Account",
    category: "Board Resolutions",
    reference: "Section 179(3), Companies Act, 2013",
    description: "Authorises opening a current account and names the signatories and mode of operation.",
    keywords: ["bank account", "open account", "current account", "signatories", "bank"],
    fields: [
      meetingDate,
      venue,
      {
        id: "bank",
        label: "Bank and branch",
        type: "text",
        required: true,
        wide: true,
        placeholder: "e.g. State Bank of India, Koramangala branch",
      },
      {
        id: "accountType",
        label: "Account type",
        type: "select",
        options: [
          { value: "current account", label: "Current account" },
          { value: "cash credit account", label: "Cash credit account" },
          { value: "overdraft account", label: "Overdraft account" },
        ],
        initial: "current account",
      },
      {
        id: "signatories",
        label: "Authorised signatories",
        type: "list",
        wide: true,
        initial: (ctx) => ctx.directors.slice(0, 2).map((d) => `${d.name}, Director (DIN: ${d.din})`),
      },
      {
        id: "operation",
        label: "Mode of operation",
        type: "select",
        options: [
          { value: "singly", label: "Any one signatory, singly" },
          { value: "jointly by any two", label: "Any two signatories, jointly" },
          { value: "jointly by all", label: "All signatories, jointly" },
        ],
        initial: "singly",
      },
      ...SIGNING,
    ],
    render: (v, ctx) => [
      ...resolutionHeader(ctx, v),
      { kind: "heading", text: "Opening of a bank account" },
      {
        kind: "resolution",
        text: `RESOLVED THAT a ${str(v, "accountType", "current account")} be opened in the name of the Company with ${blank(str(v, "bank"))}, and that the bank be and is hereby authorised to honour all cheques, instructions and other instruments signed or given in accordance with this resolution.`,
      },
      {
        kind: "resolution",
        text: `RESOLVED FURTHER THAT the account be operated ${str(v, "operation", "singly")} by the following authorised signatories:`,
      },
      { kind: "list", ordered: true, items: list(v, "signatories").length ? list(v, "signatories") : ["__________"] },
      {
        kind: "resolution",
        text: "RESOLVED FURTHER THAT a certified copy of this resolution be furnished to the bank, and that the bank's standard form of resolution, if any, be deemed to be adopted by the Board.",
      },
      ...certifiedCopy(ctx, v),
    ],
  },
  {
    id: "resolution-registered-office",
    title: "Board Resolution: Shifting of Registered Office (within the city)",
    category: "Board Resolutions",
    reference: "Section 12(4), Companies Act, 2013",
    description: "Shifts the registered office within the local limits of the same city, town or village.",
    keywords: ["registered office", "shift office", "change address", "inc-22", "office address"],
    followUp:
      "File INC-22 within 30 days of the change. A shift outside local limits needs a special resolution instead.",
    fields: [
      meetingDate,
      venue,
      { id: "newAddress", label: "New registered office address", type: "textarea", required: true, wide: true },
      { id: "effectiveDate", label: "With effect from", type: "date", initial: today },
      ...SIGNING,
    ],
    render: (v, ctx) => [
      ...resolutionHeader(ctx, v),
      { kind: "heading", text: "Shifting of the registered office within the local limits" },
      {
        kind: "resolution",
        text: `RESOLVED THAT pursuant to Section 12 and other applicable provisions of the Companies Act, 2013 and the rules made thereunder, the registered office of the Company be shifted from ${blank(ctx.registeredOffice)} to ${blank(str(v, "newAddress"))}, being within the local limits of the same city, town or village, with effect from ${longDate(str(v, "effectiveDate"))}.`,
      },
      {
        kind: "resolution",
        text: "RESOLVED FURTHER THAT any Director or the Company Secretary be and is hereby authorised to file Form INC-22 with the Registrar of Companies within thirty days of the change, to update the Company's name board, letterheads and other stationery, and to do all acts necessary to give effect to this resolution.",
      },
      ...certifiedCopy(ctx, v),
    ],
  },

  /* ---------------- General Meetings ---------------- */
  {
    id: "agm-notice",
    title: "Notice of Annual General Meeting",
    category: "General Meetings",
    reference: "Sections 96 and 101, Companies Act, 2013; Secretarial Standard-2",
    description: "Notice to members, at least 21 clear days before the AGM, with the ordinary business.",
    keywords: ["agm", "annual general meeting", "notice to members", "ss-2", "101"],
    fields: [
      { id: "agmNo", label: "AGM number", type: "text", placeholder: "e.g. 7th" },
      { id: "agmDate", label: "Date of the AGM", type: "date", required: true },
      { id: "agmTime", label: "Time", type: "time", initial: "11:00" },
      venue,
      { id: "fyEnd", label: "Financial year ended", type: "date", hint: "Usually 31 March." },
      { id: "retiringDirector", label: "Director retiring by rotation (optional)", type: "director", initial: "" },
      { id: "dividend", label: "Final dividend per share, if any (₹)", type: "number" },
      {
        id: "specialBusiness",
        label: "Special business (optional)",
        type: "list",
        wide: true,
        hint: "Each item needs an explanatory statement under Section 102.",
      },
      {
        id: "issueDate",
        label: "Date of the notice",
        type: "date",
        initial: today,
        hint: "At least 21 clear days before the AGM.",
      },
      ...SIGNING,
    ],
    render: (v, ctx) => {
      const fyEnd = longDate(str(v, "fyEnd"));
      const items = [
        `To receive, consider and adopt the audited financial statements of the Company for the financial year ended ${fyEnd}, together with the reports of the Board of Directors and the Auditors thereon.`,
        ...(str(v, "dividend")
          ? [
              `To declare a final dividend of ₹${str(v, "dividend")} per equity share for the financial year ended ${fyEnd}.`,
            ]
          : []),
        ...(str(v, "retiringDirector")
          ? [
              `To appoint a Director in place of ${str(v, "retiringDirector")}, who retires by rotation and, being eligible, offers himself/herself for re-appointment.`,
            ]
          : []),
      ];
      const special = list(v, "specialBusiness");
      return [
        letterhead(ctx),
        { kind: "title", text: `Notice of the ${blank(str(v, "agmNo"))} Annual General Meeting` },
        {
          kind: "para",
          align: "justify",
          text: `NOTICE is hereby given that the ${blank(str(v, "agmNo"))} Annual General Meeting of the members of ${blank(ctx.companyName)} will be held on ${longDate(str(v, "agmDate"))} at ${clockTime(str(v, "agmTime"))} at ${blank(str(v, "venue", ctx.registeredOffice))}, to transact the following business:`,
        },
        { kind: "heading", text: "Ordinary business" },
        { kind: "list", ordered: true, items },
        ...(special.length
          ? [
              { kind: "heading", text: "Special business" },
              { kind: "list", ordered: true, items: special },
            ]
          : []),
        { kind: "heading", text: "Notes" },
        {
          kind: "list",
          items: [
            "A member entitled to attend and vote is entitled to appoint a proxy to attend and vote instead of himself/herself, and the proxy need not be a member. The proxy form, duly completed, must reach the registered office not less than 48 hours before the meeting.",
            ...(special.length
              ? [
                  "The explanatory statement under Section 102 of the Companies Act, 2013 in respect of the special business is annexed.",
                ]
              : []),
            "Members are requested to bring the attendance slip and to notify any change in their address or bank details to the Company.",
          ],
        },
        { kind: "gap" },
        { kind: "para", text: "By order of the Board" },
        ...certifiedCopy(ctx, v, "agmDate"),
      ];
    },
  },

  /* ---------------- Director Compliance ---------------- */
  {
    id: "dir-2",
    title: "Form DIR-2: Consent to Act as a Director",
    category: "Director Compliance",
    reference:
      "Section 152(5), Companies Act, 2013; Rule 8, Companies (Appointment and Qualification of Directors) Rules, 2014",
    description: "The appointee's written consent, given before the appointment and filed with DIR-12.",
    keywords: ["dir-2", "consent", "director consent", "152"],
    fields: [
      { id: "name", label: "Full name of the director", type: "director", required: true, initial: "" },
      { id: "din", label: "DIN", type: "text" },
      { id: "parent", label: "Father's / mother's name", type: "text" },
      { id: "address", label: "Residential address", type: "textarea", wide: true },
      { id: "email", label: "Email", type: "text" },
      { id: "mobile", label: "Mobile", type: "text" },
      { id: "occupation", label: "Occupation", type: "text" },
      { id: "dob", label: "Date of birth", type: "date" },
      { id: "issueDate", label: "Date", type: "date", initial: today },
      place,
    ],
    render: (v, ctx) => [
      { kind: "title", text: "Form DIR-2" },
      { kind: "subtitle", text: "Consent to act as a director of a company" },
      {
        kind: "para",
        align: "center",
        text: "[Pursuant to Section 152(5) and Rule 8 of the Companies (Appointment and Qualification of Directors) Rules, 2014]",
      },
      { kind: "gap" },
      { kind: "para", text: "To," },
      { kind: "para", text: `The Board of Directors, ${blank(ctx.companyName)}` },
      { kind: "para", text: blank(ctx.registeredOffice) },
      { kind: "gap" },
      {
        kind: "para",
        align: "justify",
        text: `I, ${blank(str(v, "name"))}, hereby give my consent to act as a director of ${blank(ctx.companyName)} pursuant to Section 152(5) of the Companies Act, 2013, and certify that I am not disqualified to be appointed as a director under the Act.`,
      },
      {
        kind: "details",
        rows: [
          ["Director Identification Number (DIN)", blank(str(v, "din"))],
          ["Name", blank(str(v, "name"))],
          ["Father's / mother's name", blank(str(v, "parent"))],
          ["Address", blank(str(v, "address"))],
          ["Email", blank(str(v, "email"))],
          ["Mobile", blank(str(v, "mobile"))],
          ["Occupation", blank(str(v, "occupation"))],
          ["Date of birth", longDate(str(v, "dob"))],
        ],
      },
      { kind: "gap" },
      {
        kind: "signature",
        lines: [
          `(${blank(str(v, "name"))})`,
          `Date: ${longDate(str(v, "issueDate"))}`,
          `Place: ${blank(str(v, "place"))}`,
        ],
      },
    ],
  },
  {
    id: "dir-8",
    title: "Form DIR-8: Intimation of Non-Disqualification",
    category: "Director Compliance",
    reference:
      "Section 164(2), Companies Act, 2013; Rule 14(1), Companies (Appointment and Qualification of Directors) Rules, 2014",
    description:
      "Each director's declaration that he or she is not disqualified, given before appointment and every year.",
    keywords: ["dir-8", "disqualification", "164", "non-disqualification"],
    fields: [
      {
        id: "name",
        label: "Full name of the director",
        type: "director",
        required: true,
        initial: (ctx) => ctx.directors[0]?.name ?? "",
      },
      { id: "din", label: "DIN", type: "text", initial: (ctx) => ctx.directors[0]?.din ?? "" },
      { id: "issueDate", label: "Date", type: "date", initial: today },
      place,
    ],
    render: (v, ctx) => [
      { kind: "title", text: "Form DIR-8" },
      { kind: "subtitle", text: "Intimation by a director" },
      {
        kind: "para",
        align: "center",
        text: "[Pursuant to Section 164(2) and Rule 14(1) of the Companies (Appointment and Qualification of Directors) Rules, 2014]",
      },
      { kind: "gap" },
      { kind: "para", text: "To," },
      { kind: "para", text: `The Board of Directors, ${blank(ctx.companyName)}` },
      { kind: "para", text: blank(ctx.registeredOffice) },
      { kind: "gap" },
      {
        kind: "para",
        align: "justify",
        text: `I, ${blank(str(v, "name"))} (DIN: ${blank(str(v, "din"))}), a director of ${blank(ctx.companyName)}, hereby give notice that I am not disqualified to become a director in the Company under Section 164(2) of the Companies Act, 2013: no company of which I am or was a director in the preceding three financial years has (a) failed to file its financial statements or annual returns for a continuous period of three financial years, or (b) failed to repay deposits accepted, to redeem debentures on the due date, or to pay interest or dividend due, where such failure has continued for one year or more.`,
      },
      { kind: "gap" },
      {
        kind: "signature",
        lines: [
          `(${blank(str(v, "name"))})`,
          `DIN: ${blank(str(v, "din"))}`,
          `Date: ${longDate(str(v, "issueDate"))}`,
          `Place: ${blank(str(v, "place"))}`,
        ],
      },
    ],
  },
  {
    id: "mbp-1",
    title: "Form MBP-1: Notice of Interest by a Director",
    category: "Director Compliance",
    reference:
      "Section 184(1), Companies Act, 2013; Rule 9(1), Companies (Meetings of Board and its Powers) Rules, 2014",
    description:
      "Disclosure of each director's interest in other entities: at the first Board meeting of the year and on any change.",
    keywords: ["mbp-1", "disclosure of interest", "184", "interest"],
    fields: [
      {
        id: "name",
        label: "Full name of the director",
        type: "director",
        required: true,
        initial: (ctx) => ctx.directors[0]?.name ?? "",
      },
      { id: "din", label: "DIN", type: "text", initial: (ctx) => ctx.directors[0]?.din ?? "" },
      {
        id: "interests",
        label: "Interests held",
        type: "list",
        wide: true,
        hint: "One per line: entity — nature of interest — shareholding — date it arose.",
        placeholder: "ABC Pvt Ltd — Director — 10% — 01 Apr 2024",
      },
      { id: "issueDate", label: "Date", type: "date", initial: today },
      place,
    ],
    render: (v, ctx) => {
      const interests = list(v, "interests");
      return [
        { kind: "title", text: "Form MBP-1" },
        { kind: "subtitle", text: "Notice of interest by a director" },
        {
          kind: "para",
          align: "center",
          text: "[Pursuant to Section 184(1) and Rule 9(1) of the Companies (Meetings of Board and its Powers) Rules, 2014]",
        },
        { kind: "gap" },
        { kind: "para", text: "To," },
        { kind: "para", text: `The Board of Directors, ${blank(ctx.companyName)}` },
        { kind: "para", text: blank(ctx.registeredOffice) },
        { kind: "gap" },
        {
          kind: "para",
          align: "justify",
          text: `I, ${blank(str(v, "name"))} (DIN: ${blank(str(v, "din"))}), a director of the Company, hereby give notice of my concern or interest, including shareholding, in the following companies, bodies corporate, firms or other associations of individuals:`,
        },
        { kind: "list", ordered: true, items: interests.length ? interests : ["Nil"] },
        { kind: "gap" },
        {
          kind: "signature",
          lines: [
            `(${blank(str(v, "name"))})`,
            `DIN: ${blank(str(v, "din"))}`,
            `Date: ${longDate(str(v, "issueDate"))}`,
            `Place: ${blank(str(v, "place"))}`,
          ],
        },
      ];
    },
  },

  /* ---------------- Appointments & Resignations ---------------- */
  {
    id: "director-appointment-letter",
    title: "Director Appointment Letter",
    category: "Appointments & Resignations",
    reference: "Section 152 (and Schedule IV, para IV for an independent director), Companies Act, 2013",
    description: "Formal letter setting out the terms of a director's appointment.",
    keywords: ["appointment letter", "director appointment", "independent director", "terms of appointment"],
    fields: [
      { id: "name", label: "Director's name", type: "director", required: true, initial: "" },
      { id: "address", label: "Director's address", type: "textarea", wide: true },
      {
        id: "category",
        label: "Category",
        type: "select",
        options: [
          { value: "Non-Executive Director", label: "Non-Executive Director" },
          { value: "Independent Director", label: "Independent Director" },
          { value: "Executive Director", label: "Executive Director" },
        ],
        initial: "Non-Executive Director",
      },
      { id: "effectiveDate", label: "Appointed with effect from", type: "date", initial: today },
      {
        id: "term",
        label: "Term",
        type: "text",
        placeholder: "e.g. five consecutive years / until the next AGM",
        initial: "until the conclusion of the next Annual General Meeting",
      },
      {
        id: "sittingFee",
        label: "Sitting fee per meeting (₹)",
        type: "number",
        hint: "Up to ₹1,00,000 per meeting (Rule 4, Appointment and Remuneration Rules).",
      },
      { id: "issueDate", label: "Date of the letter", type: "date", initial: today },
      ...SIGNING,
    ],
    render: (v, ctx) => [
      letterhead(ctx),
      { kind: "para", text: `Date: ${longDate(str(v, "issueDate"))}` },
      { kind: "gap" },
      { kind: "para", text: "To," },
      { kind: "para", text: blank(str(v, "name")) },
      { kind: "para", text: blank(str(v, "address")) },
      { kind: "gap" },
      { kind: "para", bold: true, text: `Subject: Appointment as ${str(v, "category", "Director")}` },
      { kind: "para", text: `Dear ${blank(str(v, "name"))},` },
      {
        kind: "para",
        align: "justify",
        text: `We are pleased to confirm your appointment as ${str(v, "category", "Director")} of ${blank(ctx.companyName)} with effect from ${longDate(str(v, "effectiveDate"))}, ${str(v, "term", "for the term approved by the Board and the members")}. This letter sets out the principal terms of the appointment.`,
      },
      {
        kind: "list",
        ordered: true,
        items: [
          "Your appointment is subject to the provisions of the Companies Act, 2013, the rules made thereunder and the Articles of Association of the Company, and to your continuing eligibility to act as a director.",
          `You will be entitled to a sitting fee of ₹${blank(str(v, "sittingFee"))} for each meeting of the Board or its committees attended, together with reimbursement of expenses reasonably incurred for attending meetings.`,
          "You will exercise your duties under Section 166 with due and reasonable care, skill and diligence, and in good faith in the interests of the Company, its employees, shareholders and the community.",
          "You are required to disclose your interests in Form MBP-1 at the first Board meeting of each financial year and whenever there is a change, and to give a declaration in Form DIR-8 each year.",
          ...(str(v, "category") === "Independent Director"
            ? [
                "You are required to give a declaration of independence under Section 149(7) at the first Board meeting in which you participate, every year, and whenever there is a change in circumstances.",
                "You will abide by the Code for Independent Directors in Schedule IV to the Act, and your name must be included in the Independent Directors' Databank.",
              ]
            : []),
          "You will keep confidential all information about the Company that comes to you as a director, during and after your term, except as required by law.",
        ],
      },
      { kind: "para", text: "Kindly sign and return a copy of this letter as your acceptance of these terms." },
      ...certifiedCopy(ctx, v, "issueDate"),
      { kind: "gap" },
      { kind: "para", bold: true, text: "Accepted" },
      { kind: "signature", align: "left", lines: [`(${blank(str(v, "name"))})`, "Date: __________"] },
    ],
  },
  {
    id: "director-resignation-letter",
    title: "Resignation Letter by a Director",
    category: "Appointments & Resignations",
    reference: "Section 168(1), Companies Act, 2013",
    description: "A director's written notice of resignation to the company.",
    keywords: ["resignation", "resign", "director resignation", "168", "quit"],
    followUp: "The company files DIR-12 within 30 days; the director may file DIR-11.",
    fields: [
      { id: "name", label: "Director's name", type: "director", required: true, initial: "" },
      { id: "din", label: "DIN", type: "text" },
      {
        id: "effectiveDate",
        label: "Resignation effective from",
        type: "date",
        initial: today,
        hint: "Effective from the date the company receives the notice, or a later date stated in it.",
      },
      {
        id: "reason",
        label: "Reason (optional)",
        type: "textarea",
        wide: true,
        placeholder: "e.g. pre-occupation with other commitments",
      },
      { id: "issueDate", label: "Date of the letter", type: "date", initial: today },
      place,
    ],
    render: (v, ctx) => [
      { kind: "para", text: `Date: ${longDate(str(v, "issueDate"))}` },
      { kind: "gap" },
      { kind: "para", text: "To," },
      { kind: "para", text: `The Board of Directors, ${blank(ctx.companyName)}` },
      { kind: "para", text: blank(ctx.registeredOffice) },
      { kind: "gap" },
      { kind: "para", bold: true, text: "Subject: Resignation from the office of Director" },
      { kind: "para", text: "Dear Members of the Board," },
      {
        kind: "para",
        align: "justify",
        text: `I, ${blank(str(v, "name"))} (DIN: ${blank(str(v, "din"))}), hereby tender my resignation from the office of Director of ${blank(ctx.companyName)} with effect from ${longDate(str(v, "effectiveDate"))}${str(v, "reason") ? `, owing to ${str(v, "reason")}` : ""}.`,
      },
      {
        kind: "para",
        align: "justify",
        text: "I request the Board to take note of my resignation, to file the necessary form with the Registrar of Companies, and to place it on record. I confirm that I have no claim against the Company in respect of my office.",
      },
      { kind: "para", text: "Thank you for the opportunity to serve on the Board." },
      { kind: "gap" },
      {
        kind: "signature",
        align: "left",
        lines: [
          "Yours faithfully,",
          "",
          `(${blank(str(v, "name"))})`,
          `DIN: ${blank(str(v, "din"))}`,
          `Place: ${blank(str(v, "place"))}`,
        ],
      },
    ],
  },
  {
    id: "resolution-accept-resignation",
    title: "Board Resolution: Taking Note of a Director's Resignation",
    category: "Appointments & Resignations",
    reference: "Section 168, Companies Act, 2013",
    description: "Records the resignation and authorises the DIR-12 filing.",
    keywords: ["resignation", "cessation", "dir-12", "168", "director left"],
    followUp: "File DIR-12 within 30 days of receiving the resignation.",
    fields: [
      meetingDate,
      venue,
      { id: "director", label: "Resigning director", type: "director", required: true, initial: "" },
      { id: "din", label: "DIN", type: "text" },
      { id: "letterDate", label: "Date of the resignation letter", type: "date" },
      { id: "effectiveDate", label: "Effective from", type: "date" },
      ...SIGNING,
    ],
    render: (v, ctx) => {
      const who = blank(str(v, "director"));
      return [
        ...resolutionHeader(ctx, v),
        { kind: "heading", text: `Resignation of ${who} from the office of Director` },
        {
          kind: "resolution",
          text: `RESOLVED THAT the Board hereby takes note of the resignation of ${who} (DIN: ${blank(str(v, "din"))}) from the office of Director of the Company, tendered by letter dated ${longDate(str(v, "letterDate"))}, with effect from ${longDate(str(v, "effectiveDate"))}, and places on record its appreciation of the services rendered by him/her during his/her tenure.`,
        },
        {
          kind: "resolution",
          text: "RESOLVED FURTHER THAT any Director or the Company Secretary be and is hereby authorised to file Form DIR-12 with the Registrar of Companies within thirty days, to make the necessary entries in the Register of Directors and Key Managerial Personnel, and to do all acts necessary to give effect to this resolution.",
        },
        ...certifiedCopy(ctx, v),
      ];
    },
  },
  {
    id: "resolution-casual-vacancy-auditor",
    title: "Board Resolution: Auditor for a Casual Vacancy",
    category: "Appointments & Resignations",
    reference: "Section 139(8), Companies Act, 2013",
    description: "Fills a casual vacancy in the office of statutory auditor until the next AGM.",
    keywords: ["auditor", "casual vacancy", "statutory auditor", "adt-1", "139"],
    followUp:
      "File ADT-1 within 15 days. A vacancy caused by resignation must be approved by the members within 3 months.",
    fields: [
      meetingDate,
      venue,
      { id: "firm", label: "Audit firm / auditor", type: "text", required: true, wide: true },
      { id: "frn", label: "Firm registration number", type: "text" },
      { id: "outgoing", label: "Outgoing auditor", type: "text", wide: true },
      {
        id: "cause",
        label: "Cause of the vacancy",
        type: "select",
        options: [
          { value: "resignation", label: "Resignation of the auditor" },
          { value: "other", label: "Other cause" },
        ],
        initial: "resignation",
      },
      ...SIGNING,
    ],
    render: (v, ctx) => [
      ...resolutionHeader(ctx, v),
      { kind: "heading", text: "Appointment of statutory auditor to fill a casual vacancy" },
      {
        kind: "resolution",
        text: `RESOLVED THAT pursuant to Section 139(8) and other applicable provisions of the Companies Act, 2013 and the rules made thereunder, ${blank(str(v, "firm"))}, Chartered Accountants (Firm Registration No. ${blank(str(v, "frn"))}), who have given their consent and a certificate of eligibility under Section 141, be and are hereby appointed as the Statutory Auditors of the Company to fill the casual vacancy caused by the ${str(v, "cause") === "resignation" ? "resignation" : "vacation of office"} of ${blank(str(v, "outgoing"))}, to hold office until the conclusion of the next Annual General Meeting, at such remuneration as may be agreed with the Board.`,
      },
      ...(str(v, "cause") === "resignation"
        ? [
            {
              kind: "resolution",
              text: "RESOLVED FURTHER THAT, the vacancy having been caused by the resignation of the auditor, this appointment be placed before the members for approval at a general meeting to be held within three months of this recommendation.",
            },
          ]
        : []),
      {
        kind: "resolution",
        text: "RESOLVED FURTHER THAT any Director or the Company Secretary be and is hereby authorised to file Form ADT-1 with the Registrar of Companies within fifteen days and to do all acts necessary to give effect to this resolution.",
      },
      ...certifiedCopy(ctx, v),
    ],
  },
];

export const templatesById = new Map(DOC_TEMPLATES.map((t) => [t.id, t]));

/** The values a template starts with, for the selected company. */
export function initialValues(t, ctx) {
  const out = {};
  for (const f of t.fields) {
    const init = typeof f.initial === "function" ? f.initial(ctx) : f.initial;
    out[f.id] = init ?? (f.type === "list" ? [] : "");
  }
  return out;
}

/** Every template: the drafted ones and the Word-format AOC-4 attachments. */
export const ALL_TEMPLATES = [...DOC_TEMPLATES, ...AOC4_TEMPLATES];
export const anyTemplateById = new Map(ALL_TEMPLATES.map((t) => [t.id, t]));

/** Plain-language "Find": ranks templates by how many words match the title, keywords, category or reference. */
export function findTemplates(query) {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 1);
  if (words.length === 0) return ALL_TEMPLATES;
  const scored = ALL_TEMPLATES.map((t) => {
    const hay = [t.title, t.category, t.reference, t.description, ...t.keywords].join(" ").toLowerCase();
    const hits = words.filter((w) => hay.includes(w)).length;
    return { t, hits };
  });
  const best = Math.max(...scored.map((s) => s.hits));
  return best === 0 ? [] : scored.filter((s) => s.hits === best).map((s) => s.t);
}
