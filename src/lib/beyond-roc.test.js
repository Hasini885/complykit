import assert from "node:assert/strict";
import test from "node:test";

import { isoDate, parseIsoDate } from "@/lib/dates";
import {
  daysRemaining,
  nextAnnualOccurrence,
  nextMonthlyOccurrence,
  nextQuarterlyOccurrence,
  resolveBeyondRocDue,
} from "@/lib/beyond-roc";
import { BEYOND_ROC_CATEGORIES, beyondRocItems } from "@/data/beyond-roc";

const d = (s) => parseIsoDate(s);

/* ---------------- monthly ---------------- */

test("monthly: day still ahead this month picks this month", () => {
  assert.equal(isoDate(nextMonthlyOccurrence(11, d("2026-09-03"))), "2026-09-11");
});

test("monthly: day already passed this month rolls to next month", () => {
  assert.equal(isoDate(nextMonthlyOccurrence(11, d("2026-09-15"))), "2026-10-11");
});

test("monthly: today IS the due date counts as due, not passed", () => {
  assert.equal(isoDate(nextMonthlyOccurrence(20, d("2026-09-20"))), "2026-09-20");
});

test("monthly: December rolls the year over correctly", () => {
  assert.equal(isoDate(nextMonthlyOccurrence(11, d("2026-12-15"))), "2027-01-11");
});

/* ---------------- annual ---------------- */

test("annual: date still ahead this year picks this year", () => {
  assert.equal(isoDate(nextAnnualOccurrence(12, 31, d("2026-06-01"))), "2026-12-31");
});

test("annual: date already passed rolls to next year", () => {
  assert.equal(isoDate(nextAnnualOccurrence(6, 30, d("2026-09-03"))), "2027-06-30");
});

/* ---------------- quarterly ---------------- */

test("quarterly: GSTR-1 QRMP cycles through all four quarters correctly", () => {
  // Apr-Jun due 13 Jul; Jul-Sep due 13 Oct; Oct-Dec due 13 Jan; Jan-Mar due 13 Apr.
  const quarters = [
    { endMonth: 6, dueMonth: 7, dueDay: 13 },
    { endMonth: 9, dueMonth: 10, dueDay: 13 },
    { endMonth: 12, dueMonth: 1, dueDay: 13 },
    { endMonth: 3, dueMonth: 4, dueDay: 13 },
  ];
  assert.equal(isoDate(nextQuarterlyOccurrence(quarters, d("2026-05-01"))), "2026-07-13");
  assert.equal(isoDate(nextQuarterlyOccurrence(quarters, d("2026-08-01"))), "2026-10-13");
  assert.equal(
    isoDate(nextQuarterlyOccurrence(quarters, d("2026-11-01"))),
    "2027-01-13",
    "Oct-Dec quarter due the following January",
  );
  assert.equal(isoDate(nextQuarterlyOccurrence(quarters, d("2027-02-01"))), "2027-04-13");
});

test("quarterly: TDS Q4 correctly gets two months, not one", () => {
  const q4 = [{ endMonth: 3, dueMonth: 5, dueDay: 31 }];
  assert.equal(isoDate(nextQuarterlyOccurrence(q4, d("2026-04-01"))), "2026-05-31");
  assert.equal(isoDate(nextQuarterlyOccurrence(q4, d("2026-06-01"))), "2027-05-31", "next year's Jan-Mar quarter");
});

test("quarterly: exactly on the due date counts as due", () => {
  const quarters = [{ endMonth: 6, dueMonth: 7, dueDay: 13 }];
  assert.equal(isoDate(nextQuarterlyOccurrence(quarters, d("2026-07-13"))), "2026-07-13");
});

/* ---------------- resolveBeyondRocDue dispatch ---------------- */

test("resolveBeyondRocDue dispatches by rule kind, and event rules have no date", () => {
  assert.equal(isoDate(resolveBeyondRocDue({ kind: "monthly", day: 11 }, d("2026-09-01"))), "2026-09-11");
  assert.equal(isoDate(resolveBeyondRocDue({ kind: "annual", month: 7, day: 15 }, d("2026-01-01"))), "2026-07-15");
  assert.equal(resolveBeyondRocDue({ kind: "event" }, d("2026-01-01")), null);
});

test("daysRemaining matches the calendar gap", () => {
  assert.equal(daysRemaining(d("2026-09-11"), d("2026-09-03")), 8);
  assert.equal(daysRemaining(d("2026-09-01"), d("2026-09-03")), -2);
});

/* ---------------- data integrity ---------------- */

test("every beyond-ROC item resolves without throwing and lands on/after 'today'", () => {
  const asOf = d("2026-09-03");
  for (const item of beyondRocItems) {
    const due = resolveBeyondRocDue(item.rule, asOf);
    if (item.rule.kind === "event") {
      assert.equal(due, null, `${item.id} is event-driven and must have no date`);
    } else {
      assert.ok(due !== null, `${item.id} failed to resolve a date`);
      assert.ok(due.getTime() >= asOf.getTime(), `${item.id} resolved to a date in the past`);
    }
  }
});

test("every item has a category in the published list and a non-empty schedule", () => {
  for (const item of beyondRocItems) {
    assert.ok(BEYOND_ROC_CATEGORIES.includes(item.category), `${item.id} has an unlisted category: ${item.category}`);
    assert.ok(item.scheduleText.length > 0, `${item.id} has no schedule text`);
    assert.ok(item.reference.length > 0, `${item.id} has no reference`);
    if (item.confidence === "review") {
      assert.ok(item.note && item.note.length > 0, `${item.id} is flagged for review but has no note explaining why`);
    }
  }
});

test("ids are unique", () => {
  assert.equal(new Set(beyondRocItems.map((i) => i.id)).size, beyondRocItems.length);
});

test("the GST tab matches the five rows specified, with the exact rules given", () => {
  const gst = beyondRocItems.filter((i) => i.category === "GST");
  assert.equal(gst.length, 5);
  const asOf = d("2026-01-01");
  const at = (id) => gst.find((i) => i.id === id);
  assert.equal(isoDate(resolveBeyondRocDue(at("gstr-1").rule, asOf)), "2026-01-11");
  assert.equal(isoDate(resolveBeyondRocDue(at("gstr-3b").rule, asOf)), "2026-01-20");
  assert.equal(isoDate(resolveBeyondRocDue(at("gstr-9").rule, asOf)), "2026-12-31");
});

test("the SEBI Reg 33 quarterly dates are arithmetically correct 45 days after quarter end", () => {
  const reg33 = beyondRocItems.find((i) => i.id === "lodr-reg33-q");
  if (reg33.rule.kind !== "quarterly") throw new Error("expected a quarterly rule");
  // Cross-checked against Python's date + timedelta(45) independently.
  const expectations = { 6: "08-14", 9: "11-14", 12: "02-14" };
  for (const q of reg33.rule.quarters) {
    assert.equal(
      `${String(q.dueMonth).padStart(2, "0")}-${String(q.dueDay).padStart(2, "0")}`,
      expectations[q.endMonth],
    );
  }
});
