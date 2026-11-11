import assert from "node:assert/strict";
import test from "node:test";

import { checkAck, referenceKind, validateFiling, withFiling } from "@/lib/portfolio/filings";
import { buildDuesRows } from "@/lib/portfolio/dues-table";
import { buildFilingMatrix } from "@/lib/portfolio/filing-matrix";
import { SEED_CLIENTS, SEED_DIRECTORS } from "@/lib/portfolio/sample-portfolio.fixture";

test("an ITR is proved by an acknowledgement number; MCA forms by an SRN", () => {
  assert.equal(referenceKind("itr"), "ack");
  assert.equal(referenceKind("aoc-4"), "srn");
  assert.equal(referenceKind("dir-3-kyc:abc"), "srn");
});

test("an acknowledgement number is exactly 15 digits", () => {
  assert.equal(checkAck("123456789012345"), null);
  assert.equal(checkAck("12345 67890 12345"), null, "spaces are ignored");
  assert.match(checkAck("12345678901234"), /15 digits/);
  assert.match(checkAck("AB1234567890123"), /digits only/);
  assert.equal(checkAck(""), null);
});

test("an ITR filing needs its acknowledgement number, checked as one", () => {
  const today = new Date(2026, 9, 31);
  const missing = validateFiling({ filedOn: "2026-10-20", srn: "" }, { srnRequired: true, kind: "ack", asOf: today });
  assert.match(missing.srn, /acknowledgement number/);
  const srnShaped = validateFiling(
    { filedOn: "2026-10-20", srn: "AB1234567" },
    { srnRequired: true, kind: "ack", asOf: today },
  );
  assert.ok(srnShaped.srn, "an SRN is not accepted for an ITR");
  assert.deepEqual(
    validateFiling({ filedOn: "2026-10-20", srn: "123456789012345" }, { srnRequired: true, kind: "ack", asOf: today }),
    {},
  );
  // MCA forms are unchanged.
  assert.deepEqual(validateFiling({ filedOn: "2026-10-20", srn: "AB1234567" }, { srnRequired: true, asOf: today }), {});
});

test("every dashboard row and cell can be marked filed from the sheet", () => {
  const asOf = new Date(2026, 9, 27);
  const rows = buildDuesRows(SEED_CLIENTS, SEED_DIRECTORS, asOf, { filingsOnly: true });
  assert.ok(
    rows.every((r) => r.item),
    "each row carries the due it stands for",
  );
  const matrix = buildFilingMatrix(rows, SEED_CLIENTS);
  for (const row of matrix.rows) {
    for (const cell of Object.values(row.cells)) {
      if (cell.notRequired) assert.equal(cell.rows.length, 0, "a not-required cell has nothing to file");
      else assert.equal(cell.rows.length, cell.parts, "each part of a cell is markable");
    }
  }
});

test("an acknowledgement number recorded on an ITR shows in the dues sheet", () => {
  const asOf = new Date(2026, 9, 27);
  const rows = buildDuesRows(SEED_CLIENTS, SEED_DIRECTORS, asOf, { filingsOnly: true });
  const itr = rows.find((r) => r.sourceId === "itr");
  assert.ok(itr, "the portfolio has an ITR due");
  const client = SEED_CLIENTS.find((c) => c.id === itr.clientId);
  const filed = withFiling(client, `itr|${itr.fyEndingYear}|`, { filedOn: "2026-10-20", srn: "1234 5678 9012 345" });
  const after = buildDuesRows([filed, ...SEED_CLIENTS.filter((c) => c.id !== client.id)], SEED_DIRECTORS, asOf, {
    filingsOnly: true,
  }).find((r) => r.id === itr.id);
  assert.equal(after.status, "completed");
  assert.equal(after.srn, "123456789012345");
});

test("column headers name the year only when the same form appears for two years", async () => {
  const { columnTitle } = await import("@/lib/portfolio/filing-matrix");
  const asOf = new Date(2026, 9, 27);
  const oneYear = buildFilingMatrix(
    buildDuesRows(SEED_CLIENTS, SEED_DIRECTORS, asOf, { filingsOnly: true, fyEndingYear: 2026 }),
    SEED_CLIENTS,
  );
  assert.ok(oneYear.columns.length > 0);
  assert.ok(
    oneYear.columns.every((c) => !c.showFy && !columnTitle(c).includes("FY")),
    "no FY beside the forms",
  );

  const rolling = buildFilingMatrix(
    buildDuesRows(SEED_CLIENTS, SEED_DIRECTORS, asOf, { filingsOnly: true }),
    SEED_CLIENTS,
  );
  for (const c of rolling.columns.filter((x) => x.showFy)) {
    assert.ok(
      rolling.columns.some((o) => o !== c && o.form === c.form && o.period === c.period && o.fy !== c.fy),
      `${c.form} only shows its year because another year of it is on the sheet`,
    );
  }
});

test("a filed cell says when it was filed, with its SRN or acknowledgement number", async () => {
  const { cellText, filedLines } = await import("@/lib/portfolio/filing-matrix");
  const { formatDate } = await import("@/lib/dates");
  const asOf = new Date(2026, 9, 27);
  const rows = buildDuesRows(SEED_CLIENTS, SEED_DIRECTORS, asOf, { filingsOnly: true, fyEndingYear: 2026 });
  const itr = rows.find((r) => r.sourceId === "itr");
  const client = SEED_CLIENTS.find((c) => c.id === itr.clientId);
  const clients = SEED_CLIENTS.map((c) =>
    c.id === client.id
      ? withFiling(c, `itr|${itr.fyEndingYear}|`, { filedOn: "2026-10-20", srn: "123456789012345" })
      : c,
  );
  const matrix = buildFilingMatrix(
    buildDuesRows(clients, SEED_DIRECTORS, asOf, { filingsOnly: true, fyEndingYear: 2026 }),
    clients,
  );
  const key = matrix.columns.find((c) => c.form.includes("ITR")).key;
  const cell = matrix.rows.find((r) => r.clientId === client.id).cells[key];
  assert.equal(cell.status, "completed");
  assert.match(cellText(cell, formatDate), /^Filed · (Due|Original) /);
  assert.deepEqual(filedLines(cell, formatDate), [
    `Filed on ${formatDate(new Date(2026, 9, 20))}`,
    "Ack. 123456789012345",
  ]);
});
