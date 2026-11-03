import assert from "node:assert/strict";
import test from "node:test";

import {
  APPLICABILITY_CATEGORIES,
  auditCommitteeApplies,
  csrApplies,
  dematMandateApplies,
  emptyProfile,
  evaluateApplicability,
  independentDirectorsApply,
  internalAuditApplies,
  isSmallByFigures,
  mgt8Applies,
  secretarialAuditApplies,
  summarise,
  wholeTimeCsApplies,
  wholeTimeKmpApplies,
  womanDirectorApplies,
  xbrlApplies,
  type CompanyProfile,
} from "@/lib/applicability";

const CR = 10_000_000;

function profile(over: Partial<CompanyProfile> = {}): CompanyProfile {
  return { ...emptyProfile(), ...over };
}

/* ---------------- small company ---------------- */

test("small company: both limbs must hold, private only", () => {
  // Limits from 1 Dec 2025: ₹10 crore paid-up, ₹100 crore turnover.
  assert.equal(isSmallByFigures(profile({ paidUpCapital: 10 * CR, turnover: 100 * CR })), true, "at the limit is still small");
  assert.equal(isSmallByFigures(profile({ paidUpCapital: 10 * CR + 1, turnover: 100 * CR })), false);
  assert.equal(isSmallByFigures(profile({ paidUpCapital: 1 * CR, turnover: 101 * CR })), false);
  assert.equal(isSmallByFigures(profile({ paidUpCapital: 5 * CR, turnover: 60 * CR })), true, "small under the 2025 limits, not the old ones");
  assert.equal(isSmallByFigures(profile({ entityType: "public", paidUpCapital: 1 * CR, turnover: 1 * CR })), false, "public cannot be small");
});

/* ---------------- CSR, s.135 ---------------- */

test("CSR: any one of the three triggers is enough", () => {
  assert.equal(csrApplies(profile({ netWorth: 500 * CR })), true);
  assert.equal(csrApplies(profile({ netWorth: 500 * CR - 1 })), false);
  assert.equal(csrApplies(profile({ turnover: 1000 * CR })), true);
  assert.equal(csrApplies(profile({ netProfit: 5 * CR })), true);
  assert.equal(csrApplies(profile({ netProfit: 5 * CR - 1 })), false);
  assert.equal(csrApplies(profile({})), false, "nothing crossed");
});

/* ---------------- internal audit, s.138 / Rule 13 ---------------- */

test("internal audit: listed is always in", () => {
  assert.equal(internalAuditApplies(profile({ listed: true, entityType: "private" })), true);
});

test("internal audit: public thresholds", () => {
  assert.equal(internalAuditApplies(profile({ entityType: "public", paidUpCapital: 50 * CR })), true);
  assert.equal(internalAuditApplies(profile({ entityType: "public", turnover: 200 * CR })), true);
  assert.equal(internalAuditApplies(profile({ entityType: "public", borrowings: 100 * CR })), true);
  assert.equal(internalAuditApplies(profile({ entityType: "public", deposits: 25 * CR })), true);
  assert.equal(internalAuditApplies(profile({ entityType: "public" })), false);
});

test("internal audit: private thresholds are narrower than public (no paid-up or deposit limb)", () => {
  assert.equal(internalAuditApplies(profile({ entityType: "private", turnover: 200 * CR })), true);
  assert.equal(internalAuditApplies(profile({ entityType: "private", borrowings: 100 * CR })), true);
  assert.equal(internalAuditApplies(profile({ entityType: "private", paidUpCapital: 999 * CR })), false, "paid-up alone does not trigger it for a private company");
});

/* ---------------- secretarial audit, s.204 / Rule 9 ---------------- */

test("secretarial audit", () => {
  assert.equal(secretarialAuditApplies(profile({ listed: true })), true);
  assert.equal(secretarialAuditApplies(profile({ entityType: "public", paidUpCapital: 50 * CR })), true);
  assert.equal(secretarialAuditApplies(profile({ entityType: "public", turnover: 250 * CR })), true);
  assert.equal(secretarialAuditApplies(profile({ entityType: "private", borrowings: 100 * CR })), true, "borrowings limb reaches private companies too");
  assert.equal(secretarialAuditApplies(profile({ entityType: "private", borrowings: 100 * CR - 1 })), false);
});

