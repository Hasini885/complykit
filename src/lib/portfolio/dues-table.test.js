import assert from "node:assert/strict";
import test from "node:test";

import {
  ALL_DUES,
  asExcelDate,
  buildAnnualDuesRows,
  buildDuesRows,
  daysLabel,
  DUES_COLUMNS,
  filterDuesRows,
  postIncorporationRows,
} from "@/lib/portfolio/dues-table";
import { withAdt1Appointment } from "@/lib/portfolio/auditor";
import { buildFilingMatrix } from "@/lib/portfolio/filing-matrix";
import { createDuesPdf, createDuesXlsx, STATUS_COLOURS } from "@/lib/portfolio/dues-export";
import { buildPortfolioReport } from "@/lib/portfolio/report";
import { SEED_CLIENTS, SEED_DIRECTORS } from "@/lib/portfolio/sample-portfolio.fixture";
const asOf = new Date(2026, 9, 27);
const clients = SEED_CLIENTS.map((c) =>
  c.id === "cl-meridian" ? { ...c, filings: [{ key: "aoc-4|2026|", filedOn: "2026-10-24", srn: "AB1234567" }] } : c,
);
const rows = buildDuesRows(clients, SEED_DIRECTORS, asOf);

test("one row per dated due of every company, matching the firm-wide report", () => {
  const report = buildPortfolioReport(clients, SEED_DIRECTORS, { asOf });
  assert.equal(
    rows.length,
    report.sections.reduce((n, s) => n + s.items.length, 0),
  );
  assert.equal(new Set(rows.map((r) => r.clientId)).size, SEED_CLIENTS.length);
  assert.equal(new Set(rows.map((r) => r.id)).size, rows.length, "row ids are unique");
});

test("post incorporation part: an old company's unfiled forms stay, in one column each", () => {
  const today = new Date(2026, 10, 4);
  const base = { ...SEED_CLIENTS[0], type: "private", filings: [], dueOverrides: undefined };
  const old = { ...base, id: "old", name: "Old Co", incorporatedOn: "2024-05-01" };
  const recent = { ...base, id: "recent", name: "Recent Co", incorporatedOn: "2026-10-15" };
  const post = postIncorporationRows([old, recent], today);

  assert.deepEqual(
    post
      .filter((r) => r.clientId === "old")
      .map((r) => r.sourceId)
      .sort(),
    ["first-auditor", "inc-20a"],
    "shown though long outside the rolling window",
  );
  assert.ok(post.filter((r) => r.clientId === "old").every((r) => r.status === "overdue"));
  assert.ok(post.some((r) => r.clientId === "recent" && r.sourceId === "inc-20a" && r.status === "upcoming"));

  // Companies from different years still share one column per form.
  const matrix = buildFilingMatrix(post, [old, recent]);
  assert.deepEqual(matrix.columns.map((c) => c.form).sort(), ["ADT-1", "INC-20A"]);
  assert.equal(matrix.columns.find((c) => c.form === "ADT-1")?.obligation, "First auditor appointment");
  assert.equal(Object.keys(matrix.rows[0].cells).length, 2);
});

test("post incorporation part: not applicable, LLPs, and a recorded filing", () => {
  const today = new Date(2026, 10, 4);
  const base = {
    ...SEED_CLIENTS[0],
    type: "private",
    incorporatedOn: "2024-05-01",
    filings: [],
    dueOverrides: undefined,
  };
  const ids = (c) => postIncorporationRows([c], today).map((r) => r.sourceId);

  assert.deepEqual(ids({ ...base, filesFirstAdt1: false }), ["inc-20a"]);
  assert.deepEqual(ids({ ...base, type: "llp" }), []);

  const filed = { ...base, filings: [{ key: "inc-20a|once", filedOn: "2024-08-01", srn: "AB1234567" }] };
  const row = postIncorporationRows([filed], today).find((r) => r.sourceId === "inc-20a");
  assert.equal(row.status, "completed");
  assert.equal(row.srn, "AB1234567");
});

test("annual part: the post incorporation forms move out, and the first year has no ADT-1", () => {
  const fresh = {
    ...SEED_CLIENTS[0],
    id: "fresh",
    type: "private",
    incorporatedOn: "2026-10-15",
    filings: [],
    dueOverrides: undefined,
    auditorAppointedAtAgmFy: null,
  };
  const annual = buildAnnualDuesRows([fresh], [], new Date(2026, 10, 4), { fyEndingYear: 2027 }).map((r) => r.sourceId);
  assert.ok(!annual.includes("inc-20a") && !annual.includes("first-auditor"), annual.join(", "));
  assert.ok(!annual.includes("adt-1"), annual.join(", "));
});

