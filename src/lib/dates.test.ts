import assert from "node:assert/strict";
import test from "node:test";

import {
  addDays,
  addMonths,
  agmDeadline,
  daysBetween,
  financialYearEnd,
  financialYearLabel,
  firstFinancialYearEnd,
  formatDate,
  hasLongFirstFinancialYear,
  incorporationTimeline,
  isoDate,
  makeDate,
  parseIsoDate,
  relativeLabel,
  urgency,
} from "@/lib/dates";
import { groupByMonth, resolveDueDates, statutoryAgmDate } from "@/lib/resolve-due-dates";
import { dueDates } from "@/data/due-dates";
import { forms } from "@/data/forms";

const d = (s: string) => parseIsoDate(s)!;

/* ---------------- primitives ---------------- */

test("addMonths clamps to the end of a shorter month", () => {
  assert.equal(isoDate(addMonths(d("2026-03-31"), 6)), "2026-09-30");
  assert.equal(isoDate(addMonths(d("2026-03-31"), 9)), "2026-12-31");
  assert.equal(isoDate(addMonths(d("2026-01-31"), 1)), "2026-02-28");
  assert.equal(isoDate(addMonths(d("2024-01-31"), 1)), "2024-02-29", "leap year");
  assert.equal(isoDate(addMonths(d("2026-10-31"), 1)), "2026-11-30");
});

test("addMonths crosses year boundaries", () => {
  assert.equal(isoDate(addMonths(d("2026-11-30"), 3)), "2027-02-28");
  assert.equal(isoDate(addMonths(d("2026-06-15"), -9)), "2025-09-15");
});

test("addDays crosses months, years and leap days", () => {
  assert.equal(isoDate(addDays(d("2026-12-31"), 1)), "2027-01-01");
  assert.equal(isoDate(addDays(d("2024-02-28"), 1)), "2024-02-29", "2024 is a leap year");
  assert.equal(isoDate(addDays(d("2026-02-28"), 1)), "2026-03-01", "2026 is not");
  assert.equal(isoDate(addDays(d("2026-03-01"), -1)), "2026-02-28");
});

test("daysBetween is inclusive of direction and handles leap years", () => {
  assert.equal(daysBetween(d("2026-01-01"), d("2026-01-31")), 30);
  assert.equal(daysBetween(d("2026-01-31"), d("2026-01-01")), -30);
  assert.equal(daysBetween(d("2024-01-01"), d("2025-01-01")), 366, "2024 has 366 days");
  assert.equal(daysBetween(d("2025-01-01"), d("2026-01-01")), 365);
});

test("parseIsoDate rejects impossible dates instead of rolling over", () => {
  assert.equal(parseIsoDate("2026-02-31"), null);
  assert.equal(parseIsoDate("2026-13-01"), null);
  assert.equal(parseIsoDate("2026-00-10"), null);
  assert.equal(parseIsoDate("not a date"), null);
  assert.equal(parseIsoDate("2026-02-28")!.getDate(), 28);
  assert.equal(parseIsoDate("2024-02-29")!.getDate(), 29, "valid in a leap year");
  assert.equal(parseIsoDate("2026-02-29"), null, "not valid in a common year");
});

test("formatting", () => {
  assert.equal(formatDate(makeDate(2026, 9, 30)), "30 Sep 2026");
  assert.equal(formatDate(makeDate(2026, 1, 1)), "01 Jan 2026");
  assert.equal(financialYearLabel(2026), "FY 2025–26");
  assert.equal(isoDate(financialYearEnd(2026)), "2026-03-31");
});

/* ---------------- financial year, s.2(41) ---------------- */

test("first financial year end: incorporated April to December", () => {
  assert.equal(isoDate(firstFinancialYearEnd(d("2019-07-18"))), "2020-03-31");
  assert.equal(isoDate(firstFinancialYearEnd(d("2025-12-31"))), "2026-03-31");
  assert.equal(isoDate(firstFinancialYearEnd(d("2026-04-01"))), "2027-03-31");
});

