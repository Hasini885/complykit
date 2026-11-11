import assert from "node:assert/strict";
import test from "node:test";

import { isoDate } from "@/lib/dates";
import { filingKey } from "@/lib/portfolio/filings";
import { cleanDueOverrides, withDueOverride, withoutDueOverride } from "@/lib/portfolio/due-overrides";
import { normalise } from "@/lib/portfolio/repository";
import { resolveClientYear } from "@/lib/portfolio/schedule";
import { buildDuesRows } from "@/lib/portfolio/dues-table";
function client(over = {}) {
  return {
    id: "c1",
    name: "Test Co",
    cin: "U00000KA2019PTC000000",
    type: "private",
    incorporatedOn: "2019-07-18",
    registeredOffice: "x",
    status: "active",
    msmeDuesOver45Days: true,
    createdAt: "",
    updatedAt: "",
    ...over,
  };
}
const row = (c, fy, id, qualifier) =>
  resolveClientYear(c, [], fy).find(
    (r) => r.source.id === id && (qualifier === undefined || r.qualifier === qualifier),
  );

test("changing this year's date moves only this year's occurrence", () => {
  const base = client();
  const aoc27 = row(base, 2027, "aoc-4");
  const c = withDueOverride(base, filingKey(aoc27), { date: "2027-10-15", note: "Board meets on the 12th" });

  const changed = row(c, 2027, "aoc-4");
  assert.equal(isoDate(changed.due), "2027-10-15");
  assert.equal(isoDate(changed.originalDue), "2027-10-30", "the usual date is kept alongside");
  assert.equal(changed.customNote, "Board meets on the 12th");

  assert.equal(isoDate(row(c, 2028, "aoc-4").due), "2028-10-30", "next year is untouched");
  assert.equal(row(c, 2028, "aoc-4").originalDue ?? null, null);
  assert.equal(isoDate(row(c, 2027, "mgt-7").due), isoDate(row(base, 2027, "mgt-7").due), "other forms untouched");
});

test("a one-off date works over a circular-extended date too, and keeps it as the usual date", () => {
  const base = client();
  const aoc26 = row(base, 2026, "aoc-4"); // extended to 31 Dec 2026 by GC 05/2026
  const c = withDueOverride(base, filingKey(aoc26), { date: "2026-11-30" });
  assert.equal(isoDate(row(c, 2026, "aoc-4").due), "2026-11-30");
  assert.equal(isoDate(row(c, 2026, "aoc-4").originalDue), "2026-12-31");
});

test("each half of a half-yearly return can be moved on its own", () => {
  const base = client();
  const first = row(base, 2027, "msme-1", "April to September");
  const c = withDueOverride(base, filingKey(first), { date: "2026-10-25" });
  assert.equal(isoDate(row(c, 2027, "msme-1", "April to September").due), "2026-10-25");
  assert.equal(isoDate(row(c, 2027, "msme-1", "October to March").due), "2027-04-30");
});

test("back to the usual date removes the one-off", () => {
  const base = client();
  const key = filingKey(row(base, 2027, "aoc-4"));
  const c = withoutDueOverride(withDueOverride(base, key, { date: "2027-10-15" }), key);
  assert.equal(isoDate(row(c, 2027, "aoc-4").due), "2027-10-30");
  assert.deepEqual(c.dueOverrides, []);
});

test("the dues sheet and downloads say it is the user's own date", () => {
  const base = client();
  const c = withDueOverride(base, filingKey(row(base, 2027, "aoc-4")), { date: "2027-10-15" });
  const rows = buildDuesRows([c], [], new Date(2027, 9, 1), { filingsOnly: true });
  const aoc = rows.find((r) => r.sourceId === "aoc-4" && r.fy === "FY 2026–27");
  assert.match(aoc.basis, /^Own date \(usual 30 Oct 2027\)/);
});

test("malformed one-off dates in storage are dropped", () => {
  const stored = client({
    dueOverrides: [
      { key: "aoc-4|2027|", date: "2027-10-15" },
      { key: "mgt-7|2027|", date: "not a date" },
    ],
  });
  const [loaded] = normalise({ clients: [stored], directors: [] }).clients;
  assert.deepEqual(loaded.dueOverrides, [{ key: "aoc-4|2027|", date: "2027-10-15" }]);
  assert.deepEqual(cleanDueOverrides(null), []);
});
