import assert from "node:assert/strict";
import test from "node:test";

import { bulkDueChanges, bulkDueTargets, usualDue } from "@/lib/portfolio/bulk-due";
import { buildDuesRows } from "@/lib/portfolio/dues-table";
import { buildFilingMatrix } from "@/lib/portfolio/filing-matrix";
import { isoDate } from "@/lib/dates";
import { SEED_CLIENTS, SEED_DIRECTORS } from "@/lib/portfolio/sample-portfolio.fixture";

const asOf = new Date(2026, 9, 27);
const rows = buildDuesRows(SEED_CLIENTS, SEED_DIRECTORS, asOf, { filingsOnly: true, fyEndingYear: 2026 });
const matrix = buildFilingMatrix(rows, SEED_CLIENTS);
const allKeys = matrix.columns.map((c) => c.key);

test("all forms: every company with anything open is offered, with every open form", () => {
  const { open } = bulkDueTargets(matrix, allKeys);
  const expected = new Set(rows.filter((r) => r.status !== "completed").map((r) => r.clientId));
  assert.deepEqual(new Set(open.map((t) => t.clientId)), expected);
  const openCells = matrix.rows.flatMap((r) =>
    Object.values(r.cells).filter((c) => !c.notRequired && c.rows.some((x) => x.status !== "completed")),
  ).length;
  assert.equal(open.reduce((n, t) => n + t.entries.length, 0), openCells);
});

test("one form: only that form's open cells", () => {
  const aoc = matrix.columns.find((c) => c.form === "AOC-4")!;
  const { open } = bulkDueTargets(matrix, [aoc.key]);
  assert.ok(open.length > 0);
  assert.ok(open.every((t) => t.entries.length === 1 && t.entries[0].columnKey === aoc.key));
});

test("changes cover every chosen form of every chosen company, and skip the rest", () => {
  const { open } = bulkDueTargets(matrix, allKeys);
  const one = new Set([open[0].clientId]);
  const changes = bulkDueChanges(open, one, "2027-03-31", "blanket");
  assert.ok(changes.length > 0);
  assert.ok(changes.every((c) => c.clientId === open[0].clientId));
  assert.equal(changes.length, open[0].entries.reduce((n, e) => n + e.rows.length, 0));
  assert.ok(changes.every((c) => c.input?.date === "2027-03-31" && c.input.note === "blanket"));
});

test("choosing a row's own usual date puts it back rather than overriding it", () => {
  const { open } = bulkDueTargets(matrix, allKeys);
  const row = open[0].entries[0].rows[0];
  const changes = bulkDueChanges(open, new Set([open[0].clientId]), isoDate(usualDue(row)));
  assert.equal(changes.find((c) => c.item === row.item)!.input, null);
  // Resetting sends null for every row.
  assert.ok(bulkDueChanges(open, new Set([open[0].clientId]), null).every((c) => c.input === null));
});