test("first financial year end: incorporated January to March runs long", () => {
  // s.2(41) pushes the close on to 31 March of the FOLLOWING year.
  assert.equal(isoDate(firstFinancialYearEnd(d("2026-02-15"))), "2027-03-31");
  assert.equal(isoDate(firstFinancialYearEnd(d("2026-01-01"))), "2027-03-31");
  assert.equal(isoDate(firstFinancialYearEnd(d("2026-03-31"))), "2027-03-31");
});

test("long-first-year flag matches the January to March window", () => {
  assert.equal(hasLongFirstFinancialYear(d("2026-01-01")), true);
  assert.equal(hasLongFirstFinancialYear(d("2026-03-31")), true);
  assert.equal(hasLongFirstFinancialYear(d("2026-04-01")), false);
  assert.equal(hasLongFirstFinancialYear(d("2026-12-31")), false);
});

/* ---------------- AGM, s.96 ---------------- */

test("AGM deadline: six months for a subsequent meeting, nine for the first", () => {
  assert.equal(isoDate(agmDeadline(d("2026-03-31"), false)), "2026-09-30");
  assert.equal(isoDate(agmDeadline(d("2026-03-31"), true)), "2026-12-31");
});

/* ---------------- urgency ---------------- */

test("urgency and relative labels are computed against a fixed reference", () => {
  const ref = d("2026-09-03");
  assert.equal(urgency(d("2026-09-02"), ref), "overdue");
  assert.equal(urgency(d("2026-09-03"), ref), "due-soon");
  assert.equal(urgency(d("2026-10-03"), ref), "due-soon", "30 days is still due-soon");
  assert.equal(urgency(d("2026-10-04"), ref), "upcoming");

  assert.equal(relativeLabel(d("2026-09-03"), ref), "due today");
  assert.equal(relativeLabel(d("2026-09-04"), ref), "in 1 day");
  assert.equal(relativeLabel(d("2026-09-13"), ref), "in 10 days");
  assert.equal(relativeLabel(d("2026-09-02"), ref), "1 day overdue");
});

/* ---------------- incorporation timeline ---------------- */

test("incorporation timeline is ordered and complete", () => {
  const items = incorporationTimeline(d("2026-07-15"));
  assert.ok(items.length >= 10);
  for (let i = 1; i < items.length; i++) {
    assert.ok(
      items[i].due.getTime() >= items[i - 1].due.getTime(),
      "timeline must be sorted by date",
    );
  }
  assert.equal(new Set(items.map((i) => i.id)).size, items.length, "ids unique");
});

test("incorporation timeline: the statutory counts are right", () => {
  const inc = d("2026-07-15");
  const items = incorporationTimeline(inc);
  const at = (id: string) => items.find((i) => i.id === id)!;

  assert.equal(isoDate(at("first-board-meeting").due), "2026-08-14", "30 days");
  assert.equal(isoDate(at("first-auditor").due), "2026-08-14", "30 days");
  assert.equal(isoDate(at("first-auditor-members").due), "2026-10-13", "90 days");
  assert.equal(isoDate(at("inc-20a").due), "2027-01-11", "180 days");
  assert.equal(isoDate(at("first-fy-end").due), "2027-03-31");
  assert.equal(isoDate(at("first-agm").due), "2027-12-31", "FY end + 9 months");
  assert.equal(isoDate(at("first-adt-1").due), "2028-01-15", "AGM + 15 days");
  assert.equal(isoDate(at("first-aoc-4").due), "2028-01-30", "AGM + 30 days");
  // 31 Dec 2027 + 60 days lands on 29 February because 2028 is a leap year.
  assert.equal(isoDate(at("first-mgt-7").due), "2028-02-29", "AGM + 60 days, leap year");
});

