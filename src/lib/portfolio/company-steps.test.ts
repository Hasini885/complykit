import assert from "node:assert/strict";
import test from "node:test";

import type { BoardEntry } from "@/lib/portfolio/board";
import type { ClientDraft } from "@/lib/portfolio/clients";
import { firstIncomplete, stepErrors, type StepInput } from "@/lib/portfolio/company-steps";

const asOf = new Date(2026, 10, 1);
const draft: ClientDraft = {
  name: "IGPL Groups Private Limited",
  cin: "U56290TS2025PTC208500",
  type: "private",
  incorporatedOn: "2025-04-10",
  registeredOffice: "Hyderabad",
  status: "active",
  mobile: "9876543210",
  email: "office@igpl.in",
  authorisedCapital: 1000000,
  paidUpCapital: 100000,
  auditorType: "subsequent",
  adt1Srn: "AB1234567",
  adt1FiledOn: "2025-10-10",
};
const entry = (key: string, name: string, din: string): BoardEntry => ({
  key,
  directorId: null,
  draft: { name, din, dinAllottedOn: "", directorships: [] },
  dirty: true,
  seat: { appointedOn: "2025-04-10", cessationOn: null },
});
const board = [entry("a", "Asha", "12345678"), entry("b", "Bala", "23456789")];
const base: StepInput = {
  draft,
  clients: [],
  board,
  authorisedKey: "a",
  pointOfContact: "authorised",
  reference: { mode: "none" },
  consultants: [],
  asOf,
};

test("a complete company passes every step", () => {
  assert.equal(firstIncomplete(base), null);
});

test("master data needs the capital", () => {
  const e = stepErrors("master", { ...base, draft: { ...draft, authorisedCapital: 0, paidUpCapital: 0 } });
  assert.ok(e.authorisedCapital && e.paidUpCapital);
});

test("directors: the minimum, and one of them chosen as authorised person", () => {
  assert.ok(stepErrors("directors", { ...base, board: board.slice(0, 1) }).board);
  assert.ok(stepErrors("directors", { ...base, authorisedKey: null }).authorised);
  assert.ok(stepErrors("directors", { ...base, authorisedKey: "gone" }).authorised);
});

test("a consultant as point of contact makes the consultant compulsory", () => {
  const byConsultant = { ...base, pointOfContact: "consultant" as const };
  assert.ok(stepErrors("consultant", byConsultant).ref_name);
  assert.deepEqual(stepErrors("consultant", { ...byConsultant, reference: { mode: "new", name: "CA Priya", mobile: "9123456789" } }), {});
  assert.deepEqual(stepErrors("consultant", base), {}, "optional when the authorised person is the point of contact");
  assert.equal(firstIncomplete(byConsultant)?.step, "consultant");
});

test("a first auditor needs the date of the Board meeting", () => {
  const first = { ...base, draft: { ...draft, auditorType: "first" as const, firstAuditorAppointedOn: null } };
  assert.ok(stepErrors("forms", first).firstAuditorAppointedOn);
  assert.equal(firstIncomplete(first)?.step, "forms");
});

test("a subsequent auditor needs the ADT-1 SRN and filing date", () => {
  const missing = { ...base, draft: { ...draft, adt1Srn: "", adt1FiledOn: null } };
  const e = stepErrors("forms", missing);
  assert.ok(e.adt1Srn && e.adt1FiledOn);
});
