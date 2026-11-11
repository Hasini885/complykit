import assert from "node:assert/strict";
import test from "node:test";

import { parseIsoDate } from "@/lib/dates";
import { computeClientHealth, currentWorkingFyEndingYear, healthTone, needsAction } from "@/lib/portfolio/health";
const d = (s) => parseIsoDate(s);

function client(over = {}) {
  return {
    id: "c1",
    name: "Test Co",
    cin: "U00000KA2020PTC000000",
    type: "private",
    incorporatedOn: "2019-07-18",
    registeredOffice: "x",
    status: "active",
    createdAt: "",
    updatedAt: "",
    ...over,
  };
}

test("currentWorkingFyEndingYear tracks the April-March year", () => {
  assert.equal(currentWorkingFyEndingYear(d("2026-09-03")), 2027, "Sep 2026 is inside FY 2026-27");
  assert.equal(currentWorkingFyEndingYear(d("2026-02-01")), 2026, "Feb 2026 is inside FY 2025-26");
});

test("health excludes cadence obligations from the fraction", () => {
  const h = computeClientHealth(client(), d("2026-09-03"));
  assert.ok(h.dated.every((r) => r.due !== null));
  assert.ok(!h.dated.some((r) => r.source.id === "board-meetings"));
});

test("a client with nothing overdue scores 100 and reads good", () => {
  // Just past the FY end, before anything else falls due.
  const h = computeClientHealth(client(), d("2027-04-01"));
  assert.equal(h.overdue.length, 0);
  assert.equal(h.onTrack, h.total);
  assert.equal(h.score, 100);
  assert.equal(healthTone(h), "good");
  assert.equal(needsAction(h), false);
});

test("overdue items drag the score down and flip the tone", () => {
  // Well after the FY 2025-26 filings should have happened.
  const h = computeClientHealth(client(), d("2026-12-01"));
  assert.ok(h.overdue.length > 0);
  assert.ok(h.score < 100);
  assert.equal(healthTone(h), "bad");
  assert.equal(needsAction(h), true);
});

test("next due prefers the earliest overdue item over an upcoming one", () => {
  const h = computeClientHealth(client(), d("2026-12-01"));
  assert.ok(h.next !== null);
  assert.equal(h.next, h.overdue[0]);
});

test("an LLP client only sees LLP obligations, not company ones", () => {
  const h = computeClientHealth(client({ type: "llp", cin: "AAB-1234" }), d("2026-09-03"));
  assert.ok(h.dated.every((r) => r.source.appliesTo.includes("llp")));
  assert.ok(!h.dated.some((r) => r.source.id === "aoc-4"));
});

test("a real AGM date changes which obligations are overdue vs not", () => {
  // FY 2026-27: not covered by any extension, so the AGM alone decides AOC-4.
  const withoutAgm = computeClientHealth(client(), d("2027-10-01"));
  const withAgm = computeClientHealth(client({ lastAgmOn: "2027-08-01" }), d("2027-10-01"));
  // A real, earlier AGM pulls AOC-4's deadline forward, changing overdue status.
  const aocWithout = withoutAgm.dated.find((r) => r.source.id === "aoc-4");
  const aocWith = withAgm.dated.find((r) => r.source.id === "aoc-4");
  assert.notEqual(aocWithout?.due?.getTime(), aocWith?.due?.getTime());
});

test("score never exceeds 0-100 and total 0 does not divide by zero", () => {
  // Dates far outside any FY logic edge case; just confirm no NaN/Infinity ever appears.
  for (const asOf of ["2026-01-01", "2026-04-01", "2027-04-01"]) {
    const h = computeClientHealth(client(), d(asOf));
    assert.ok(Number.isFinite(h.score));
    assert.ok(h.score >= 0 && h.score <= 100);
  }
});

/* ---------------- rolling across financial years ---------------- */

test("health always uses the rolling window: a pinned review year does not freeze it", () => {
  const auto = computeClientHealth(client(), d("2026-09-03"));
  const pinned = computeClientHealth(client({ workingFyEndingYear: 2025 }), d("2026-09-03"));
  assert.equal(auto.fyEndingYear, 2027, "sanity: 2026-09-03 is inside FY 2026-27");
  assert.equal(pinned.fyEndingYear, 2027);
  assert.deepEqual(
    pinned.dated.map((r) => r.source.id),
    auto.dated.map((r) => r.source.id),
  );
});

test("in October, last year's AOC-4 and MGT-7 count alongside this year's returns", () => {
  const h = computeClientHealth(client(), d("2026-10-09"));
  const aoc = h.dated.find((r) => r.source.id === "aoc-4" && r.fyEndingYear === 2026);
  const mgt = h.dated.find((r) => r.source.id === "mgt-7" && r.fyEndingYear === 2026);
  assert.ok(aoc, "FY 2025-26 AOC-4 is still to come");
  assert.ok(mgt, "FY 2025-26 MGT-7 is still to come");
  // Extended by MCA General Circular 05/2026 from 30 Oct / 29 Nov.
  assert.equal(aoc.due.toDateString(), d("2026-12-31").toDateString());
  assert.equal(mgt.due.toDateString(), d("2027-01-31").toDateString());
  assert.equal(aoc.statutoryDue.toDateString(), d("2026-10-30").toDateString());
  assert.ok(!h.dated.some((r) => r.source.id === "agm"), "the AGM's last date is not counted as a due");
});

test("the window moves on by itself: a year later, the next year's dates are shown", () => {
  const now = computeClientHealth(client(), d("2026-10-09"));
  const later = computeClientHealth(client(), d("2027-10-09"));
  const aocNow = now.dated.find((r) => r.source.id === "aoc-4");
  const aocLater = later.dated.find((r) => r.source.id === "aoc-4");
  assert.equal(aocLater.due.getFullYear(), aocNow.due.getFullYear() + 1);
});

test("without a pin, the working year still tracks today's date as before", () => {
  const h = computeClientHealth(client({ workingFyEndingYear: null }), d("2026-02-01"));
  assert.equal(h.fyEndingYear, 2026, "Feb 2026 is inside FY 2025-26");
});

/* ---------------- ADT-1 on the auditor's five-year term ---------------- */

test("ADT-1 recurs every five years from the first AGM when no appointment year is saved", () => {
  // Incorporated Jul 2019: first FY ends Mar 2020, so ADT-1 in FY 2019-20, 2024-25, 2029-30.
  const due2025 = computeClientHealth(client(), d("2025-10-01"));
  assert.ok(due2025.dated.some((r) => r.source.id === "adt-1" && r.fyEndingYear === 2025));
  const none2026 = computeClientHealth(client(), d("2026-10-01"));
  assert.ok(!none2026.dated.some((r) => r.source.id === "adt-1"));
});

test("a saved appointment year moves the cycle", () => {
  const h = computeClientHealth(client({ auditorAppointedAtAgmFy: 2026 }), d("2026-10-01"));
  const adt = h.dated.find((r) => r.source.id === "adt-1");
  assert.ok(adt);
  assert.equal(adt.fyEndingYear, 2026);
});

test("an LLP never sees ADT-1", () => {
  const h = computeClientHealth(
    client({ type: "llp", cin: "AAB-1234", auditorAppointedAtAgmFy: 2026 }),
    d("2026-10-01"),
  );
  assert.ok(!h.dated.some((r) => r.source.id === "adt-1"));
});