/* ---------------- woman director ---------------- */

test("woman director", () => {
  assert.equal(womanDirectorApplies(profile({ listed: true, entityType: "private" })), true);
  assert.equal(womanDirectorApplies(profile({ entityType: "public", paidUpCapital: 100 * CR })), true);
  assert.equal(womanDirectorApplies(profile({ entityType: "private", paidUpCapital: 999 * CR })), false, "private company is never caught");
});

/* ---------------- independent directors / audit committee, Rule 4 & 6 ---------------- */

test("independent directors and the audit committee share the same threshold", () => {
  const p = profile({ entityType: "public", borrowings: 30 * CR, deposits: 21 * CR }); // sum 51 > 50
  assert.equal(independentDirectorsApply(p), true);
  assert.equal(auditCommitteeApplies(p), true);

  const under = profile({ entityType: "public", borrowings: 25 * CR, deposits: 25 * CR }); // sum exactly 50, not "in excess of"
  assert.equal(independentDirectorsApply(under), false, "the limb requires MORE than 50 cr, not 50 cr exactly");
});

test("independent directors: private companies are never caught", () => {
  assert.equal(independentDirectorsApply(profile({ entityType: "private", paidUpCapital: 999 * CR })), false);
});

/* ---------------- KMP, Rule 8 / 8A ---------------- */

test("whole-time KMP vs whole-time CS have different reach", () => {
  assert.equal(wholeTimeKmpApplies(profile({ entityType: "private", paidUpCapital: 10 * CR })), false, "Rule 8 does not reach a private company");
  assert.equal(wholeTimeCsApplies(profile({ entityType: "private", paidUpCapital: 10 * CR })), true, "Rule 8A does");
  assert.equal(wholeTimeKmpApplies(profile({ entityType: "public", paidUpCapital: 10 * CR })), true);
});

/* ---------------- XBRL / MGT-8 ---------------- */

test("XBRL and MGT-8 thresholds", () => {
  assert.equal(xbrlApplies(profile({ paidUpCapital: 5 * CR })), true);
  assert.equal(xbrlApplies(profile({ turnover: 100 * CR })), true);
  assert.equal(xbrlApplies(profile({})), false);

  assert.equal(mgt8Applies(profile({ paidUpCapital: 10 * CR })), true);
  assert.equal(mgt8Applies(profile({ turnover: 50 * CR })), true);
  assert.equal(mgt8Applies(profile({})), false);
});

/* ---------------- demat, Rule 9A/9B ---------------- */

test("demat mandate: unlisted public always, private only if not small, listed never (this rule)", () => {
  assert.equal(dematMandateApplies(profile({ entityType: "public", listed: false })), true);
  assert.equal(dematMandateApplies(profile({ entityType: "public", listed: true })), false, "listed sits under SEBI rules instead");
  assert.equal(
    dematMandateApplies(profile({ entityType: "private", paidUpCapital: 11 * CR, turnover: 101 * CR })),
    true,
    "not a small company (above ₹10 crore / ₹100 crore since 1 Dec 2025)",
  );
  assert.equal(
    dematMandateApplies(profile({ entityType: "private", paidUpCapital: 1 * CR, turnover: 1 * CR })),
    false,
    "small company is exempt",
  );
  assert.equal(dematMandateApplies(profile({ entityType: "opc" })), false);
});

/* ---------------- the full engine ---------------- */

test("an LLP profile short-circuits to a single explanatory item", () => {
  const results = evaluateApplicability(profile({ entityType: "llp" }));
  assert.equal(results.length, 1);
  assert.equal(results[0].status, "review");
});

