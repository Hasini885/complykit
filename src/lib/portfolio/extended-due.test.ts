import assert from "node:assert/strict";
import test from "node:test";

import { formatDate } from "@/lib/dates";
import { buildDuesRows } from "@/lib/portfolio/dues-table";
import { buildFilingMatrix, cellText, dueLines } from "@/lib/portfolio/filing-matrix";
import { withDueOverride } from "@/lib/portfolio/due-overrides";
import { SEED_CLIENTS, SEED_DIRECTORS } from "@/lib/portfolio/sample-portfolio.fixture";

const asOf = new Date(2026, 9, 27);

function matrixFor(clients = SEED_CLIENTS) {
  const rows = buildDuesRows(clients, SEED_DIRECTORS, asOf, { filingsOnly: true, fyEndingYear: 2026 });
  return { rows, matrix: buildFilingMatrix(rows, clients) };
}

test("a due moved by an MCA circular shows its original and extended dates", () => {
  const { matrix } = matrixFor();
  const aocKey = matrix.columns.find((c) => c.form === "AOC-4")!.key;
  const cell = matrix.rows.map((r) => r.cells[aocKey]).find((c) => c && !c.notRequired && c.status !== "completed")!;
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
    .find((c) => !c.notRequired && c.status !== "completed" && !c.originalDue)!;
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
  const key = matrix.columns.find((c) => c.form.includes("ITR"))!.key;
  for (const row of matrix.rows) {
    const cell = row.cells[key];
    if (!cell || cell.notRequired || cell.status === "completed") continue;
    assert.equal(formatDate(cell.due), formatDate(new Date(2026, 10, 21)));
    assert.ok(cell.originalDue, `${row.company} keeps its original date`);
    assert.equal(cell.manualDue, true);
  }
});
