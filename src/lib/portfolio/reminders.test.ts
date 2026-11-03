import assert from "node:assert/strict";
import test from "node:test";

import { alarmTrigger, buildIcs } from "@/lib/ics";
import {
  REMIND_DAYS_BEFORE,
  dueInWords,
  notYetNotified,
  pruneNotified,
  reminderCalendarEvents,
  remindersFor,
} from "@/lib/portfolio/reminders";
import { SEED_CLIENTS, SEED_DIRECTORS } from "@/lib/portfolio/sample-portfolio.fixture";
import type { Client } from "@/lib/portfolio/types";

// 23 Oct 2027: AOC-4 for FY 2026-27 (30 Oct 2027, no extension) is exactly 7 days out.
const asOf = new Date(2027, 9, 23);

test("the reminder window is open dues from today to 7 days ahead", () => {
  const { dueThisWeek } = remindersFor(SEED_CLIENTS, SEED_DIRECTORS, asOf);
  assert.ok(dueThisWeek.length > 0);
  assert.ok(dueThisWeek.every((r) => r.days >= 0 && r.days <= REMIND_DAYS_BEFORE && r.status !== "completed"));
  assert.ok(
    dueThisWeek.some((r) => r.form === "AOC-4" && r.days === 7),
    "a due exactly a week away is included",
  );
});

test("a due 8 days away is not yet in the window; it enters a day later", () => {
  const before = new Date(2027, 9, 22);
  const at8 = remindersFor(SEED_CLIENTS, SEED_DIRECTORS, before).dueThisWeek;
  assert.ok(!at8.some((r) => r.form === "AOC-4" && r.fy === "FY 2026–27"));
  const at7 = remindersFor(SEED_CLIENTS, SEED_DIRECTORS, asOf).dueThisWeek;
  assert.ok(at7.some((r) => r.form === "AOC-4" && r.fy === "FY 2026–27"));
});

test("a filed due is never reminded", () => {
  const clients: Client[] = SEED_CLIENTS.map((c) =>
    c.id === "cl-meridian"
      ? { ...c, filings: [{ key: "aoc-4|2027|", filedOn: "2027-10-20", srn: "AB1234567" }] }
      : c,
  );
  const { dueThisWeek } = remindersFor(clients, SEED_DIRECTORS, asOf);
  assert.ok(!dueThisWeek.some((r) => r.clientId === "cl-meridian" && r.form === "AOC-4"));
  assert.ok(dueThisWeek.some((r) => r.clientId === "cl-satara" && r.form === "AOC-4"), "others still are");
});

test("overdue open dues are listed separately, most overdue first", () => {
  const { overdue } = remindersFor(SEED_CLIENTS, SEED_DIRECTORS, asOf);
  assert.ok(overdue.every((r) => r.days < 0));
  const days = overdue.map((r) => r.days);
  assert.deepEqual(days, [...days].sort((a, b) => a - b));
});

test("desktop notifications fire once per due, and the record does not grow forever", () => {
  const { dueThisWeek } = remindersFor(SEED_CLIENTS, SEED_DIRECTORS, asOf);
  const first = notYetNotified(dueThisWeek, new Set());
  assert.equal(first.length, dueThisWeek.length);

  const seen = new Set(first.map((r) => r.id));
  assert.equal(notYetNotified(dueThisWeek, seen).length, 0, "nothing repeats");

  const pruned = pruneNotified(new Set([...seen, "long-gone-due"]), dueThisWeek);
  assert.ok(!pruned.has("long-gone-due"));
  assert.equal(pruned.size, seen.size);
});

test("calendar events: open, upcoming dues only, each with a 7-day alarm", () => {
  const events = reminderCalendarEvents(SEED_CLIENTS, SEED_DIRECTORS, asOf);
  assert.ok(events.length > 0);
  assert.ok(events.every((e) => e.date.getTime() >= asOf.getTime()));
  assert.ok(events.every((e) => e.remindDaysBefore === REMIND_DAYS_BEFORE));
  assert.equal(new Set(events.map((e) => e.uid)).size, events.length, "stable unique ids");
});

test("the .ics alarm fires at 9 am seven days before an all-day due", () => {
  assert.equal(alarmTrigger(7), "-P6DT15H");
  const ics = buildIcs([
    { uid: "x@complykit", title: "AOC-4", date: new Date(2026, 9, 30), remindDaysBefore: 7 },
  ]);
  assert.match(ics, /DTSTART;VALUE=DATE:20261030\r\n/);
  assert.match(ics, /DTEND;VALUE=DATE:20261031\r\n/);
  assert.match(ics, /BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:AOC-4 is due in 7 days\r\nTRIGGER:-P6DT15H\r\nEND:VALARM\r\n/);
  assert.doesNotMatch(buildIcs([{ uid: "y", title: "t", date: new Date(2026, 0, 1) }]), /VALARM/, "no alarm unless asked");
});

test("wording", () => {
  assert.equal(dueInWords(0), "Due today");
  assert.equal(dueInWords(1), "Due tomorrow");
  assert.equal(dueInWords(7), "Due in 7 days");
});

test("the extended FY 2025-26 AOC-4 is reminded a week before 31 Dec 2026, not before 30 Oct", () => {
  const oct23 = remindersFor(SEED_CLIENTS, SEED_DIRECTORS, new Date(2026, 9, 23)).dueThisWeek;
  assert.ok(!oct23.some((r) => r.form === "AOC-4" && r.fy === "FY 2025–26"));
  const dec24 = remindersFor(SEED_CLIENTS, SEED_DIRECTORS, new Date(2026, 11, 24)).dueThisWeek;
  assert.ok(dec24.some((r) => r.form === "AOC-4" && r.fy === "FY 2025–26" && r.days === 7));
});

test("no reminders for meetings: the AGM and first Board meeting are left out", () => {
  for (const day of [new Date(2026, 8, 25), new Date(2026, 9, 5)]) {
    const r = remindersFor(SEED_CLIENTS, SEED_DIRECTORS, day);
    const all = [...r.dueThisWeek, ...r.overdue];
    assert.ok(!all.some((x) => /general meeting|board meeting/i.test(x.obligation)), day.toDateString());
    assert.ok(all.every((x) => x.form !== ""));
  }
  const events = reminderCalendarEvents(SEED_CLIENTS, SEED_DIRECTORS, new Date(2026, 8, 1));
  assert.ok(!events.some((e) => /general meeting/i.test(e.title)), "no AGM in the calendar file either");
});
