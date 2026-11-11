import assert from "node:assert/strict";
import test from "node:test";

import { formatDate } from "@/lib/dates";
import { buildDuesRows } from "@/lib/portfolio/dues-table";
import { buildFilingMatrix, cellText, dueLines } from "@/lib/portfolio/filing-matrix";
import { withDueOverride } from "@/lib/portfolio/due-overrides";
import { SEED_CLIENTS, SEED_DIRECTORS } from "@/lib/portfolio/sample-portfolio.fixture";
import { resolveClientYear } from "@/lib/portfolio/schedule";
const asOf = new Date(2026, 9, 27);

function matrixFor(clients = SEED_CLIENTS) {
  const rows = buildDuesRows(clients, SEED_DIRECTORS, asOf, { filingsOnly: true, fyEndingYear: 2026 });
  return { rows, matrix: buildFilingMatrix(rows, clients) };
}

test("the extended date names its circular; a date the Act already puts later names none", () => {
  const asOf = new Date(2026, 10, 4);
  const c = {
    id: "circ",
    name: "Circular Co",
    cin: "U00000KA2019PTC000000",
    type: "private",
    incorporatedOn: "2019-07-18",
    registeredOffice: "x",
    status: "active",
    createdAt: "",
    updatedAt: "",
  };
  const cells = buildFilingMatrix(buildDuesRows([c], [], asOf, { filingsOnly: true, fyEndingYear: 2026 }), [c]).rows[0]
    .cells;
  const fmt = (d) => d.toDateString();
  assert.deepEqual(dueLines(cells["aoc-4|2026|"], fmt), [
    `Original due date ${new Date(2026, 9, 30).toDateString()}`,
    `Extended due date ${new Date(2026, 11, 31).toDateString()}`,
    "As per MCA General Circular No. 05/2026 (24 October 2026), without additional fee",
  ]);
  assert.match(dueLines(cells["itr|2026|"], fmt)[2], /^As per CBDT Circular No\. 07\/2026/);

  const dpt = buildFilingMatrix(
    buildDuesRows([{ ...c, filesDpt3: true }], [], asOf, { filingsOnly: true, fyEndingYear: 2026 }),
    [{ ...c, filesDpt3: true }],
  ).rows[0].cells["dpt-3|2026|"];
  assert.equal(dpt.due.toDateString(), new Date(2026, 6, 31).toDateString());
  assert.equal(dpt.originalDue?.toDateString(), new Date(2026, 5, 30).toDateString());
  assert.match(dpt.circular ?? "", /General Circular No\. 02\/2026/);

  // A first AGM runs later than the circular's date, and a transfer-pricing return is due 30 Nov.
  const young = { ...c, incorporatedOn: "2025-08-14" };
  const first = resolveClientYear(young, [], 2026, { asOf }).find((i) => i.source.id === "aoc-4");
  assert.equal(first.due?.toDateString(), new Date(2027, 0, 30).toDateString());
  assert.equal(first.extendedBy, null);
  assert.equal(first.relief, null);
  const tp = resolveClientYear({ ...c, transferPricing: true }, [], 2026, { asOf }).find((i) => i.source.id === "itr");
  assert.equal(tp.due?.toDateString(), new Date(2026, 10, 30).toDateString());
  assert.equal(tp.relief, null, "the 21 Nov extension does not concern it");

  // Set by hand: the user's date, with no circular claimed for it.
  const byHand = withDueOverride(c, "aoc-4|2026|", { date: "2027-02-01" });
  const manual = buildFilingMatrix(buildDuesRows([byHand], [], asOf, { filingsOnly: true, fyEndingYear: 2026 }), [
    byHand,
  ]).rows[0].cells["aoc-4|2026|"];
  assert.equal(manual.manualDue, true);
  assert.equal(manual.circular, null);
});

test("a due moved by an MCA circular shows its original and extended dates", () => {
  const { matrix } = matrixFor();
  const aocKey = matrix.columns.find((c) => c.form === "AOC-4").key;
  const cell = matrix.rows.map((r) => r.cells[aocKey]).find((c) => c && !c.notRequired && c.status !== "completed");
  assert.ok(cell.originalDue, "AOC-4 for FY 2025-26 was extended by GC 05/2026");
  assert.equal(cell.manualDue, false);
  const lines = dueLines(cell, formatDate);
  assert.match(lines[0], /^Original due date /);
  assert.match(lines[1], /^Extended due date /);
  assert.match(cellText(cell, formatDate), /\(original due date .*, extended due date .*\)$/);
});

test("a due on its original date shows one line", () => {
  const { matrix } = matrixFor();
  const plain = matrix.rows
    .flatMap((r) => Object.values(r.cells))
    .find((c) => !c.notRequired && c.status !== "completed" && !c.originalDue);
  assert.deepEqual(dueLines(plain, formatDate), [`Due date ${formatDate(plain.due)}`]);
});

test("a date set by hand on several companies at once shows as extended, manually", () => {
  const { rows } = matrixFor();
  const itrRows = rows.filter((r) => r.sourceId === "itr");
  assert.ok(itrRows.length > 1, "more than one company files an ITR");
  // What "Select all" does: the same date on every company's ITR.
  const clients = SEED_CLIENTS.map((c) => {
    const r = itrRows.find((x) => x.clientId === c.id);
    return r ? withDueOverride(c, `itr|${r.fyEndingYear}|`, { date: "2026-11-21" }) : c;
  });
  const { matrix } = matrixFor(clients);
  const key = matrix.columns.find((c) => c.form.includes("ITR")).key;
  for (const row of matrix.rows) {
    const cell = row.cells[key];
    if (!cell || cell.notRequired || cell.status === "completed") continue;
    assert.equal(formatDate(cell.due), formatDate(new Date(2026, 10, 21)));
    assert.ok(cell.originalDue, `${row.company} keeps its original date`);
    assert.equal(cell.manualDue, true);
  }
});
