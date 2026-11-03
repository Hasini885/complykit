import assert from "node:assert/strict";
import test from "node:test";

import {
  applyDirectorDraft,
  formatMobile,
  newDirector,
  normaliseMobile,
  validateDirector,
  type DirectorDraft,
} from "@/lib/portfolio/directors";
import { buildDuesRows } from "@/lib/portfolio/dues-table";
import { SEED_CLIENTS, SEED_DIRECTORS } from "@/lib/portfolio/sample-portfolio.fixture";

const base: DirectorDraft = {
  name: "Asha Rao",
  din: "12345678",
  dinAllottedOn: "2023-07-15",
  directorships: [],
};

test("mobile numbers are reduced to 10 digits, with +91, 91 or 0 dropped", () => {
  assert.equal(normaliseMobile("98765 43210"), "9876543210");
  assert.equal(normaliseMobile("+91-98765-43210"), "9876543210");
  assert.equal(normaliseMobile("919876543210"), "9876543210");
  assert.equal(normaliseMobile("09876543210"), "9876543210");
  assert.equal(normaliseMobile("12345 67890"), "", "must start 6-9");
  assert.equal(normaliseMobile("98765"), "");
  assert.equal(formatMobile("9876543210"), "98765 43210");
});

test("a director who is the authorised person needs no consultant", () => {
  assert.deepEqual(validateDirector({ ...base, isAuthorisedPerson: true }, []), []);
  const d = newDirector({ ...base, isAuthorisedPerson: true, consultantName: "X", consultantMobile: "9876543210" });
  assert.equal(d.isAuthorisedPerson, true);
  assert.equal(d.consultantName, undefined, "consultant details are not kept when the answer is Yes");
  assert.equal(d.consultantMobile, undefined);
});

test("answering No requires the consultant's name and a valid mobile", () => {
  const fields = validateDirector({ ...base, isAuthorisedPerson: false }, []).map((e) => e.field);
  assert.deepEqual(fields.sort(), ["consultantMobile", "consultantName"]);

  const bad = validateDirector(
    { ...base, isAuthorisedPerson: false, consultantName: "R K Consultants", consultantMobile: "12345" },
    [],
  );
  assert.deepEqual(bad.map((e) => e.field), ["consultantMobile"]);

  const ok = { ...base, isAuthorisedPerson: false, consultantName: " R K Consultants ", consultantMobile: "+91 98765 43210" };
  assert.deepEqual(validateDirector(ok, []), []);
  const d = newDirector(ok);
  assert.equal(d.consultantName, "R K Consultants");
  assert.equal(d.consultantMobile, "9876543210");
});

test("switching back to Yes clears the consultant", () => {
  const d = newDirector({ ...base, isAuthorisedPerson: false, consultantName: "R K", consultantMobile: "9876543210" });
  const updated = applyDirectorDraft(d, { ...base, isAuthorisedPerson: true });
  assert.equal(updated.isAuthorisedPerson, true);
  assert.equal(updated.consultantName, undefined);
  assert.equal(updated.consultantMobile, undefined);
});

test("older directors without an answer stay unanswered", () => {
  const d = newDirector(base);
  assert.equal(d.isAuthorisedPerson, undefined);
});

test("choosing a financial year lists every due of that year, and only that year", () => {
  const asOf = new Date(2026, 9, 27);
  const rows = buildDuesRows(SEED_CLIENTS, SEED_DIRECTORS, asOf, { filingsOnly: true, fyEndingYear: 2026 });
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => r.fy === "FY 2025–26"), "every row belongs to FY 2025-26");
  assert.equal(new Set(rows.map((r) => r.id)).size, rows.length, "row ids are unique");
  assert.ok(rows.some((r) => r.form === "AOC-4"), "the year's AOC-4 is listed");

  const rolling = buildDuesRows(SEED_CLIENTS, SEED_DIRECTORS, asOf, { filingsOnly: true });
  const rollingDefault = buildDuesRows(SEED_CLIENTS, SEED_DIRECTORS, asOf, { filingsOnly: true, fyEndingYear: null });
  assert.equal(rolling.length, rollingDefault.length, "no year keeps the rolling window");
});
