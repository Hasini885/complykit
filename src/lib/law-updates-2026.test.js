import assert from "node:assert/strict";
import test from "node:test";

import { beyondRocItems } from "@/data/beyond-roc";
import { dematMandateApplies, emptyProfile, isSmallByFigures } from "@/lib/applicability";
import { extensionFor, resolveBeyondRocDue } from "@/lib/beyond-roc";
import { isoDate, parseIsoDate } from "@/lib/dates";
import { resolveClientYear } from "@/lib/portfolio/schedule";
/*
 * Law changes applied in the October 2026 review, each pinned to its source.
 */

const d = (s) => parseIsoDate(s);
const item = (id) => beyondRocItems.find((i) => i.id === id);
const CR = 1_00_00_000;

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

/* ---------------- CBDT Circular 07/2026 ---------------- */

test("company ITR for FY 2025-26 moves to 21 Nov 2026 (audit cases)", () => {
  const itr = resolveClientYear(client(), [], 2026).find((r) => r.source.id === "itr");
  assert.equal(isoDate(itr.due), "2026-11-21");
  assert.equal(isoDate(itr.statutoryDue), "2026-10-31");
  assert.match(itr.relief ?? "", /CBDT Circular No\. 07\/2026/);
  assert.doesNotMatch(itr.relief ?? "", /additional fee/, "an income-tax extension, not an MCA fee waiver");
});

test("the extension does not reach a non-audit LLP (31 Aug), and FY 2026-27 is unaffected", () => {
  const llp = resolveClientYear(client({ type: "llp", cin: "AAB-1234", turnover: 50_00_000 }), [], 2026).find(
    (r) => r.source.id === "itr",
  );
  assert.equal(isoDate(llp.due), "2026-08-31");
  const audited = resolveClientYear(client({ type: "llp", cin: "AAB-1234", turnover: 2 * CR }), [], 2026).find(
    (r) => r.source.id === "itr",
  );
  assert.equal(isoDate(audited.due), "2026-11-21");
  const next = resolveClientYear(client(), [], 2027).find((r) => r.source.id === "itr");
  assert.equal(isoDate(next.due), "2027-10-31");
});

test("a transfer-pricing case keeps 30 November, the later date", () => {
  const tp = resolveClientYear(client({ transferPricing: true }), [], 2026).find((r) => r.source.id === "itr");
  assert.equal(isoDate(tp.due), "2026-11-30");
});

test("Beyond-ROC: tax audit to 21 Oct 2026 and audit-case ITR to 21 Nov 2026, then back to normal", () => {
  const audit = item("tax-audit");
  assert.equal(isoDate(resolveBeyondRocDue(audit.rule, d("2026-10-01"))), "2026-10-21");
  assert.ok(extensionFor(audit.rule, d("2026-10-21")));
  assert.equal(isoDate(resolveBeyondRocDue(audit.rule, d("2026-10-22"))), "2027-09-30");

  const itr = item("itr-audit-cases");
  assert.equal(isoDate(resolveBeyondRocDue(itr.rule, d("2026-10-27"))), "2026-11-21");
  assert.equal(isoDate(resolveBeyondRocDue(itr.rule, d("2026-11-22"))), "2027-10-31");
});

/* ---------------- Income-tax Act, 2025 ---------------- */

test("TDS returns use the new form numbers; due dates unchanged", () => {
  for (const id of ["tds-return-q1", "tds-return-q2", "tds-return-q3", "tds-return-q4"]) {
    assert.match(item(id).formCode, /^Form 138\/140\/144/);
    assert.match(item(id).note ?? "", /formerly 24Q/);
  }
  assert.equal(isoDate(resolveBeyondRocDue(item("tds-return-q2").rule, d("2026-10-01"))), "2026-10-31");
  assert.match(item("advance-tax-q1").reference, /Section 408, Income-tax Act, 2025/);
});

/* ---------------- SEBI, RBI, labour ---------------- */

test("LODR Reg 27 governance report: 30 days, in the Integrated Filing", () => {
  assert.equal(isoDate(resolveBeyondRocDue(item("lodr-reg27").rule, d("2026-10-01"))), "2026-10-30");
});

test("ECB-2 is event-based from 16 Feb 2026, not a monthly return", () => {
  assert.equal(item("ecb-2").rule.kind, "event");
  assert.equal(item("ecb-2").frequency, "Event-driven");
});

test("PF and ESI cite the Code on Social Security, in force 21 Nov 2025", () => {
  assert.match(item("epf-payment").reference, /Code on Social Security, 2020/);
  assert.match(item("esi-payment").reference, /Code on Social Security, 2020/);
});

/* ---------------- Companies Act ---------------- */

test("small company limits from 1 Dec 2025, but Rule 9B demat tests the 31 March 2023 limits", () => {
  const p = { ...emptyProfile(), entityType: "private", paidUpCapital: 5 * CR, turnover: 60 * CR };
  assert.equal(isSmallByFigures(p), true, "small today (₹10 cr / ₹100 cr)");
  assert.equal(dematMandateApplies(p), true, "but not small on 31 March 2023 (₹4 cr / ₹40 cr), so Rule 9B binds");
  assert.equal(dematMandateApplies({ ...p, paidUpCapital: 1 * CR, turnover: 10 * CR }), false);
});
