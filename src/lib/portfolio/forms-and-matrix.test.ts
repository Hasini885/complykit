import assert from "node:assert/strict";
import test from "node:test";
import { auditorTerm, auditorTermSummary } from "@/lib/portfolio/auditor";
import { withAdt1Filing } from "@/lib/portfolio/clients";
import { formatDate } from "@/lib/dates";

import { parseIsoDate } from "@/lib/dates";
import { resolveClientYear } from "@/lib/portfolio/schedule";
import { buildDuesRows } from "@/lib/portfolio/dues-table";
import { buildFilingMatrix, cellText, columnKey } from "@/lib/portfolio/filing-matrix";
import { createDuesXlsx } from "@/lib/portfolio/dues-export";
import { SEED_CLIENTS, SEED_DIRECTORS } from "@/lib/portfolio/sample-portfolio.fixture";
import type { Client } from "@/lib/portfolio/types";

const d = (s: string) => parseIsoDate(s)!;
const iso = (x: Date | null | undefined) =>
  x ? `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}` : null;

function client(over: Partial<Client> = {}): Client {
  return {
    id: "c1",
    name: "Test Co",
    cin: "U00000KA2019PTC000000",
    type: "private",
    incorporatedOn: "2019-07-18",
    registeredOffice: "x",
    status: "active",
    createdAt: "",
    updatedAt: "",
    ...over,
  };
}
const find = (c: Client, fy: number, id: string) => resolveClientYear(c, [], fy).find((r) => r.source.id === id);

/* ---------------- DPT-3 is opt-in ---------------- */

test("DPT-3 appears only when the company is ticked as filing it", () => {
  assert.equal(find(client(), 2027, "dpt-3"), undefined);
  assert.equal(iso(find(client({ filesDpt3: true }), 2027, "dpt-3")?.due), "2027-06-30");
});

/* ---------------- INC-20A ---------------- */

test("INC-20A: 180 days from incorporation, for companies incorporated from 2 Nov 2018", () => {
  const fresh = client({ incorporatedOn: "2026-08-01" });
  const r = resolveClientYear(fresh, [], 2027, { asOf: d("2026-09-01") }).find((x) => x.source.id === "inc-20a");
  assert.equal(iso(r?.due), "2027-01-28");
  assert.equal(r?.source.formCode, "INC-20A");

  const old = client({ incorporatedOn: "2018-06-01" });
  assert.equal(
    resolveClientYear(old, [], 2019, { asOf: d("2018-07-01") }).find((x) => x.source.id === "inc-20a"),
    undefined,
    "not for a company incorporated before 2 Nov 2018",
  );
  const llp = client({ type: "llp", incorporatedOn: "2026-08-01" });
  assert.equal(resolveClientYear(llp, [], 2027, { asOf: d("2026-09-01") }).find((x) => x.source.id === "inc-20a"), undefined);
});

/* ---------------- ITR ---------------- */

test("ITR-6 for a company by 31 October; 30 November with transfer pricing", () => {
  const itr = find(client(), 2026, "itr")!;
  assert.equal(itr.source.formCode, "ITR-6");
  // Statutory date; for FY 2025-26 CBDT Circular 07/2026 extends it (see law-updates-2026.test.ts).
  assert.equal(iso(itr.statutoryDue ?? itr.due), "2026-10-31");
  const tp = find(client({ transferPricing: true }), 2026, "itr")!;
  assert.equal(iso(tp.due), "2026-11-30");
  assert.match(tp.overrideReason ?? "", /3CEB/);
});

test("ITR-5 for an LLP: 31 August unless audited (turnover over ₹1 crore), then 31 October", () => {
  const small = find(client({ type: "llp", cin: "AAB-1234", turnover: 50_00_000 }), 2026, "itr")!;
  assert.equal(small.source.formCode, "ITR-5");
  assert.equal(iso(small.due), "2026-08-31");
  const audited = find(client({ type: "llp", cin: "AAB-1234", turnover: 2_00_00_000 }), 2026, "itr")!;
  assert.equal(iso(audited.statutoryDue ?? audited.due), "2026-10-31", "statutory date, before the CBDT extension");
});

test("a Section 8 company's ITR is labelled ITR-7 / ITR-6", () => {
  assert.equal(find(client({ type: "section8", cin: "U00000KA2019NPL000000" }), 2026, "itr")!.source.formCode, "ITR-7 / ITR-6");
});

/* ---------------- MGT-7 vs MGT-7A ---------------- */