test("incorporation timeline: a January incorporation gets the long first year", () => {
  const items = incorporationTimeline(d("2026-02-15"));
  const fy = items.find((i) => i.id === "first-fy-end")!;
  assert.equal(isoDate(fy.due), "2027-03-31");
  assert.match(fy.detail, /fifteen months/);
});

test("incorporation timeline: AGM-derived items are flagged as assumed", () => {
  const items = incorporationTimeline(d("2026-07-15"));
  for (const id of ["first-adt-1", "first-aoc-4", "first-mgt-7"]) {
    assert.equal(items.find((i) => i.id === id)!.assumed, true, `${id} should be flagged`);
  }
  assert.equal(items.find((i) => i.id === "inc-20a")!.assumed, false);
});

/* ---------------- recurring due dates ---------------- */

test("data: every due date maps to a real form where it claims one", () => {
  const ids = new Set(forms.map((f) => f.id));
  for (const dd of dueDates) {
    if (dd.formId) assert.ok(ids.has(dd.formId), `${dd.id} points at unknown form ${dd.formId}`);
    assert.ok(dd.appliesTo.length > 0, `${dd.id} applies to nothing`);
  }
});

test("resolve: private company for FY 2025-26", () => {
  const items = resolveDueDates({ companyType: "private", fyEndingYear: 2026 });
  const by = (id: string) => items.filter((i) => i.source.id === id);

  assert.equal(by("agm").length, 0, "the AGM's last date is not listed as a due");
  assert.equal(isoDate(by("aoc-4")[0].statutoryDue!), "2026-10-30", "AGM + 30");
  assert.equal(isoDate(by("mgt-7")[0].statutoryDue!), "2026-11-29", "AGM + 60");
  // MCA General Circular 05/2026 moves the effective dates for FY 2025-26.
  assert.equal(isoDate(by("aoc-4")[0].due!), "2026-12-31");
  assert.equal(isoDate(by("mgt-7")[0].due!), "2027-01-31");
  assert.equal(isoDate(by("adt-1")[0].due!), "2026-10-15", "AGM + 15");
  assert.equal(isoDate(by("dpt-3")[0].due!), "2026-06-30");
  // Amendment Rules 2025 (w.e.f. 31 Mar 2026): 30 June, triennial — not 30 September.
  assert.equal(isoDate(by("dir-3-kyc")[0].due!), "2026-06-30");
});

test("resolve: an actual AGM date pulls the dependent filings forward", () => {
  const withActual = resolveDueDates({
    companyType: "private",
    fyEndingYear: 2026,
    agmDate: d("2026-08-14"),
  });
  const aoc4 = withActual.find((i) => i.source.id === "aoc-4")!;
  assert.equal(isoDate(aoc4.statutoryDue!), "2026-09-13", "AGM + 30 from the actual date");
  assert.equal(isoDate(aoc4.due!), "2026-12-31", "extended by GC 05/2026");
  assert.equal(aoc4.anchoredOnAssumedAgm, false);

  const assumed = resolveDueDates({ companyType: "private", fyEndingYear: 2026 });
  assert.equal(assumed.find((i) => i.source.id === "aoc-4")!.anchoredOnAssumedAgm, true);
});

test("resolve: an OPC holds no AGM and files AOC-4 on the 180-day limb", () => {
  const opc = resolveDueDates({ companyType: "opc", fyEndingYear: 2026 });

  assert.equal(opc.filter((i) => i.source.id === "agm").length, 0, "no AGM for an OPC");

  const aoc4 = opc.find((i) => i.source.id === "aoc-4")!;
  assert.equal(isoDate(aoc4.statutoryDue!), "2026-09-27", "31 Mar 2026 + 180 days");
  assert.equal(isoDate(aoc4.due!), "2026-12-31", "the circular covers OPCs too");
  assert.ok(aoc4.overrideReason, "the override must explain itself");
  assert.match(aoc4.overrideReason!, /no annual general meeting/i);

  const board = opc.find((i) => i.source.id === "board-meetings")!;
  assert.match(board.qualifier!, /Two meetings a year/);
});

