import assert from "node:assert/strict";
import test from "node:test";

import {
  adtNaReason,
  appointmentCovering,
  appointmentFyFor,
  withAdt1Appointment,
  withAuditorTerm,
} from "@/lib/portfolio/auditor";
import { resolveClientYear } from "@/lib/portfolio/schedule";
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

/** Financial years (ending) in which ADT-1 falls due, between two years. */
const adtYears = (c, from, to) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i).filter((fy) =>
    resolveClientYear(c, [], fy).some((r) => r.source.id === "adt-1"),
  );

test("with no term entered, ADT-1 recurs every five years", () => {
  assert.deepEqual(adtYears(client({ auditorAppointedAtAgmFy: 2025 }), 2025, 2036), [2025, 2030, 2035]);
});

test("the subsequent auditor's term decides the next ADT-1", () => {
  assert.deepEqual(
    adtYears(client({ auditorAppointedAtAgmFy: 2025, auditorTermYears: 3 }), 2025, 2032),
    [2025, 2028, 2031],
  );
});

test("a one-year term (e.g. a casual vacancy until the next AGM) means ADT-1 every year", () => {
  assert.deepEqual(
    adtYears(client({ auditorAppointedAtAgmFy: 2026, auditorTermYears: 1 }), 2026, 2028),
    [2026, 2027, 2028],
  );
});

test("a term outside 1 to 5 years is held to the Act's limits", () => {
  assert.deepEqual(adtYears(client({ auditorAppointedAtAgmFy: 2025, auditorTermYears: 9 }), 2025, 2031), [2025, 2030]);
});

test("the first AGM always appoints the auditor: ADT-1 for the first year, then every five", () => {
  // Incorporated 14 Aug 2025: the first financial year ends 31 March 2026.
  const young = client({ incorporatedOn: "2025-08-14" });
  assert.deepEqual(adtYears(young, 2026, 2036), [2026, 2031, 2036]);
});

test("an appointment year before the company existed is read as its first AGM", () => {
  const slip = client({ incorporatedOn: "2025-08-14", auditorAppointedAtAgmFy: 2024 });
  assert.deepEqual(adtYears(slip, 2026, 2031), [2026, 2031]);
});

test("the first year's ADT-1 is due even when a later appointment year was entered", () => {
  const later = client({ incorporatedOn: "2025-08-14", auditorAppointedAtAgmFy: 2027, auditorTermYears: 5 });
  assert.deepEqual(adtYears(later, 2026, 2032), [2026, 2027, 2032]);
});

test("years appointed: x years from an AGM means the ADT-1 falls due again x years on", () => {
  const young = client({ incorporatedOn: "2025-08-14" });
  const three = withAuditorTerm(young, 2026, 3);
  assert.equal(three.auditorTermYears, 3);
  assert.deepEqual(adtYears(three, 2026, 2033), [2026, 2029, 2032]);
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

test("ADT-1 details: SRN, date of filing and years drive the NA years and their reason", () => {
  const young = client({ incorporatedOn: "2025-08-14" });
  const saved = withAdt1Appointment(young, { srn: "ab1234567", filedOn: "2026-10-10" }, 3);
  assert.equal(saved.auditorAppointedAtAgmFy, 2026, "filed Oct 2026: the AGM for FY 2025-26");
  assert.equal(saved.auditorTermYears, 3);
  assert.deepEqual(adtYears(saved, 2026, 2033), [2026, 2029, 2032]);
  assert.equal(
    adtNaReason(saved, 2027),
    "Auditor appointed for 3 years at the AGM for FY 2025–26 (SRN AB1234567 filed dated 10/10/2026), next due 15/10/2029",
  );
  assert.equal(appointmentCovering(saved, 2028)?.srn, "AB1234567");
  assert.equal(appointmentCovering(saved, 2029), null, "the term has ended");
});

test("each NA year quotes the SRN of its own appointment, after a reappointment too", () => {
  const first = withAdt1Appointment(
    client({ incorporatedOn: "2025-08-14" }),
    { srn: "AB1111111", filedOn: "2026-10-10" },
    3,
  );
  const second = withAdt1Appointment(first, { srn: "CD2222222", filedOn: "2029-10-10" }, 2);
  assert.deepEqual(adtYears(second, 2029, 2033), [2029, 2031, 2033]);
  assert.match(
    adtNaReason(second, 2027),
    /appointed for 3 years .*FY 2025–26 \(SRN AB1111111 .*next due 15\/10\/2029$/,
  );
  assert.match(adtNaReason(second, 2030), /appointed for 2 years .*FY 2028–29 \(SRN CD2222222 /);
});

test("ADT-1 details: an earlier appointment is recorded without moving the running term back", () => {
  const current = withAdt1Appointment(client(), { srn: "CD2222222", filedOn: "2025-10-10" }, 5);
  const both = withAdt1Appointment(current, { srn: "AB1111111", filedOn: "2022-10-10" }, 3);
  assert.equal(both.auditorAppointedAtAgmFy, 2025);
  assert.equal(both.auditorTermYears, 5);
  assert.match(adtNaReason(both, 2023), /appointed for 3 years .*SRN AB1111111/);
});

test("correcting ADT-1 details to another year moves the record", () => {
  const first = withAdt1Appointment(
    client({ incorporatedOn: "2025-08-14" }),
    { srn: "AB1111111", filedOn: "2026-10-10" },
    5,
  );
  const moved = withAdt1Appointment(first, { srn: "AB1111111", filedOn: "2027-10-10" }, 5, 2026);
  assert.deepEqual(
    moved.filings?.map((f) => f.key),
    ["adt-1|2027|"],
  );
});

test("the NA reason names the appointment, the years and the next due date", () => {
  const young = client({ incorporatedOn: "2025-08-14" });
  assert.match(
    adtNaReason(young, 2027),
    /^Auditor taken as appointed for 5 years at the AGM for FY 2025–26, next due 15\/10\/2031$/,
  );
  const three = withAuditorTerm(young, 2026, 3);
  assert.match(
    adtNaReason(three, 2027),
    /^Auditor appointed for 3 years at the AGM for FY 2025–26, next due 15\/10\/2029$/,
  );
  assert.match(
    adtNaReason(three, 2030),
    /^Auditor appointed for 3 years at the AGM for FY 2028–29, next due 15\/10\/2032$/,
  );
  assert.match(
    adtNaReason(withAuditorTerm(young, 2028, 2), 2027),
    /^Auditor appointed later, at the AGM for FY 2027–28$/,
  );
});
