import assert from "node:assert/strict";
import test from "node:test";

import { isoDate, makeDate } from "@/lib/dates";
import {
  CALC_FORMS,
  annualReturnCode,
  calculateFromDates,
  compareAll,
  dueDateFor,
  itrLateFee,
  mcaLateFee,
  monthsOrPart,
} from "@/lib/late-fee-calculator";

const d = (y, m, day) => makeDate(y, m, day);

test("due dates follow each form's rule", () => {
  const agm = d(2026, 9, 30);
  assert.equal(isoDate(dueDateFor({ formId: "adt-1", eventDate: agm })), "2026-10-15");
  assert.equal(isoDate(dueDateFor({ formId: "aoc-4", companyType: "private", eventDate: agm })), "2026-10-30");
  assert.equal(isoDate(dueDateFor({ formId: "mgt-7", companyType: "private", eventDate: agm })), "2026-11-29");
  assert.equal(isoDate(dueDateFor({ formId: "inc-20a", eventDate: d(2026, 1, 1) })), "2026-06-30");
  assert.equal(isoDate(dueDateFor({ formId: "dpt-3", fyEndingYear: 2026 })), "2026-06-30");
  assert.equal(isoDate(dueDateFor({ formId: "itr", fyEndingYear: 2026 })), "2026-10-31");
  assert.equal(isoDate(dueDateFor({ formId: "itr", fyEndingYear: 2026, transferPricing: true })), "2026-11-30");
});

test("an OPC's AOC-4 and MGT-7A run from the financial year", () => {
  assert.equal(isoDate(dueDateFor({ formId: "aoc-4", companyType: "opc", fyEndingYear: 2026 })), "2026-09-27");
  assert.equal(isoDate(dueDateFor({ formId: "mgt-7", companyType: "opc", fyEndingYear: 2026 })), "2026-11-29");
  assert.equal(annualReturnCode("opc"), "MGT-7A");
  assert.equal(annualReturnCode("small"), "MGT-7A");
  assert.equal(annualReturnCode("private"), "MGT-7");
});

test("AOC-4 and MGT-7 pay ₹100 a day on top of the normal fee", () => {
  const r = mcaLateFee({ formId: "aoc-4", capital: 100_000, delayDays: 45 });
  assert.equal(r.normalFee, 300);
  assert.equal(r.additionalFee, 4_500);
  assert.equal(r.total, 4_800);
});

test("DPT-3 and INC-20A use the multiples; ADT-1 pays 1× in its first fortnight", () => {
  assert.equal(mcaLateFee({ formId: "dpt-3", capital: 1_000_000, delayDays: 40 }).additionalFee, 1_600);
  assert.equal(mcaLateFee({ formId: "inc-20a", capital: 1_000_000, delayDays: 200 }).additionalFee, 4_800);
  assert.equal(mcaLateFee({ formId: "adt-1", capital: 1_000_000, delayDays: 10 }).additionalFee, 400);
  assert.equal(mcaLateFee({ formId: "adt-1", capital: 1_000_000, delayDays: 20 }).additionalFee, 800);
});

test("ITR: s.234F fee plus 1% a month or part on unpaid tax", () => {
  const r = itrLateFee({ delayDays: 40, taxUnpaid: 100_000, dueDate: d(2026, 10, 31), filedDate: d(2026, 12, 10) });
  assert.equal(r.additionalFee, 5_000);
  assert.equal(r.months, 2);
  assert.equal(r.interest, 2_000);
  assert.equal(r.total, 7_000);
  assert.equal(itrLateFee({ delayDays: 5, smallIncome: true }).total, 1_000);
  assert.equal(itrLateFee({ delayDays: 0 }).total, 0);
});

test("months or part of a month", () => {
  assert.equal(monthsOrPart(d(2026, 10, 31), d(2026, 11, 1)), 1);
  assert.equal(monthsOrPart(d(2026, 10, 31), d(2026, 11, 30)), 1);
  assert.equal(monthsOrPart(d(2026, 10, 31), d(2026, 12, 1)), 2);
  assert.equal(monthsOrPart(d(2026, 10, 31), d(2026, 10, 31)), 0);
});

test("the FY 2025-26 AOC-4 circular waives the fee up to 31 Dec 2026, not after", () => {
  const base = { formId: "aoc-4", companyType: "private", capital: 100_000, eventDate: d(2026, 9, 30) };
  const inside = calculateFromDates({ ...base, filedDate: d(2026, 12, 20) });
  assert.equal(inside.waived, true);
  assert.equal(inside.additionalFee, 0);
  const after = calculateFromDates({ ...base, filedDate: d(2027, 1, 9) });
  assert.equal(after.waived, false);
  assert.equal(after.delayDays, 71);
  assert.equal(after.additionalFee, 7_100);
});

