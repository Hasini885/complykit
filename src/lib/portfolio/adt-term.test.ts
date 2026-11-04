import assert from "node:assert/strict";
import test from "node:test";

import { adtNaReason, appointmentFyFor, withAuditorTerm } from "@/lib/portfolio/auditor";
import { nextAdtFy, resolveClientYear } from "@/lib/portfolio/schedule";
import type { Client } from "@/lib/portfolio/types";

function client(over: Partial<Client> = {}): Client {
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

/** Financial years (ending) in which ADT-1 falls due, between two years. */
const adtYears = (c: Client, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i).filter((fy) =>
    resolveClientYear(c, [], fy).some((r) => r.source.id === "adt-1"),
  );

test("with no term entered, ADT-1 recurs every five years", () => {
  assert.deepEqual(adtYears(client({ auditorAppointedAtAgmFy: 2025 }), 2025, 2036), [2025, 2030, 2035]);
});

test("the subsequent auditor's term decides the next ADT-1", () => {
  assert.deepEqual(adtYears(client({ auditorAppointedAtAgmFy: 2025, auditorTermYears: 3 }), 2025, 2032), [2025, 2028, 2031]);
});

test("a one-year term (e.g. a casual vacancy until the next AGM) means ADT-1 every year", () => {
  assert.deepEqual(adtYears(client({ auditorAppointedAtAgmFy: 2026, auditorTermYears: 1 }), 2026, 2028), [2026, 2027, 2028]);
});

test("a term outside 1 to 5 years is held to the Act's limits", () => {
  assert.deepEqual(adtYears(client({ auditorAppointedAtAgmFy: 2025, auditorTermYears: 9 }), 2025, 2031), [2025, 2030]);
});

test("no annual ADT-1 in the first year (that is the first auditor's), then every five", () => {
  // Incorporated 14 Aug 2025: the first financial year ends 31 March 2026.
  const young = client({ incorporatedOn: "2025-08-14" });
  assert.deepEqual(adtYears(young, 2026, 2036), [2031, 2036]);
  assert.equal(nextAdtFy(young, 2026), 2031);
});

test("an appointment year before the company existed is read as its first AGM", () => {
  const slip = client({ incorporatedOn: "2025-08-14", auditorAppointedAtAgmFy: 2024 });
  assert.deepEqual(adtYears(slip, 2026, 2031), [2031]);
});

test("a later appointment year entered: due from then on, still none in the first year", () => {
  const later = client({ incorporatedOn: "2025-08-14", auditorAppointedAtAgmFy: 2027, auditorTermYears: 5 });
  assert.deepEqual(adtYears(later, 2026, 2032), [2027, 2032]);
});

test("years appointed: x years from the first AGM means x-1 NA years, then ADT-1 again", () => {
  const young = client({ incorporatedOn: "2025-08-14" });
  const three = withAuditorTerm(young, 2026, 3);
  assert.equal(three.auditorTermYears, 3);
  assert.deepEqual(adtYears(three, 2026, 2033), [2029, 2032]);
  assert.equal(withAuditorTerm(young, 2026, 9).auditorTermYears, 5, "the Act's maximum");
});

test("a new appointment partway through starts its own term; the old SRN no longer describes it", () => {
  const filed = client({
    incorporatedOn: "2019-07-18",
    auditorAppointedAtAgmFy: 2025,
    auditorTermYears: 5,
    adt1Srn: "AB1234567",
    adt1FiledOn: "2025-10-10",
  });
  assert.equal(appointmentFyFor(filed, 2028), 2025);
  assert.equal(appointmentFyFor(filed, 2031), 2030, "the second term");
  const renewed = withAuditorTerm(filed, 2030, 2);
  assert.deepEqual(adtYears(renewed, 2030, 2034), [2030, 2032, 2034]);
  assert.equal(renewed.adt1Srn, undefined);
  assert.equal(withAuditorTerm(filed, 2025, 3).adt1Srn, "AB1234567", "same appointment keeps its SRN");
});

test("the NA reason names the appointment, the years and the next due date", () => {
  const young = client({ incorporatedOn: "2025-08-14" });
  assert.match(adtNaReason(young, 2027), /^Auditor taken as appointed for 5 years at the AGM for FY 2025–26, next due 15\/10\/2031$/);
  const three = withAuditorTerm(young, 2026, 3);
  assert.match(adtNaReason(three, 2027), /^Auditor appointed for 3 years at the AGM for FY 2025–26, next due 15\/10\/2029$/);
  assert.match(adtNaReason(three, 2030), /^Auditor appointed for 3 years at the AGM for FY 2028–29, next due 15\/10\/2032$/);
  assert.match(adtNaReason(withAuditorTerm(young, 2028, 2), 2027), /^Auditor appointed later, at the AGM for FY 2027–28$/);
});
