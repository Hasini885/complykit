import assert from "node:assert/strict";
import test from "node:test";

import {
  TRIAL_DAYS,
  accessFor,
  addMonths,
  checkPrice,
  extendPaidUntil,
  readConfig,
  readUserBilling,
  trialEnd,
  withPayment,
} from "@/lib/billing";

const at = (y, m, d) => new Date(y, m - 1, d).getTime();
const DAY = 86_400_000;

test("older accounts get their free month from the launch day", () => {
  assert.equal(trialEnd(at(2026, 1, 5)), at(2026, 11, 11) + TRIAL_DAYS * DAY);
});

test("new accounts get a month from sign-up", () => {
  assert.equal(trialEnd(at(2026, 11, 20)), at(2026, 11, 20) + TRIAL_DAYS * DAY);
});

const base = { createdAt: at(2026, 11, 20), billing: null, isAdmin: false, enforced: true };

test("in the trial: allowed, with days left", () => {
  const a = accessFor({ ...base, now: at(2026, 11, 25) });
  assert.equal(a.state, "trial");
  assert.ok(a.allowed);
  assert.equal(a.daysLeft, 25);
});

test("after the trial without paying: blocked", () => {
  const a = accessFor({ ...base, now: at(2026, 12, 25) });
  assert.deepEqual([a.state, a.allowed], ["expired", false]);
});

test("nothing is blocked until a price and Razorpay are set", () => {
  const a = accessFor({ ...base, enforced: false, now: at(2027, 3, 1) });
  assert.deepEqual([a.state, a.allowed], ["free", true]);
});

test("admins are never blocked", () => {
  assert.equal(accessFor({ ...base, isAdmin: true, now: at(2030, 1, 1) }).allowed, true);
});

test("paid up: allowed until the paid-up date", () => {
  const billing = { paidUntil: at(2027, 12, 20), payments: [] };
  assert.equal(accessFor({ ...base, billing, now: at(2027, 6, 1) }).state, "paid");
  assert.equal(accessFor({ ...base, billing, now: at(2027, 12, 21) }).state, "expired");
});

test("a payment adds a year from the end of the trial, today, or the current paid-up date", () => {
  const created = at(2026, 11, 20);
  // Paid during the trial: the year starts when the trial ends.
  assert.equal(extendPaidUntil(null, created, at(2026, 11, 25)), addMonths(trialEnd(created), 12));
  // Paid after lapsing: a year from today.
  assert.equal(extendPaidUntil(at(2027, 1, 1), created, at(2028, 2, 1)), at(2029, 2, 1));
  // Renewed early: a year on from the current paid-up date.
  assert.equal(extendPaidUntil(at(2027, 12, 19), created, at(2027, 12, 1)), at(2028, 12, 19));
});

test("addMonths keeps the day, or the month's last day", () => {
  assert.equal(addMonths(at(2027, 1, 31), 1), at(2027, 2, 28));
  assert.equal(addMonths(at(2028, 2, 29), 12), at(2029, 2, 28));
});

test("the same payment is counted once", () => {
  const p = { paymentId: "pay_1", orderId: "order_1", amount: 999 };
  const first = withPayment({ paidUntil: null, payments: [] }, p, at(2026, 1, 1), at(2027, 1, 1));
  assert.ok(first.added);
  const again = withPayment(first.billing, p, at(2026, 1, 1), at(2027, 1, 2));
  assert.equal(again.added, false);
  assert.equal(again.billing, first.billing);
});

test("stored values are read defensively", () => {
  assert.deepEqual(readUserBilling({ billing: { paidUntil: "x", payments: [1, null] } }), {
    paidUntil: null,
    payments: [],
  });
  assert.deepEqual(readConfig({ yearlyPrice: -5 }), { yearlyPrice: 0, updatedAt: 0 });
  assert.equal(checkPrice(4999), null);
  assert.ok(checkPrice(10.5));
  assert.ok(checkPrice(0));
});
