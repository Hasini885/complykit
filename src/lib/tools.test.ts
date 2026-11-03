import assert from "node:assert/strict";
import test from "node:test";

import {
  ADDITIONAL_FEE_SLABS,
  NORMAL_FEE_BANDS,
  calculateLateFee,
  describeSlabs,
  formatInr,
  normalFee,
  normalFeeBand,
  slabForDelay,
} from "@/lib/fees";
import { checkBoardMeetings } from "@/lib/board-meetings";
import { parseIsoDate } from "@/lib/dates";
import { forms } from "@/data/forms";

const d = (s: string) => parseIsoDate(s)!;

/* ---------------- normal fee ---------------- */

test("normal fee bands are contiguous and ordered", () => {
  for (let i = 1; i < NORMAL_FEE_BANDS.length; i++) {
    assert.equal(
      NORMAL_FEE_BANDS[i].from,
      NORMAL_FEE_BANDS[i - 1].to,
      "each band must start where the previous one ends",
    );
    assert.ok(NORMAL_FEE_BANDS[i].fee > NORMAL_FEE_BANDS[i - 1].fee, "fees increase");
  }
  assert.equal(NORMAL_FEE_BANDS[0].from, 0);
  assert.equal(NORMAL_FEE_BANDS[NORMAL_FEE_BANDS.length - 1].to, null, "top band is open-ended");
});

test("normal fee at the band boundaries", () => {
  assert.equal(normalFee(0), 200);
  assert.equal(normalFee(99_999), 200);
  assert.equal(normalFee(100_000), 300, "boundary is inclusive at the lower end");
  assert.equal(normalFee(499_999), 300);
  assert.equal(normalFee(500_000), 400);
  assert.equal(normalFee(2_499_999), 400);
  assert.equal(normalFee(2_500_000), 500);
  assert.equal(normalFee(9_999_999), 500);
  assert.equal(normalFee(10_000_000), 600);
  assert.equal(normalFee(1_000_000_000), 600, "top band has no ceiling");
});

test("negative capital is treated as zero rather than throwing", () => {
  assert.equal(normalFee(-5000), 200);
  assert.equal(normalFeeBand(-1).label, NORMAL_FEE_BANDS[0].label);
});

/* ---------------- additional fee slabs ---------------- */

test("slab boundaries", () => {
  assert.equal(slabForDelay(1).multiple, 2);
  assert.equal(slabForDelay(30).multiple, 2, "30 days is still the first slab");
  assert.equal(slabForDelay(31).multiple, 4);
  assert.equal(slabForDelay(60).multiple, 4);
  assert.equal(slabForDelay(61).multiple, 6);
  assert.equal(slabForDelay(90).multiple, 6);
  assert.equal(slabForDelay(91).multiple, 10);
  assert.equal(slabForDelay(180).multiple, 10);
  assert.equal(slabForDelay(181).multiple, 12);
  assert.equal(slabForDelay(10_000).multiple, 12);
});

test("slabs are ordered and end open", () => {
  for (let i = 1; i < ADDITIONAL_FEE_SLABS.length; i++) {
    assert.ok(ADDITIONAL_FEE_SLABS[i].multiple > ADDITIONAL_FEE_SLABS[i - 1].multiple);
  }
  assert.equal(ADDITIONAL_FEE_SLABS[ADDITIONAL_FEE_SLABS.length - 1].uptoDays, null);
});

/* ---------------- late fee ---------------- */

test("no delay means no additional fee", () => {
  const r = calculateLateFee({ kind: "per-day", normalFee: 600, delayDays: 0 });
  assert.equal(r.additionalFee, 0);
  assert.equal(r.total, 600);
  assert.match(r.basis, /no additional fee/i);
});

test("per-day fee is flat and uncapped", () => {
  const r = calculateLateFee({ kind: "per-day", normalFee: 600, delayDays: 30 });
  assert.equal(r.additionalFee, 3_000, "30 x 100");
  assert.equal(r.total, 3_600);

  const long = calculateLateFee({ kind: "per-day", normalFee: 600, delayDays: 400 });
  assert.equal(long.additionalFee, 40_000, "no cap applies");
});

test("slab fee is a multiple of the normal fee", () => {
  const r = calculateLateFee({ kind: "slab", normalFee: 600, delayDays: 45 });
  assert.equal(r.slab?.multiple, 4);
  assert.equal(r.additionalFee, 2_400);
  assert.equal(r.total, 3_000);
});

test("a negative delay cannot produce a negative fee", () => {
  const r = calculateLateFee({ kind: "slab", normalFee: 600, delayDays: -10 });
  assert.equal(r.delayDays, 0);
  assert.equal(r.additionalFee, 0);
});

