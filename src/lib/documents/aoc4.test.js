import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { strFromU8, unzipSync } from "fflate";

import { AOC4_TEMPLATES, aoc4Data, dateStyles, reportNumber, rupees } from "@/lib/documents/aoc4";
import { BLANK, fillDocx, tokensIn } from "@/lib/documents/docx-fill";
import { initialValues } from "@/lib/documents/templates";
const read = (url) => new Uint8Array(readFileSync(path.join(process.cwd(), "public", url)));

/** All the visible text of a filled document, headers and footers included. */
function textOf(docx) {
  const files = unzipSync(docx);
  return Object.entries(files)
    .filter(([n]) => /^word\/(document|header\d*|footer\d*)\.xml$/.test(n))
    .map(([, b]) =>
      [...strFromU8(b).matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)]
        .map((m) => m[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"))
        .join(""),
    )
    .join("\n");
}

const ctx = {
  companyName: "Meridian Analytics Private Limited",
  cin: "U62099KA2019PTC128740",
  registeredOffice: "No. 4, Residency Road, Bengaluru 560025",
  entityLabel: "Private Limited Company",
  directors: [
    { name: "Ananya Raghavan", din: "07712345" },
    { name: "Farhan Qureshi", din: "08123456" },
  ],
  today: new Date(2026, 9, 28),
  incorporatedOn: "2019-06-14",
};

const pack = AOC4_TEMPLATES.find((t) => t.id === "aoc4-pack");
const full = {
  ...initialValues(pack, ctx),
  email: "accounts@meridian.in",
  boardDate: "2026-09-01",
  noticeDate: "2026-09-01",
  agmDate: "2026-09-30",
  minutesDate: "2026-09-30",
  place: "Bengaluru",
  business: "providing data analytics services",
  d1Address: "Indiranagar, Bengaluru",
  d2Address: "Jayanagar, Bengaluru",
  meetings: ["21/05/2025, 2, 2", "14/08/2025, 2, 1", "31/12/2025, 2, 2"],
  members: ["Ananya Raghavan, 6000", "Farhan Qureshi, 4000"],
  firmName: "Rao & Associates",
  firmFrn: "012345S",
  firmPartner: "Lakshmi Rao",
  firmMembershipNo: "234567",
  firmAddress: "12, MG Road, Bengaluru 560001",
  udin: "26234567ABCDEF1234",
  reportDate: "2026-09-01",
  auditFee: "15000",
  "fin.revenueCy": "1900000",
  "fin.revenuePy": "1565858",
  "fin.expensesCy": "124544",
  "fin.expensesPy": "453543",
  "fin.taxCy": "100000",
};

test("the pack holds the nine attachments and each is also on its own", () => {
  assert.equal(pack.files.length, 9);
  assert.equal(AOC4_TEMPLATES.length, 10);
  for (const f of pack.files)
    assert.ok(
      AOC4_TEMPLATES.some((t) => t.id !== "aoc4-pack" && t.files[0].url === f.url),
      f.url,
    );
});

test("the shipped Word templates carry no client's data and no images", () => {
  const leaks =
    /truvoltz|kypy|harish|earu|11243937|sai surya|031029|292135|DLAFAH|balataara|prashanth|kotagiri|gopi ?nath|maram|anjaiah|@gmail|FAADFA|AFADAA/i;
  for (const f of pack.files) {
    const files = unzipSync(read(f.url));
    assert.ok(!Object.keys(files).some((n) => n.startsWith("word/media/")), `${f.url} has images`);
    for (const [name, bytes] of Object.entries(files)) {
      assert.doesNotMatch(strFromU8(bytes), leaks, `${f.url} ${name}`);
    }
  }
});

test("every token in every template is answered", () => {
  const data = aoc4Data(full, ctx);
  const known = new Set([
    ...Object.keys(data.values),
    ...Object.keys(data.repeats ?? {}).flatMap((g) =>
      ["no", "date", "strength", "present", "attendance", "name", "shares"].map((k) => `${g}.${k}`),
    ),
  ]);
  for (const f of pack.files) {
    for (const token of tokensIn(read(f.url))) assert.ok(known.has(token), `${f.url}: {{${token}}} has no value`);
  }
});

test("a filled pack has every detail in place and nothing left unfilled", () => {
  const data = aoc4Data(full, ctx);
  for (const f of pack.files) {
    const out = fillDocx(read(f.url), data);
    const text = textOf(out);
    assert.ok(!text.includes("{{"), `${f.url} has an unfilled token`);
    assert.ok(
      /MERIDIAN ANALYTICS PRIVATE LIMITED|Meridian Analytics Private Limited/.test(text) ||
        f.url.includes("auditors-report"),
      f.url,
    );
  }
  const report = textOf(fillDocx(read("/doc-templates/aoc4/boards-report.docx"), data));
  assert.match(report, /3 meeting\(s\)/);
  assert.match(report, /14\/08\/202521\s*50%/, "date, strength 2, present 1, 50%");
  assert.match(report, /19,00,000/);
  assert.match(report, /17,75,456/, "PBT is worked out");
  assert.match(report, /16,75,456/, "PAT is PBT less tax");
  assert.match(report, /RAO & ASSOCIATES/);
  assert.match(report, /31 March 2026/);

  const audit = textOf(fillDocx(read("/doc-templates/aoc4/auditors-report.docx"), data));
  assert.match(audit, /M\/s\. MERIDIAN ANALYTICS PRIVATE LIMITED/);
  assert.match(audit, /March 31, 2026/);
  assert.match(audit, /For Rao & Associates/);
  assert.match(audit, /UDIN: 26234567ABCDEF1234/);
  assert.match(audit, /Date: 01\/09\/2026/);

  const minutes = textOf(fillDocx(read("/doc-templates/aoc4/agm-minutes.docx"), data));
  assert.match(minutes, /Ananya Raghavan 6000 Shares/);
  assert.match(minutes, /Farhan Qureshi 4000 Shares/);
  assert.match(minutes, /30th September, 2026 AT 12:00 PM AT REGISTERED OFFICE/);

  const auditor = textOf(fillDocx(read("/doc-templates/aoc4/agm-resolution-auditor.docx"), data));
  assert.match(auditor, /\(2026\) until the conclusion of the Annual General Meeting to be held in the year 2031/);

  const resolution = textOf(fillDocx(read("/doc-templates/aoc4/board-resolution-fs.docx"), data));
  assert.match(resolution, /financial year 2025-26 ended 31st March, 2026/);
  assert.match(resolution, /signed by Ananya Raghavan and Farhan Qureshi/);
  assert.match(resolution, /DIN: 07712345/);
});

test("blank answers print as fill-in lines and an empty table keeps one row", () => {
  const blank = { ...ctx, companyName: "", cin: "", directors: [], incorporatedOn: undefined };
  const data = aoc4Data(initialValues(pack, blank), blank);
  const report = textOf(fillDocx(read("/doc-templates/aoc4/boards-report.docx"), data));
  assert.ok(!report.includes("{{"));
  assert.ok(report.includes(BLANK));
  assert.match(report, /Date of Meeting/);
});

test("date, money and report-number helpers", () => {
  const d = dateStyles("2026-03-31");
  assert.equal(d.ord, "31st March, 2026");
  assert.equal(d.us, "March 31, 2026");
  assert.equal(d.dots, "31.03.2026");
  assert.equal(dateStyles("2025-08-14").ordOf, "14th of August, 2025");
  assert.equal(dateStyles("2026-09-02").ord, "2nd September, 2026");
  assert.equal(dateStyles("2026-09-11").ord, "11th September, 2026");
  assert.equal(rupees(1775456), "17,75,456");
  assert.equal(rupees(-12000), "(12,000)");
  assert.equal(reportNumber("2025-08-14", "2026-03-31"), "1st");
  assert.equal(reportNumber("2019-06-14", "2026-03-31"), "7th");
  assert.equal(reportNumber("2025-02-10", "2026-03-31"), "2nd");
  assert.equal(aoc4Data(full, ctx).values.fy, "2025-26");
});

test("the Word letterheads carry the company's mobile beside the email, pre-filled", async () => {
  const contact = { ...ctx, mobile: "98765 43210", email: "accounts@meridian.in" };
  const values = initialValues(pack, contact);
  assert.equal(values.mobile, "98765 43210");
  assert.equal(values.email, "accounts@meridian.in");
  const head = AOC4_TEMPLATES.find((t) => t.id !== "aoc4-pack" && t.title.toLowerCase().includes("letterhead"));
  const filled = fillDocx(read(head.files[0].url), aoc4Data({ ...initialValues(head, contact) }, contact));
  assert.match(textOf(filled), /Email id: accounts@meridian\.in {2}\| {2}Mobile: 98765 43210/);
});