test("MGT-7A for an OPC or a small company (limits from 1 Dec 2025); MGT-7 otherwise", () => {
  const small = find(client({ paidUpCapital: 5_00_00_000, turnover: 60_00_00_000 }), 2027, "mgt-7")!;
  assert.equal(small.source.formCode, "MGT-7A", "₹5 cr / ₹60 cr is small under the ₹10 cr / ₹100 cr limits");
  const big = find(client({ paidUpCapital: 20_00_00_000, turnover: 60_00_00_000 }), 2027, "mgt-7")!;
  assert.equal(big.source.formCode, "MGT-7");
  const pub = find(client({ type: "public", cin: "U00000KA2019PLC000000" }), 2027, "mgt-7")!;
  assert.equal(pub.source.formCode, "MGT-7", "a public company is never small");
  assert.equal(find(client({ type: "opc", cin: "U00000KA2019OPC000000" }), 2027, "mgt-7")!.source.formCode, "MGT-7A");
});

test("the MGT-7 / 7A extension under GC 05/2026 still applies whichever form is used", () => {
  const small = find(client({ paidUpCapital: 1_00_000 }), 2026, "mgt-7")!;
  assert.equal(small.source.formCode, "MGT-7A");
  assert.equal(iso(small.due), "2027-01-31");
});

/* ---------------- The by-company matrix ---------------- */

const asOf = new Date(2026, 9, 27);
const clients: Client[] = SEED_CLIENTS.map((c) =>
  c.id === "cl-meridian"
    ? { ...c, filings: [{ key: "dpt-3|2027|", filedOn: "2026-10-20", srn: "AB1234567" }] }
    : c,
);
const rows = buildDuesRows(clients, SEED_DIRECTORS, asOf, { filingsOnly: true });
const matrix = buildFilingMatrix(rows, clients);

test("one row per company, one column per due to file, every row's dues accounted for", () => {
  assert.equal(matrix.rows.length, clients.length);
  const cellCount = matrix.rows.reduce((n, r) => n + Object.values(r.cells).filter((c) => !c.notRequired).length, 0);
  assert.equal(new Set(rows.map((r) => `${r.clientId}|${columnKey(r)}`)).size, cellCount);
  assert.ok(matrix.columns.every((c) => c.form !== ""), "only forms to file");
  assert.ok(!matrix.columns.some((c) => /general meeting/i.test(c.obligation)), "no AGM column");
});

test("a due that does not apply to a company has no cell (shown as —)", () => {
  const llp = matrix.rows.find((r) => r.clientId === "cl-northline")!;
  const aoc = matrix.columns.find((c) => c.form.startsWith("AOC-4"))!;
  assert.equal(llp.cells[aoc.key], undefined);
  assert.equal(cellText(undefined, iso as (d: Date) => string), "—");
});