test("rupees use Indian digit grouping", () => {
  assert.equal(formatInr(100), "₹100");
  assert.equal(formatInr(1_000), "₹1,000");
  assert.equal(formatInr(100_000), "₹1,00,000");
  assert.equal(formatInr(10_000_000), "₹1,00,00,000");
});

test("the forms library prose is generated from the fee table", () => {
  const slabForm = forms.find((f) => f.lateFee.kind === "slab")!;
  assert.equal(slabForm.lateFee.detail, describeSlabs(), "prose must not drift from the table");
  for (const slab of ADDITIONAL_FEE_SLABS) {
    assert.ok(
      describeSlabs().includes(`${slab.multiple}x`),
      `every multiple must appear in the prose: ${slab.multiple}x`,
    );
  }
});

/* ---------------- board meetings, s.173 ---------------- */

test("standard cadence: four well-spaced meetings pass", () => {
  const r = checkBoardMeetings(
    ["2025-05-14", "2025-08-08", "2025-11-27", "2026-02-19"].map(d),
    "standard",
  );
  assert.equal(r.compliant, true);
  assert.equal(r.countMet, true);
  assert.equal(r.gaps.length, 3);
  assert.ok(r.longestGap! <= 120);
});

test("standard cadence: a gap over 120 days is a breach", () => {
  const r = checkBoardMeetings(["2025-05-14", "2025-11-27", "2026-02-19"].map(d), "standard");
  assert.equal(r.compliant, false);
  assert.equal(r.shortBy, 1, "only three meetings");
  assert.ok(r.gaps.some((g) => g.breach));
  assert.ok(r.notes.some((n) => /120-day/.test(n)));
});

test("standard cadence: exactly 120 days is allowed, 121 is not", () => {
  const ok = checkBoardMeetings(["2026-01-01", "2026-05-01"].map(d), "standard");
  assert.equal(ok.gaps[0].days, 120);
  assert.equal(ok.gaps[0].breach, false, "120 days is within the limit");

  const bad = checkBoardMeetings(["2026-01-01", "2026-05-02"].map(d), "standard");
  assert.equal(bad.gaps[0].days, 121);
  assert.equal(bad.gaps[0].breach, true);
});

test("meetings entered out of order are sorted before checking", () => {
  const r = checkBoardMeetings(
    ["2026-02-19", "2025-05-14", "2025-11-27", "2025-08-08"].map(d),
    "standard",
  );
  assert.deepEqual(
    r.meetings.map((m) => m.getTime()),
    [...r.meetings].sort((a, b) => a.getTime() - b.getTime()).map((m) => m.getTime()),
  );
  assert.ok(r.gaps.every((g) => g.days > 0), "no negative gaps");
});

test("reduced cadence: two meetings 90+ days apart, one per half, pass", () => {
  const r = checkBoardMeetings(["2025-06-10", "2025-12-15"].map(d), "reduced");
  assert.equal(r.requiredCount, 2);
  assert.equal(r.compliant, true);
  assert.equal(r.halvesCovered, true);
});

test("reduced cadence: under 90 days apart is a breach", () => {
  const r = checkBoardMeetings(["2025-06-10", "2025-08-01"].map(d), "reduced");
  assert.equal(r.compliant, false);
  assert.ok(r.gaps[0].breach, "52 days is too close");
  assert.ok(r.notes.some((n) => /at least 90/.test(n)));
});

test("reduced cadence: both meetings in the same half is a breach", () => {
  const r = checkBoardMeetings(["2025-04-10", "2025-09-20"].map(d), "reduced");
  assert.equal(r.halvesCovered, false);
  assert.equal(r.compliant, false);
  assert.ok(r.notes.some((n) => /same half/.test(n)));
});

test("the two cadences disagree about the same dates, as they should", () => {
  const dates = ["2025-06-10", "2025-08-01"].map(d);
  // 52 days apart: fine under the standard rule, too close under the reduced one.
  assert.equal(checkBoardMeetings(dates, "standard").gapsCompliant, true);
  assert.equal(checkBoardMeetings(dates, "reduced").gapsCompliant, false);
});

test("an empty or single-meeting year reports the shortfall without crashing", () => {
  const none = checkBoardMeetings([], "standard");
  assert.equal(none.shortBy, 4);
  assert.equal(none.longestGap, null);
  assert.equal(none.compliant, false);

  const one = checkBoardMeetings([d("2025-06-10")], "standard");
  assert.equal(one.gaps.length, 0);
  assert.equal(one.shortBy, 3);
});