test("resolve: half-yearly obligations produce two dated entries", () => {
  const items = resolveDueDates({ companyType: "private", fyEndingYear: 2026 });
  const msme = items.filter((i) => i.source.id === "msme-1");
  assert.equal(msme.length, 2);
  assert.deepEqual(
    msme.map((m) => isoDate(m.due!)).sort(),
    ["2025-10-31", "2026-04-30"],
    "Apr-Sep falls in the previous calendar year",
  );
  assert.deepEqual(msme.map((m) => m.qualifier).sort(), ["April to September", "October to March"]);
});

test("resolve: filters by company type", () => {
  const llp = resolveDueDates({ companyType: "llp", fyEndingYear: 2026 });
  const codes = llp.map((i) => i.source.formCode);
  assert.ok(codes.includes("LLP Form 11"));
  assert.ok(codes.includes("LLP Form 8"));
  assert.ok(!codes.includes("AOC-4"), "an LLP does not file AOC-4");
  assert.equal(isoDate(llp.find((i) => i.source.id === "llp-11")!.due!), "2026-05-30");
  assert.equal(isoDate(llp.find((i) => i.source.id === "llp-8")!.due!), "2026-10-30");

  const publicCo = resolveDueDates({ companyType: "public", fyEndingYear: 2026 });
  assert.ok(publicCo.some((i) => i.source.id === "pas-6"), "PAS-6 applies to public companies");
  const privateCo = resolveDueDates({ companyType: "private", fyEndingYear: 2026 });
  assert.ok(!privateCo.some((i) => i.source.id === "pas-6"), "not to private companies");
});

test("resolve: results are date-ordered with cadence items last", () => {
  const items = resolveDueDates({ companyType: "private", fyEndingYear: 2026 });
  const dated = items.filter((i) => i.due);
  for (let i = 1; i < dated.length; i++) {
    assert.ok(dated[i].due!.getTime() >= dated[i - 1].due!.getTime());
  }
  const firstUndated = items.findIndex((i) => !i.due);
  if (firstUndated !== -1) {
    assert.ok(
      items.slice(firstUndated).every((i) => !i.due),
      "once undated items start, no dated item may follow",
    );
  }
});

test("groupByMonth splits dated from cadence obligations", () => {
  const items = resolveDueDates({ companyType: "private", fyEndingYear: 2026 });
  const { months, undated } = groupByMonth(items);
  assert.ok(months.length > 0);
  assert.equal(
    months.reduce((n, m) => n + m.items.length, 0) + undated.length,
    items.length,
    "nothing may be dropped",
  );
  assert.ok(undated.every((i) => i.due === null));
});

/* ------------------------------------------------------------------ */
/* Per-company resolution: incorporation date changes the answers      */
/* ------------------------------------------------------------------ */

/**
 * The point of these: two companies differing ONLY in incorporation date must
 * get genuinely different calendars. A regression that reverts the calendar to
 * one shared set of dates would fail here rather than in a screenshot.
 */

const OLD_CO = { incorporatedOn: makeDate(2021, 6, 15), fyEndingYear: 2026 };
const NEW_CO = { incorporatedOn: makeDate(2026, 8, 20), fyEndingYear: 2027 };
const AS_OF = makeDate(2026, 9, 4);

/** The date the Act gives, before any MCA extension. */
const dueOn = (items: ReturnType<typeof resolveDueDates>, id: string) => {
  const r = items.find((x) => x.source.id === id);
  return r ? (r.statutoryDue ?? r.due) : null;
};

