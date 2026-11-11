import assert from "node:assert/strict";
import test from "node:test";

import { forms } from "@/data/forms";
import { findSection } from "@/data/sections";
import { relaxationFor, waivesFee } from "@/data/fee-relaxations";
import { calculateLateFee, llpNormalFeeBand, slabForDelay } from "@/lib/fees";
import { estimatePenalty, PENALTY_VIOLATIONS } from "@/lib/penalties";
import { resolveDueDates } from "@/lib/resolve-due-dates";

const form = (id) => forms.find((f) => f.id === id);
const rule = (id) => PENALTY_VIOLATIONS.find((v) => v.id === id).rule;

/* ---------------- Companies: 2022 additional-fee table ---------------- */

test("ADT-1 (s.139) pays 1x for the first 15 days, then 2x to 30", () => {
  assert.equal(form("adt-1").lateFee.calc, "s139-s157");
  assert.equal(slabForDelay(15, "s139-s157").multiple, 1);
  assert.equal(slabForDelay(16, "s139-s157").multiple, 2);
  assert.equal(slabForDelay(30, "s139-s157").multiple, 2);
  assert.equal(slabForDelay(31, "s139-s157").multiple, 4);
  assert.equal(slabForDelay(15).multiple, 2, "other forms pay 2x from day one");
});

test("a repeat late INC-22 / PAS-3 pays the higher additional fee", () => {
  const usual = calculateLateFee({ kind: "slab", normalFee: 400, delayDays: 45 });
  const repeat = calculateLateFee({ kind: "slab", normalFee: 400, delayDays: 45, higher: true });
  assert.equal(usual.additionalFee, 1_600, "4x");
  assert.equal(repeat.additionalFee, 2_400, "6x instead of 4x");
  assert.equal(calculateLateFee({ kind: "slab", normalFee: 400, delayDays: 200, higher: true }).multiple, 18);
});

test("SH-7 is left out of the general table rather than priced wrongly", () => {
  assert.equal(form("sh-7").lateFee.calc, "not-modelled");
});

test("AOC-4 and MGT-7 stay at ₹100 a day with no cap", () => {
  assert.equal(form("aoc-4").lateFee.kind, "per-day");
  assert.equal(calculateLateFee({ kind: "per-day", normalFee: 300, delayDays: 400 }).additionalFee, 40_000);
});

/* ---------------- LLP Form 8 / 11 ---------------- */

test("LLP forms are no longer a flat ₹100 a day", () => {
  for (const id of ["llp-form-8", "llp-form-11"]) {
    assert.equal(form(id).lateFee.calc, "llp");
    assert.doesNotMatch(form(id).lateFee.summary, /₹100 per day/);
  }
});

test("LLP normal fee follows the contribution", () => {
  assert.equal(llpNormalFeeBand(50_000).fee, 50);
  assert.equal(llpNormalFeeBand(20_00_000).fee, 200);
  assert.equal(llpNormalFeeBand(2_00_00_000).fee, 600);
});

test("LLP additional fee: small LLPs pay half the multiples; a daily amount after 360 days", () => {
  const small = (d) => calculateLateFee({ kind: "llp", normalFee: 200, delayDays: d, smallLlp: true });
  const other = (d) => calculateLateFee({ kind: "llp", normalFee: 200, delayDays: d, smallLlp: false });
  assert.equal(small(10).additionalFee, 200, "1x");
  assert.equal(small(45).additionalFee, 800, "4x");
  assert.equal(other(45).additionalFee, 1_600, "8x");
  assert.equal(small(360).additionalFee, 3_000, "15x");
  assert.equal(small(370).additionalFee, 3_000 + 10 * 10, "15x + ₹10 x 10 days");
  assert.equal(other(370).additionalFee, 6_000 + 10 * 20, "30x + ₹20 x 10 days");
});

/* ---------------- MCA General Circular 05/2026 ---------------- */

test("FY 2025-26 AOC-4 filed by 31 Dec 2026 pays no additional fee", () => {
  const r = relaxationFor("aoc-4", 2026);
  assert.ok(r);
  assert.ok(waivesFee(r, new Date(2026, 11, 31)));
  assert.ok(!waivesFee(r, new Date(2027, 0, 1)));
  const fee = calculateLateFee({ kind: "per-day", normalFee: 300, delayDays: 60, waivedBy: r.summary });
  assert.equal(fee.additionalFee, 0);
  assert.equal(fee.total, 300);
});