test("MGT-7A has its own column; a company filing the other form shows which one it files", () => {
  const a = matrix.columns.find((c) => c.key === "mgt-7a|2026|");
  assert.ok(a, "MGT-7A column");
  assert.equal(a!.form, "MGT-7A");
  for (const row of matrix.rows) {
    const full = row.cells["mgt-7|2026|"];
    const small = row.cells["mgt-7a|2026|"];
    if (!full && !small) continue;
    // Exactly one of the two is a real due; the other, if shown, says why not.
    assert.equal([full, small].filter((c) => c && !c.notRequired).length, 1, row.company);
    if (small?.notRequired) assert.match(small.notRequired, /files MGT-7 \(not a small company/);
    if (full?.notRequired) assert.match(full.notRequired, /files MGT-7A/);
  }
});

test("MGT-7A shows even when no company in view files it", () => {
  const big = client({ id: "big", turnover: 5_000_000_000, paidUpCapital: 2_000_000_000 });
  const m = buildFilingMatrix(buildDuesRows([big], [], asOf, { filingsOnly: true }), [big]);
  const cell = m.rows[0].cells["mgt-7a|2026|"];
  assert.ok(cell?.notRequired);
  assert.match(cellText(cell, iso as (d: Date) => string), /^NA — files MGT-7 /);
  assert.ok(m.rows[0].cells["mgt-7|2026|"] && !m.rows[0].cells["mgt-7|2026|"].notRequired);
});

test("director KYC folds into one cell per company with filed / total", () => {
  const kyc = matrix.columns.find((c) => c.key.startsWith("dir-3-kyc|"))!;
  assert.ok(kyc);
  const cells = matrix.rows.map((r) => r.cells[kyc.key]).filter(Boolean);
  assert.ok(cells.some((c) => c!.parts > 1), "a company with two directors due shows one cell");
});

test("a filed due turns its cell to filed, with the SRN", () => {
  const meridian = matrix.rows.find((r) => r.clientId === "cl-meridian")!;
  const dpt = matrix.columns.find((c) => c.key === "dpt-3|2027|")!;
  assert.equal(meridian.cells[dpt.key].status, "completed");
  assert.equal(meridian.cells[dpt.key].srn, "AB1234567");
  assert.match(cellText(meridian.cells[dpt.key], iso as (d: Date) => string), /^Filed .* AB1234567/);
});

test("the Excel file's first sheet is the filing-status matrix", async () => {
  const blob = await createDuesXlsx(rows, { asOf, scope: "All" }, matrix);
  const { unzipSync, strFromU8 } = await import("fflate");
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  const workbook = strFromU8(files["xl/workbook.xml"]);
  const names = [...workbook.matchAll(/<sheet [^>]*name="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(names, ["Filing status", "All dues", "About"]);
});

test("a column header names each form once", () => {
  const itr = matrix.columns.find((c) => c.key.startsWith("itr|"))!;
  const parts = itr.form.split(" / ");
  assert.equal(new Set(parts).size, parts.length, itr.form);
  assert.ok(parts.includes("ITR-6") && parts.includes("ITR-5"));
});

/* ---------------- ADT-1 in the matrix ---------------- */

test("ADT-1 has a column beside every AOC-4 year, for every company that files AOC-4", () => {
  for (const aoc of matrix.columns.filter((c) => c.key.startsWith("aoc-4|"))) {
    const fy = aoc.key.split("|")[1];
    const adt = matrix.columns.find((c) => c.key === `adt-1|${fy}|`);
    assert.ok(adt, `ADT-1 column for FY ending ${fy}`);
    for (const row of matrix.rows) {
      if (row.cells[aoc.key]) assert.ok(row.cells[adt!.key], `${row.company}: ADT-1 status for ${fy}`);
    }
  }
});

test("a year inside the auditor's term says ADT-1 is not required and when it is next due", () => {
  const c = client({ id: "mid", incorporatedOn: "2019-07-18", auditorAppointedAtAgmFy: 2025 });
  const at = new Date(2026, 9, 27);
  const r = buildDuesRows([c], [], at, { filingsOnly: true });
  const m = buildFilingMatrix(r, [c]);
  const cell = m.rows[0].cells["adt-1|2026|"];
  assert.ok(cell?.notRequired, "not-required cell");
  assert.match(cellText(cell, iso as (d: Date) => string), /^NA — .*next due 15\/10\/2030/);
});

test("ADT-1 filed once for a 3-year term: SRN and date shown as NA in the years between", () => {
  const c = withAdt1Filing(
    client({
      id: "three",
      incorporatedOn: "2019-07-18",
      auditorType: "subsequent",
      auditorAppointedAtAgmFy: 2025,
      auditorTermYears: 3,
      adt1Srn: "AB1234567",
      adt1FiledOn: "2025-10-10",
    }),
  );
  const at = new Date(2026, 9, 27);
  const m = buildFilingMatrix(buildDuesRows([c], [], at, { filingsOnly: true }), [c]);
  const year2 = m.rows[0].cells["adt-1|2026|"];
  assert.equal(
    cellText(year2, formatDate),
    "NA — Auditor appointed for 3 years at the AGM for FY 2024–25 (SRN AB1234567 filed dated 10/10/2025), next due 15/10/2028",
  );
  // Its own place: after every other form, not ahead of them.
  const keys = m.columns.map((c) => c.key);
  const firstAdt = keys.findIndex((k) => k.startsWith("adt-1|"));
  assert.ok(keys.slice(firstAdt).every((k) => k.startsWith("adt-1|")), "ADT-1 columns come last");
  const term = auditorTerm(c, at)!;
  assert.equal(term.untilFy, 2028);
  assert.equal(term.untilAgmNumber, 9, "the AGM for FY 2027-28 is the company's 9th");
  assert.match(auditorTermSummary(c, at)!, /up to the conclusion of the 9th AGM \(for FY 2027–28\).*NA for the 2 years in between/);
});

test("a company's first year has no annual ADT-1 column or cell; the next year is NA", () => {
  const c = client({ id: "new", incorporatedOn: "2025-08-14", lastAgmOn: "2026-09-30", agmHistory: ["2026-09-30"] });
  const at = new Date(2026, 9, 28);
  const m = buildFilingMatrix(buildDuesRows([c], [], at, { filingsOnly: true, fyEndingYear: 2026 }), [c]);
  assert.ok(m.columns.some((col) => col.key === "aoc-4|2026|"));
  assert.ok(!m.columns.some((col) => col.key === "adt-1|2026|"), "not in the annual table");
  const next = buildFilingMatrix(buildDuesRows([c], [], at, { filingsOnly: true, fyEndingYear: 2027 }), [c]);
  assert.match(cellText(next.rows[0].cells["adt-1|2027|"], iso as (d: Date) => string), /^NA — Auditor taken as appointed for 5 years/);
});