test("first AGM gets nine months from FY end; later AGMs get six (Sec 96)", () => {
  const established = resolveDueDates({
    companyType: "private",
    ...OLD_CO,
    asOf: AS_OF,
  });
  const incorporated = resolveDueDates({
    companyType: "private",
    ...NEW_CO,
    asOf: AS_OF,
  });

  // FY 2025-26 closes 31 Mar 2026; not this company's first year -> +6 months.
  assert.deepEqual(statutoryAgmDate({ companyType: "private", ...OLD_CO, asOf: AS_OF }), makeDate(2026, 9, 30));
  // Incorporated 20 Aug 2026, so under s.2(41) the first FY closes 31 Mar 2027,
  // and being the FIRST AGM it gets nine months, not six.
  assert.deepEqual(statutoryAgmDate({ companyType: "private", ...NEW_CO, asOf: AS_OF }), makeDate(2027, 12, 31));
  // Worked out, but never listed.
  assert.equal(dueOn(established, "agm"), null);
  assert.equal(dueOn(incorporated, "agm"), null);
});

test("the nine-month first AGM flows through to AGM-anchored filings", () => {
  const established = resolveDueDates({ companyType: "private", ...OLD_CO, asOf: AS_OF });
  const incorporated = resolveDueDates({ companyType: "private", ...NEW_CO, asOf: AS_OF });

  // AOC-4 is AGM + 30 days, so it must move with the AGM anchor, not sit on a
  // fixed date shared by every company.
  assert.deepEqual(dueOn(established, "aoc-4"), makeDate(2026, 10, 30));
  assert.deepEqual(dueOn(incorporated, "aoc-4"), makeDate(2028, 1, 30));
});

test("first board meeting and first auditor show only for a newly incorporated company", () => {
  const incorporated = resolveDueDates({ companyType: "private", ...NEW_CO, asOf: AS_OF });
  const established = resolveDueDates({ companyType: "private", ...OLD_CO, asOf: AS_OF });

  // 20 Aug 2026 + 30 days.
  assert.deepEqual(dueOn(incorporated, "first-board-meeting"), makeDate(2026, 9, 19));
  assert.deepEqual(dueOn(incorporated, "first-auditor"), makeDate(2026, 9, 19));

  // A company five years old is long past both; showing them would be noise.
  assert.equal(
    established.some((r) => r.source.id === "first-board-meeting"),
    false,
  );
  assert.equal(
    established.some((r) => r.source.id === "first-auditor"),
    false,
  );
});

test("the first-year duties drop off the day after their window closes", () => {
  const inside = resolveDueDates({
    companyType: "private",
    ...NEW_CO,
    asOf: makeDate(2026, 9, 19), // day 30 — still in
  });
  const outside = resolveDueDates({
    companyType: "private",
    ...NEW_CO,
    asOf: makeDate(2026, 9, 20), // day 31 — gone
  });

  assert.ok(inside.some((r) => r.source.id === "first-board-meeting"));
  assert.equal(
    outside.some((r) => r.source.id === "first-board-meeting"),
    false,
  );
});

test("without an incorporation date, first-year rules are skipped rather than guessed", () => {
  const unknown = resolveDueDates({ companyType: "private", fyEndingYear: 2027, asOf: AS_OF });

  assert.equal(
    unknown.some((r) => r.source.id === "first-board-meeting"),
    false,
  );
  // Falls back to the ordinary six-month AGM rather than inventing a first year.
  assert.deepEqual(
    statutoryAgmDate({ companyType: "private", fyEndingYear: 2027, asOf: AS_OF }),
    makeDate(2027, 9, 30),
  );
});

test("two companies with different incorporation dates get different calendars", () => {
  const a = resolveDueDates({ companyType: "private", ...OLD_CO, asOf: AS_OF });
  const b = resolveDueDates({ companyType: "private", ...NEW_CO, asOf: AS_OF });

  const signature = (items: ReturnType<typeof resolveDueDates>) =>
    items.map((r) => `${r.source.id}:${r.due ? isoDate(r.due) : "-"}`).join("|");

  assert.notEqual(signature(a), signature(b), "the two calendars must not be identical");
});