test("MGT-7 / 7A relief runs to 31 Jan 2027; other years and forms are untouched", () => {
  assert.equal(relaxationFor("mgt-7a", 2026)?.feeFreeUntil, "2027-01-31");
  assert.equal(relaxationFor("aoc-4", 2027), null);
  assert.equal(relaxationFor("adt-1", 2026), null);
});

test("the calendar marks the relieved dues, and only those", () => {
  const fy26 = resolveDueDates({ companyType: "private", fyEndingYear: 2026 });
  assert.match(fy26.find((r) => r.source.id === "aoc-4").relief ?? "", /31 Dec 2026/);
  assert.match(fy26.find((r) => r.source.id === "mgt-7").relief ?? "", /31 Jan 2027/);
  assert.match(fy26.find((r) => r.source.id === "dpt-3").relief ?? "", /31 Jul 2026.*General Circular No\. 02\/2026/);
  assert.equal(fy26.find((r) => r.source.id === "adt-1").relief, null);
  const fy27 = resolveDueDates({ companyType: "private", fyEndingYear: 2027 });
  assert.equal(fy27.find((r) => r.source.id === "aoc-4").relief, null);
});

/* ---------------- Penalties ---------------- */

test("s.137: ₹10,000 + ₹100 a day after the first, capped at ₹2 lakh / ₹50,000", () => {
  const e = estimatePenalty(rule("late-aoc4"), 100, false);
  assert.equal(e.type, "penalty");
  if (e.type !== "penalty") return;
  assert.equal(e.company.payable, 10_000 + 100 * 99);
  assert.equal(e.officer.payable, 10_000 + 100 * 99);
  const long = estimatePenalty(rule("late-aoc4"), 5_000, false);
  if (long.type !== "penalty") return;
  assert.equal(long.company.payable, 2_00_000);
  assert.equal(long.officer.payable, 50_000);
});

test("s.446B halves a penalty for a small company, within its caps", () => {
  const e = estimatePenalty(rule("board-report-default"), 0, true);
  if (e.type !== "penalty") return assert.fail();
  assert.equal(e.company.full, 3_00_000);
  assert.equal(e.company.payable, 1_50_000);
  assert.equal(e.officer.payable, 25_000);
  const sbo = estimatePenalty(rule("sbo-default"), 10_000, true);
  if (sbo.type !== "penalty") return assert.fail();
  assert.equal(sbo.company.payable, 2_00_000, "half of ₹5 lakh is ₹2.5 lakh, capped at ₹2 lakh");
});

test("daily-from-day-one penalties (s.12) and flat ones (s.173) compute correctly", () => {
  const ro = estimatePenalty(rule("registered-office-default"), 30, false);
  if (ro.type !== "penalty") return assert.fail();
  assert.equal(ro.company.payable, 30_000);
  const bm = estimatePenalty(rule("board-meeting-default"), 500, false);
  if (bm.type !== "penalty") return assert.fail();
  assert.equal(bm.company, null);
  assert.equal(bm.officer.payable, 25_000);
});

test("fines (s.99, s.147) show a range and are not halved", () => {
  const agm = estimatePenalty(rule("agm-not-held"), 10, true);
  assert.equal(agm.type, "fine");
  if (agm.type !== "fine") return;
  assert.deepEqual(agm.company, { min: 0, max: 1_00_000 + 5_000 * 10 });
  const aud = estimatePenalty(rule("auditor-default"), 0, true);
  if (aud.type !== "fine") return assert.fail();
  assert.deepEqual(aud.company, { min: 25_000, max: 5_00_000 });
});

test("every penalty cap appears in the section reference text, so the two cannot disagree", () => {
  const inr = (n) => new Intl.NumberFormat("en-IN").format(n);
  for (const v of PENALTY_VIOLATIONS) {
    const text = findSection(v.sectionNumber).penalty.detail;
    const amounts =
      v.rule.type === "penalty"
        ? [v.rule.company, v.rule.officer].flatMap((l) => (l ? [l.cap ?? l.base] : []))
        : [v.rule.company, v.rule.officer].flatMap((p) => (p ? [p.max] : []));
    for (const a of amounts.filter((n) => n > 0)) {
      assert.ok(text.includes(`₹${inr(a)}`), `s.${v.sectionNumber}: ₹${inr(a)} missing from the section text`);
    }
  }
});
