import assert from "node:assert/strict";
import test from "node:test";

import {
  ALL_DUES,
  asExcelDate,
  buildDuesRows,
  daysLabel,
  DUES_COLUMNS,
  filterDuesRows,
} from "@/lib/portfolio/dues-table";
import { createDuesPdf, createDuesXlsx, STATUS_COLOURS } from "@/lib/portfolio/dues-export";
import { buildPortfolioReport } from "@/lib/portfolio/report";
import { SEED_CLIENTS, SEED_DIRECTORS } from "@/lib/portfolio/sample-portfolio.fixture";
import type { Client } from "@/lib/portfolio/types";

const asOf = new Date(2026, 9, 27);
const clients: Client[] = SEED_CLIENTS.map((c) =>
  c.id === "cl-meridian"
    ? { ...c, filings: [{ key: "aoc-4|2026|", filedOn: "2026-10-24", srn: "AB1234567" }] }
    : c,
);
const rows = buildDuesRows(clients, SEED_DIRECTORS, asOf);

test("one row per dated due of every company, matching the firm-wide report", () => {
  const report = buildPortfolioReport(clients, SEED_DIRECTORS, { asOf });
  assert.equal(rows.length, report.sections.reduce((n, s) => n + s.items.length, 0));
  assert.equal(new Set(rows.map((r) => r.clientId)).size, SEED_CLIENTS.length);
  assert.equal(new Set(rows.map((r) => r.id)).size, rows.length, "row ids are unique");
});

test("rows are in due-date order", () => {
  const times = rows.map((r) => r.due.getTime());
  assert.deepEqual(times, [...times].sort((a, b) => a - b));
});

test("a filed due carries its date and SRN", () => {
  const aoc = rows.find((r) => r.clientId === "cl-meridian" && r.form === "AOC-4" && r.fy === "FY 2025–26")!;
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
  assert.ok(sheet.every((r) => r.form !== ""), "every row has an e-form");
  assert.ok(!sheet.some((r) => /annual general meeting/i.test(r.obligation)), "no AGM row");
  assert.ok(!rows.some((r) => /annual general meeting/i.test(r.obligation)), "the AGM's last date is not listed anywhere");
  assert.equal(sheet.length, rows.filter((r) => r.form !== "").length);
});
