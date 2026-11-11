/**
 * Run with: npm test
 * Plain node:test — no framework, no config.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { forms, FORM_CATEGORIES } from "@/data/forms";
import { matchesForm, matchesTerms, normalise } from "@/lib/search";

const find = (code) => forms.find((f) => f.code === code);
const search = (q) => forms.filter((f) => matchesForm(f, q)).map((f) => f.code);

test("data: 21 forms, all ids and codes unique", () => {
  assert.equal(forms.length, 21);
  assert.equal(new Set(forms.map((f) => f.id)).size, forms.length);
  assert.equal(new Set(forms.map((f) => f.code)).size, forms.length);
});

test("data: every form has all required fields populated", () => {
  for (const f of forms) {
    for (const key of ["id", "code", "name", "purpose", "section", "trigger", "deadline", "watchOut", "mcaUrl"]) {
      assert.ok(f[key] && f[key].length > 0, `${f.code} is missing ${key}`);
    }
    assert.ok(f.entity.length > 0, `${f.code} has no entity scope`);
    assert.ok(f.lateFee.summary && f.lateFee.detail, `${f.code} has an incomplete lateFee`);
    assert.ok(FORM_CATEGORIES.includes(f.category), `${f.code} has an unknown category: ${f.category}`);
    assert.ok(f.mcaUrl.startsWith("https://www.mca.gov.in/"), `${f.code} has a non-MCA url`);
  }
});

test("empty query returns everything", () => {
  assert.equal(search("").length, forms.length);
  assert.equal(search("   ").length, forms.length);
});

test("form code matches, with or without the hyphen", () => {
  assert.ok(search("AOC-4").includes("AOC-4"));
  assert.ok(search("aoc4").includes("AOC-4"));
  assert.ok(search("aoc 4").includes("AOC-4"));
  assert.ok(search("inc20a").includes("INC-20A"));
});

test("multiple terms narrow rather than widen (AND, not OR)", () => {
  const broad = search("annual");
  const narrow = search("annual return");
  assert.ok(narrow.length < broad.length, "second term should narrow the result set");
  assert.ok(narrow.includes("MGT-7"));
  // DPT-3 legitimately matches: its purpose opens "Annual return of deposits".
  assert.ok(narrow.includes("DPT-3"));
  assert.ok(!narrow.includes("CHG-1"), "a charge form is neither annual nor a return");
});

test("searches purpose and watch-out text, not just the code", () => {
  assert.ok(search("valuer").includes("PAS-3"), "should match text inside purpose");
  assert.ok(search("Udyam").includes("MSME-1"), "should match text inside watchOut");
});

test("searches by section number", () => {
  assert.ok(search("Section 137").includes("AOC-4"));
  assert.ok(search("90").includes("BEN-2"));
});

test("searches by tag", () => {
  const llp = search("LLP");
  assert.ok(llp.includes("LLP Form 11") && llp.includes("LLP Form 8"));
});

test("no match returns empty rather than everything", () => {
  assert.deepEqual(search("zzzznotathing"), []);
});

test("case and separator insensitivity", () => {
  assert.equal(normalise("AOC-4  ·  Rule 12"), "aoc 4 rule 12");
  assert.ok(matchesTerms("Section 139(1) · Rule 4(2)", "rule 4"));
});

test("entity scope is coherent", () => {
  assert.deepEqual(find("LLP Form 11").entity, ["llp"]);
  assert.deepEqual(find("AOC-4").entity, ["company"]);
  assert.ok(find("DIR-3 KYC").entity.includes("llp"), "DIN KYC covers DPIN holders too");
  assert.ok(find("CHG-1").entity.includes("company") && find("CHG-1").entity.includes("llp"));
});

test("late-fee kinds are the ones the UI colour-codes", () => {
  const known = new Set(["per-day", "slab", "ad-valorem", "flat", "none"]);
  for (const f of forms) assert.ok(known.has(f.lateFee.kind), `${f.code}: ${f.lateFee.kind}`);
  assert.equal(find("AOC-4").lateFee.kind, "per-day");
  assert.equal(find("MGT-7").lateFee.kind, "per-day");
  assert.equal(find("CHG-1").lateFee.kind, "ad-valorem");
  assert.equal(find("DIR-3 KYC").lateFee.kind, "flat");
});