test("annual part: the first AGM's ADT-1 sits under the next year, due until its details are entered, then filed", () => {
  const today = new Date(2026, 10, 4);
  const base = {
    ...SEED_CLIENTS[0],
    id: "young",
    type: "private",
    incorporatedOn: "2025-08-14",
    filings: [],
    dueOverrides: undefined,
    auditorAppointedAtAgmFy: null,
    auditorTermYears: null,
    lastAgmOn: null,
    agmHistory: [],
  };
  const adtOf = (c, fy) =>
    buildAnnualDuesRows([c], [], today, { fyEndingYear: fy }).filter((r) => r.sourceId === "adt-1");

  // The FY 2025-26 AGM can run to 31 Dec 2026, so ADT-1 is due 15 Jan 2027.
  const due = adtOf(base, 2027)[0];
  assert.equal(due.fy, "FY 2026–27");
  assert.equal(due.status, "upcoming");
  assert.equal(due.due.toDateString(), new Date(2027, 0, 15).toDateString());
  assert.equal(adtOf(base, 2026).length, 0, "nothing in the first year");

  const rolling = buildAnnualDuesRows([base], [], today);
  const matrix = buildFilingMatrix(rolling, [base], { adtTermFromFy: 2027 });
  const cell = matrix.rows[0].cells["adt-1|2027|"];
  assert.ok(cell && !cell.notRequired, "not NA");
  assert.ok(!matrix.columns.some((c) => c.key === "adt-1|2026|"));

  const filed = withAdt1Appointment(base, { srn: "AB1234567", filedOn: "2026-10-10" }, 5);
  const m2 = buildFilingMatrix(buildAnnualDuesRows([filed], [], today), [filed], { adtTermFromFy: 2027 });
  const done = m2.rows[0].cells["adt-1|2027|"];
  assert.equal(done.status, "completed");
  assert.equal(done.srn, "AB1234567");
  assert.deepEqual(
    m2.columns.filter((c) => c.key.startsWith("adt-1|")).map((c) => c.key),
    ["adt-1|2027|", "adt-1|2028|", "adt-1|2029|", "adt-1|2030|"],
  );
  assert.ok(m2.rows[0].cells["adt-1|2028|"].notRequired, "NA from the following year");

  // Still held there once its date has left the rolling window, not turned into NA.
  const later = new Date(2027, 8, 1);
  const m3 = buildFilingMatrix(buildAnnualDuesRows([filed], [], later), [filed], { adtTermFromFy: 2028 });
  assert.equal(m3.rows[0].cells["adt-1|2027|"]?.status, "completed");
});

test("rows are in due-date order", () => {
  const times = rows.map((r) => r.due.getTime());
  assert.deepEqual(
    times,
    [...times].sort((a, b) => a - b),
  );
});

test("a filed due carries its date and SRN", () => {
  const aoc = rows.find((r) => r.clientId === "cl-meridian" && r.form === "AOC-4" && r.fy === "FY 2025–26");
  assert.equal(aoc.status, "completed");
  assert.equal(aoc.srn, "AB1234567");
  assert.equal(aoc.filedOn?.getDate(), 24);
  assert.equal(daysLabel(aoc), "");
});

test("filters: company, status, 'not filed', and search across form, CIN and SRN", () => {
  const satara = filterDuesRows(rows, { ...ALL_DUES, clientId: "cl-satara" });
  assert.ok(satara.length > 0 && satara.every((r) => r.clientId === "cl-satara"));

  const overdue = filterDuesRows(rows, { ...ALL_DUES, status: "overdue" });
  assert.ok(overdue.every((r) => r.status === "overdue"));

  const open = filterDuesRows(rows, { ...ALL_DUES, status: "open" });
  assert.equal(open.length, rows.length - rows.filter((r) => r.status === "completed").length);

  assert.equal(filterDuesRows(rows, { ...ALL_DUES, query: "ab1234567" }).length, 1, "search by SRN");
  assert.ok(filterDuesRows(rows, { ...ALL_DUES, query: "mgt-7" }).every((r) => r.form.includes("MGT-7")));
  assert.ok(filterDuesRows(rows, { ...ALL_DUES, query: "L17110MH" }).every((r) => r.clientId === "cl-satara"));
});

test("Excel dates keep the calendar day whatever the time zone", () => {
  const d = asExcelDate(new Date(2026, 8, 27));
  assert.equal(d.toISOString().slice(0, 10), "2026-09-27");
});

test("every column renders text for every row without throwing", () => {
  for (const r of rows) for (const c of DUES_COLUMNS) assert.equal(typeof c.text(r), "string");
});

test("the Excel and PDF files are real files of the right kind", async () => {
  const meta = { asOf, scope: "All companies · All statuses" };
  const xlsx = new Uint8Array(await (await createDuesXlsx(rows, meta)).arrayBuffer());
  assert.equal(String.fromCharCode(xlsx[0], xlsx[1]), "PK", "an .xlsx is a zip archive");

  const pdf = new Uint8Array(await (await createDuesPdf(rows, meta)).arrayBuffer());
  assert.equal(String.fromCharCode(...pdf.slice(0, 5)), "%PDF-");
});

test("each due is coloured by status: red overdue, orange due soon, green filed", () => {
  assert.equal(STATUS_COLOURS.overdue.name, "Red");
  assert.equal(STATUS_COLOURS["due-soon"].name, "Orange");
  assert.equal(STATUS_COLOURS.completed.name, "Green");
  const fills = Object.values(STATUS_COLOURS).flatMap((c) => [c.row, c.cell]);
  assert.equal(new Set(fills).size, fills.length, "every status has its own colours");
});

test("the Excel file carries the status colours in its styles", async () => {
  const blob = await createDuesXlsx(rows, { asOf, scope: "All" });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const { unzipSync, strFromU8 } = await import("fflate");
  const styles = strFromU8(unzipSync(bytes)["xl/styles.xml"]).toUpperCase();
  for (const c of Object.values(STATUS_COLOURS)) {
    assert.ok(styles.includes(c.row.slice(1)), `row colour ${c.name}`);
    assert.ok(styles.includes(c.cell.slice(1)), `status colour ${c.name}`);
  }
});

test("the all-dues sheet lists forms to file, not dates only to watch", () => {
  const sheet = buildDuesRows(clients, SEED_DIRECTORS, asOf, { filingsOnly: true });
  assert.ok(sheet.length > 0);
  assert.ok(
    sheet.every((r) => r.form !== ""),
    "every row has an e-form",
  );
  assert.ok(!sheet.some((r) => /annual general meeting/i.test(r.obligation)), "no AGM row");
  assert.ok(
    !rows.some((r) => /annual general meeting/i.test(r.obligation)),
    "the AGM's last date is not listed anywhere",
  );
  assert.equal(sheet.length, rows.filter((r) => r.form !== "").length);
});
