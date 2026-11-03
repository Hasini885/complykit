import assert from "node:assert/strict";
import test from "node:test";

import { resolveClientYear } from "@/lib/portfolio/schedule";
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
