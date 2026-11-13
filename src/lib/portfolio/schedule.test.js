import assert from "node:assert/strict";
import test from "node:test";

import { parseIsoDate } from "@/lib/dates";
import { resolveDueDates } from "@/lib/resolve-due-dates";
import { computeClientHealth } from "@/lib/portfolio/health";
import { agmFyOf, applyDraft, draftFrom, keepPreviousAgm } from "@/lib/portfolio/clients";
import { normalise } from "@/lib/portfolio/repository";
import { clientSchedule, resolveClientYear, selectableYears } from "@/lib/portfolio/schedule";
const d = (s) => parseIsoDate(s);
const iso = (x) =>
  x ? `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}` : null;

function client(over = {}) {
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

function director(over = {}) {
  return {
    id: "d1",
    name: "Ananya Raghavan",
    din: "07712345",
    dinAllottedOn: "2023-07-15",
    directorships: [{ clientId: "c1", role: "Director", appointedOn: "2023-07-15" }],
    createdAt: "",
    updatedAt: "",
    ...over,
  };
}

const find = (items, id) => items.find((r) => r.source.id === id);

/* ---------------- AGM: each year its own ---------------- */

test("an AGM date anchors only the year it was held for, not every year", () => {
  const c = client({ lastAgmOn: "2025-09-26" }); // AGM for FY 2024-25
  assert.equal(agmFyOf(d("2025-09-26")), 2025);

  const fy2025 = resolveClientYear(c, [], 2025);
  assert.equal(iso(find(fy2025, "aoc-4").due), "2025-10-26", "30 days from the actual AGM");
  assert.equal(find(fy2025, "aoc-4").anchoredOnAssumedAgm, false);

  const fy2026 = resolveClientYear(c, [], 2026);
  assert.equal(
    iso(find(fy2026, "aoc-4").statutoryDue ?? null),
    "2026-10-30",
    "next year falls back to the statutory last date",
  );
  assert.equal(iso(find(fy2026, "aoc-4").due), "2026-12-31", "then extended by GC 05/2026");
  assert.equal(find(fy2026, "aoc-4").anchoredOnAssumedAgm, true);
});

test("earlier AGMs on record keep anchoring their own years", () => {
  const c = client({ lastAgmOn: "2026-08-20", agmHistory: ["2025-09-26"] });
  assert.equal(iso(find(resolveClientYear(c, [], 2025), "aoc-4").due), "2025-10-26");
  assert.equal(iso(find(resolveClientYear(c, [], 2026), "aoc-4").statutoryDue ?? null), "2026-09-19");
});

test("Section 96: no more than fifteen months between two AGMs", () => {
  // Previous AGM on 15 Jun 2025: fifteen months is 15 Sep 2026, before the usual 30 Sep.
  const c = client({ lastAgmOn: "2025-06-15" });
  // AOC-4 counts 30 days from that AGM limit.
  assert.equal(iso(find(resolveClientYear(c, [], 2026), "aoc-4").statutoryDue ?? null), "2026-10-15");
  // A late previous AGM does not push the date past six months.
  const late = client({ lastAgmOn: "2025-09-29" });
  assert.equal(iso(find(resolveClientYear(late, [], 2026), "aoc-4").statutoryDue ?? null), "2026-10-30");
});

test("recording a later AGM keeps the earlier one; a same-year correction replaces it", () => {
  const c = client({ lastAgmOn: "2025-09-26" });
  assert.deepEqual(keepPreviousAgm(c, "2026-08-20"), ["2025-09-26"]);
  assert.deepEqual(keepPreviousAgm(c, "2025-09-20"), [], "same FY: a correction, not history");

  const edited = applyDraft(c, { ...draftFrom(c), lastAgmOn: "2026-08-20" });
  assert.deepEqual(edited.agmHistory, ["2025-09-26"]);
  assert.equal(edited.lastAgmOn, "2026-08-20");
});

/* ---------------- DIR-3 KYC per director ---------------- */

test("DIR-3 KYC is shown per director, on their own three-year cycle", () => {
  // DIN allotted 15 Jul 2023 (FY 2023-24): due 30 Jun 2026, then 30 Jun 2029.
  const dirs = [director()];
  const kyc2026 = resolveClientYear(client(), dirs, 2026).filter((r) => r.source.id.startsWith("dir-3-kyc"));
  assert.equal(kyc2026.length, 1);
  assert.equal(kyc2026[0].source.title, "Director KYC — Ananya Raghavan");
  assert.equal(iso(kyc2026[0].due), "2026-06-30");

  for (const fy of [2027, 2028]) {
    const none = resolveClientYear(client(), dirs, fy).filter((r) => r.source.id.startsWith("dir-3-kyc"));
    assert.equal(none.length, 0, `nothing in FY ending ${fy}`);
  }
  assert.equal(iso(find(resolveClientYear(client(), dirs, 2029), "dir-3-kyc:d1").due), "2029-06-30");
});

test("two directors with different DIN years fall due in different years", () => {
  const dirs = [director(), director({ id: "d2", name: "Nita Bhaskar", din: "03445901", dinAllottedOn: "2024-05-10" })];
  // d2: FY 2024-25 -> first due 30 Jun 2027.
  assert.ok(find(resolveClientYear(client(), dirs, 2026), "dir-3-kyc:d1"));
  assert.ok(!find(resolveClientYear(client(), dirs, 2026), "dir-3-kyc:d2"));
  assert.ok(find(resolveClientYear(client(), dirs, 2027), "dir-3-kyc:d2"));
});

test("a KYC filing for the cycle marks it filed, and health does not count it overdue", () => {
  const dirs = [director({ lastKycFiledOn: "2026-05-20" })];
  const row = find(resolveClientYear(client(), dirs, 2026), "dir-3-kyc:d1");
  assert.equal(iso(row.filedOn ?? null), "2026-05-20");
  const h = computeClientHealth(client(), d("2026-07-15"), dirs);
  assert.ok(!h.overdue.some((r) => r.source.id === "dir-3-kyc:d1"));

  const unfiled = computeClientHealth(client(), d("2026-07-15"), [director()]);
  assert.ok(unfiled.overdue.some((r) => r.source.id === "dir-3-kyc:d1"));
});

test("a director who left before the due date is not listed for this company", () => {
  const gone = director({
    directorships: [{ clientId: "c1", role: "Director", appointedOn: "2023-07-15", cessationOn: "2025-12-31" }],
  });
  assert.ok(!find(resolveClientYear(client(), [gone], 2026), "dir-3-kyc:d1"));
});

test("with no directors on record, KYC asks for them instead of showing a fixed 30 June", () => {
  const items = resolveClientYear(client(), [], 2026);
  const kyc = items.filter((r) => r.source.id.startsWith("dir-3-kyc"));
  assert.equal(kyc.length, 1);
  assert.equal(kyc[0].due, null);
  assert.match(kyc[0].qualifier ?? "", /Director Master/);
});

test("the generic calendar (no company) still shows the one company-wide KYC row", () => {
  const generic = resolveDueDates({ companyType: "private", fyEndingYear: 2026 });
  assert.ok(generic.some((r) => r.source.id === "dir-3-kyc" && r.due !== null));
});

/* ---------------- profile decides what applies ---------------- */

test("MSME-1 and PAS-6 are not tracked for any company", () => {
  assert.ok(!find(resolveClientYear(client({ msmeDuesOver45Days: true }), [], 2027), "msme-1"));
  assert.ok(!find(resolveClientYear(client({ type: "public", cin: "U00000KA2019PLC000000" }), [], 2027), "pas-6"));
});

/* ---------------- the rolling window ---------------- */

test("a company incorporated this year gets no previous-year filings, and its first-year duties", () => {
  const fresh = client({ incorporatedOn: "2026-08-01" });
  const items = clientSchedule(fresh, [], d("2026-08-10"));
  assert.ok(
    items.every((r) => r.fyEndingYear >= 2027),
    "nothing for a year before it existed",
  );
  assert.ok(items.some((r) => r.source.id === "first-board-meeting"));
  // First AGM: nine months from 31 Mar 2027.
  assert.equal(
    items.some((r) => r.source.id === "agm"),
    false,
    "the AGM's last date is never listed",
  );
  // First AGM limit is nine months from 31 Mar 2027 (31 Dec 2027); AOC-4 follows 30 days later.
  const later = resolveClientYear(fresh, [], 2027);
  assert.equal(iso(find(later, "aoc-4").statutoryDue ?? find(later, "aoc-4").due), "2028-01-30");
});

test("one-time duties from incorporation are not repeated once per year", () => {
  const fresh = client({ incorporatedOn: "2026-08-01" });
  const items = clientSchedule(fresh, [], d("2026-08-10"));
  assert.equal(items.filter((r) => r.source.id === "first-board-meeting").length, 1);
});

test("the year picker moves on by itself and never offers years before incorporation", () => {
  assert.deepEqual(selectableYears(client(), d("2026-10-09")), [2024, 2025, 2026, 2027, 2028]);
  assert.deepEqual(selectableYears(client(), d("2027-10-09")), [2025, 2026, 2027, 2028, 2029]);
  assert.deepEqual(selectableYears(client({ incorporatedOn: "2025-06-01" }), d("2026-10-09")), [2026, 2027, 2028]);
});

/* ---------------- old saved data ---------------- */

test("an old 'auditor appointed this year' tick becomes the year of the AGM on record", () => {
  const old = client({ auditorAppointedThisYear: true, lastAgmOn: "2025-09-26" });
  const [migrated] = normalise({ clients: [old], directors: [] }).clients;
  assert.equal(migrated.auditorAppointedAtAgmFy, 2025);
  assert.equal("auditorAppointedThisYear" in migrated, false);

  const unticked = normalise({ clients: [client({ auditorAppointedThisYear: false })], directors: [] }).clients[0];
  assert.equal(unticked.auditorAppointedAtAgmFy, undefined, "unticked: left to the automatic cycle");
});