test("the CBDT extension moves the FY 2025-26 ITR due date", () => {
  const r = calculateFromDates({ formId: "itr", fyEndingYear: 2026, filedDate: d(2026, 11, 20) });
  assert.equal(isoDate(r.due), "2026-11-21");
  assert.equal(r.total, 0);
  const late = calculateFromDates({ formId: "itr", fyEndingYear: 2026, filedDate: d(2026, 11, 25) });
  assert.equal(late.delayDays, 4);
  assert.equal(late.total, 5_000);
});

test("nothing is priced until the dates are in", () => {
  assert.equal(calculateFromDates({ formId: "adt-1", capital: 0, filedDate: d(2026, 1, 1) }), null);
});

test("compare prices every form", () => {
  const rows = compareAll({ capital: 100_000, delayDays: 0 });
  assert.equal(rows.length, CALC_FORMS.length);
  assert.equal(rows.filter((r) => r.form.group === "dashboard").length, 6);
  assert.equal(rows.find((r) => r.form.id === "itr").result.total, 0);
  assert.equal(rows.find((r) => r.form.id === "dpt-3").result.total, 300);
});

test("other ROC forms: due from the event, priced on the 2× to 12× table", () => {
  assert.equal(isoDate(dueDateFor({ formId: "dir-12", eventDate: d(2026, 4, 1) })), "2026-05-01");
  assert.equal(isoDate(dueDateFor({ formId: "pas-3", eventDate: d(2026, 4, 1) })), "2026-04-16");
  assert.equal(isoDate(dueDateFor({ formId: "aoc-5", eventDate: d(2026, 4, 1) })), "2026-04-08");
  assert.equal(isoDate(dueDateFor({ formId: "pas-6", eventDate: d(2026, 9, 30) })), "2026-11-29");
  const r = mcaLateFee({ formId: "mgt-14", capital: 1_000_000, delayDays: 100 });
  assert.equal(r.normalFee, 400);
  assert.equal(r.additionalFee, 4_000);
  assert.equal(r.total, 4_400);
});

test("MSME-1 is due at the end of the month after the half-year, with no fee", () => {
  assert.equal(isoDate(dueDateFor({ formId: "msme-1", eventDate: d(2026, 9, 30) })), "2026-10-31");
  assert.equal(isoDate(dueDateFor({ formId: "msme-1", eventDate: d(2027, 3, 31) })), "2027-04-30");
  assert.equal(mcaLateFee({ formId: "msme-1", capital: 100_000, delayDays: 50 }).total, 0);
});

test("DIR-3 KYC: nothing on time, ₹5,000 flat after 30 June", () => {
  assert.equal(isoDate(dueDateFor({ formId: "dir-3-kyc", fyEndingYear: 2026 })), "2026-06-30");
  assert.equal(mcaLateFee({ formId: "dir-3-kyc", capital: 0, delayDays: 0 }).total, 0);
  assert.equal(mcaLateFee({ formId: "dir-3-kyc", capital: 0, delayDays: 1 }).total, 5_000);
});

test("CHG-1: multiple plus capped ad valorem, lower for small companies, barred after 90 days late", () => {
  const base = { formId: "chg-1", capital: 1_000_000, amountSecured: 10_000_000 };
  const other = mcaLateFee({ ...base, delayDays: 20 });
  assert.equal(other.additionalFee, 2_400); // 6 × ₹400
  assert.equal(other.adValorem, 5_000); // 0.05% of ₹1 crore
  assert.equal(other.total, 7_800);
  const small = mcaLateFee({ ...base, companyType: "small", delayDays: 20 });
  assert.equal(small.additionalFee, 1_200); // 3 × ₹400
  assert.equal(small.adValorem, 2_500);
  const later = mcaLateFee({ ...base, delayDays: 60 });
  assert.equal(later.additionalFee, 4_800); // 12 × ₹400
  assert.equal(later.adValorem, 10_000);
  const capped = mcaLateFee({ ...base, amountSecured: 10_000_000_000, delayDays: 60 });
  assert.equal(capped.adValorem, 1_000_000);
  const barred = mcaLateFee({ ...base, delayDays: 91 });
  assert.equal(barred.barred, true);
  assert.equal(mcaLateFee({ ...base, delayDays: 0 }).total, 400);
});