test("a minimal private company: mostly universal items, nothing threshold-triggered", () => {
  const results = evaluateApplicability(profile({ entityType: "private" }));
  const s = summarise(results);
  assert.equal(s.applicable, 6, "the six universal items: statutory audit, AOC-4, annual return, DPT-3, board meetings, DIR-3 KYC");
  assert.equal(s.review, 1, "cost audit always sits in review");
  assert.ok(s.notApplicable > 0);
  assert.equal(s.applicable + s.review + s.notApplicable, results.length);
});

test("annual return switches between MGT-7A and MGT-7 with company size", () => {
  const small = evaluateApplicability(profile({ entityType: "private" })).find((r) => r.id === "annual-return")!;
  assert.match(small.title, /MGT-7A/);

  const large = evaluateApplicability(
    profile({ entityType: "private", paidUpCapital: 999 * CR, turnover: 999 * CR }),
  ).find((r) => r.id === "annual-return")!;
  assert.match(large.title, /MGT-7(?!A)/);
});

test("a large listed public company triggers nearly everything", () => {
  const results = evaluateApplicability(
    profile({
      entityType: "public",
      listed: true,
      paidUpCapital: 200 * CR,
      turnover: 2000 * CR,
      netWorth: 800 * CR,
      netProfit: 50 * CR,
      borrowings: 150 * CR,
    }),
  );
  const s = summarise(results);
  // Cost audit always sits in review. Not-applicable: MSME-1 (unflagged) plus demat and
  // PAS-6, which are correctly outside a LISTED company's scope under this MCA rule —
  // a listed company's securities are already in demat form under SEBI's own regime.
  assert.equal(s.review, 1);
  assert.equal(s.notApplicable, 3);
  assert.equal(results.find((r) => r.id === "msme-1")!.status, "not-applicable");
  assert.equal(results.find((r) => r.id === "demat")!.status, "not-applicable");
  assert.equal(results.find((r) => r.id === "pas-6")!.status, "not-applicable");
});

test("MSME-1 flips on the checkbox, not on any monetary figure", () => {
  const off = evaluateApplicability(profile({})).find((r) => r.id === "msme-1")!;
  assert.equal(off.status, "not-applicable");
  const on = evaluateApplicability(profile({ msmeDuesOver45Days: true })).find((r) => r.id === "msme-1")!;
  assert.equal(on.status, "applicable");
});

test("PAS-6 depends on both the demat mandate and the demat checkbox", () => {
  // Small private company: no demat mandate at all -> not applicable regardless of the checkbox.
  const noMandate = evaluateApplicability(
    profile({ entityType: "private", securitiesInDemat: true }),
  ).find((r) => r.id === "pas-6")!;
  assert.equal(noMandate.status, "not-applicable");

  // Unlisted public company: mandate applies. Checkbox unticked -> review, not a hard no.
  const mandateNoCheck = evaluateApplicability(
    profile({ entityType: "public", listed: false }),
  ).find((r) => r.id === "pas-6")!;
  assert.equal(mandateNoCheck.status, "review");

  const mandateAndCheck = evaluateApplicability(
    profile({ entityType: "public", listed: false, securitiesInDemat: true }),
  ).find((r) => r.id === "pas-6")!;
  assert.equal(mandateAndCheck.status, "applicable");
});

test("every result belongs to a published category and cites at least one reference", () => {
  const results = evaluateApplicability(profile({ entityType: "public", listed: true, paidUpCapital: 999 * CR }));
  for (const r of results) {
    assert.ok(
      (APPLICABILITY_CATEGORIES as string[]).includes(r.category),
      `${r.id} has an unlisted category: ${r.category}`,
    );
    assert.ok(r.refs.length > 0, `${r.id} has no reference pills`);
    assert.ok(r.reason.length > 0, `${r.id} has no reason text`);
  }
});

test("result ids are unique for any given profile", () => {
  const results = evaluateApplicability(profile({ entityType: "public", listed: true }));
  assert.equal(new Set(results.map((r) => r.id)).size, results.length);
});

test("figures at exactly zero never crash the engine", () => {
  assert.doesNotThrow(() => evaluateApplicability(emptyProfile()));
});
