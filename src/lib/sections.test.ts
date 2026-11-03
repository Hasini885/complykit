import assert from "node:assert/strict";
import test from "node:test";

import { forms } from "@/data/forms";
import { SECTION_THEMES, sections, findSection, type ActSection } from "@/data/sections";
import {
  allFormsForSection,
  formsCitingSection,
  formsForSection,
  sectionsForForm,
  unwrittenSectionRefs,
} from "@/lib/cross-links";
import { matchesSection } from "@/lib/search";

const find = (n: string) => sections.find((s) => s.number === n) as ActSection;
const search = (q: string) => sections.filter((s) => matchesSection(s, q)).map((s) => s.number);

test("data: 15 sections, unique ids and numbers", () => {
  assert.equal(sections.length, 15);
  assert.equal(new Set(sections.map((s) => s.id)).size, sections.length);
  assert.equal(new Set(sections.map((s) => s.number)).size, sections.length);
});

test("data: every section is fully populated and on a known theme", () => {
  for (const s of sections) {
    for (const key of ["id", "number", "title", "summary", "officialUrl"] as const) {
      assert.ok(s[key] && s[key].length > 0, `Section ${s.number} is missing ${key}`);
    }
    assert.ok(s.keyPoints.length >= 3, `Section ${s.number} has too few key points`);
    assert.ok(s.tags.length > 0, `Section ${s.number} has no tags`);
    assert.ok(
      (SECTION_THEMES as readonly string[]).includes(s.theme),
      `Section ${s.number} has an unknown theme: ${s.theme}`,
    );
    assert.ok(
      s.officialUrl.startsWith("https://www.indiacode.nic.in/"),
      `Section ${s.number} does not cite India Code`,
    );
    if (s.penalty) {
      assert.ok(s.penalty.summary.length > 0 && s.penalty.detail.length > 0);
    }
  }
});

test("content: summaries are paraphrase, not statutory boilerplate", () => {
  // A crude guard against pasting the bare Act in later.
  const banned = [
    "shall be punishable with",
    "Provided that nothing contained in this sub-section",
    "hereinafter referred to as",
  ];
  for (const s of sections) {
    const body = [s.summary, ...s.keyPoints].join(" ");
    for (const phrase of banned) {
      assert.ok(
        !body.includes(phrase),
        `Section ${s.number} contains statute-like phrasing: "${phrase}"`,
      );
    }
  }
});

test("cross-link: every relatedFormId resolves to a real form", () => {
  const ids = new Set(forms.map((f) => f.id));
  for (const s of sections) {
    for (const id of s.relatedFormIds) {
      assert.ok(ids.has(id), `Section ${s.number} points at unknown form id "${id}"`);
    }
  }
});

test("cross-link: form sectionRefs resolve when a section is written up", () => {
  for (const f of forms) {
    for (const ref of f.sectionRefs) {
      const s = findSection(ref);
      if (s) assert.equal(s.number, ref);
    }
  }
  // AOC-4 cites 137, 134 and 129 — all three are written up.
  const aoc4 = forms.find((f) => f.code === "AOC-4")!;
  assert.deepEqual(
    sectionsForForm(aoc4).map((s) => s.number).sort(),
    ["129", "134", "137"],
  );
});

test("cross-link: the union picks up citations the hand-written list misses", () => {
  const s137 = find("137");
  const listed = formsForSection(s137).map((f) => f.code);
  const citing = formsCitingSection(s137).map((f) => f.code);
  const union = allFormsForSection(s137).map((f) => f.code);

  assert.ok(listed.includes("AOC-4"));
  assert.ok(citing.includes("AOC-4"));
  // Union is de-duplicated.
  assert.equal(new Set(union).size, union.length);
  assert.ok(union.length >= Math.max(listed.length, citing.length));
});

test("cross-link: section 92 reaches the annual return forms", () => {
  const codes = allFormsForSection(find("92")).map((f) => f.code);
  assert.ok(codes.includes("MGT-7"));
  assert.ok(codes.includes("MGT-7A"));
});

test("cross-link: every written section resolves to at least one form, except definitions", () => {
  for (const s of sections) {
    if (s.theme === "Definitions" && s.relatedFormIds.length === 0) continue;
    assert.ok(
      allFormsForSection(s).length > 0,
      `Section ${s.number} resolves to no forms at all`,
    );
  }
});

test("cross-link: unwritten refs are reported, not silently dropped", () => {
  const backlog = unwrittenSectionRefs();
  // These are cited by forms but deliberately not written up yet.
  assert.ok(Array.isArray(backlog));
  assert.ok(backlog.includes("153"), "DIR-3 KYC cites s.153, which has no entry yet");
  assert.ok(!backlog.includes("137"), "s.137 is written up, so it must not be in the backlog");
});

test("search: by bare number and by 'Section N'", () => {
  assert.ok(search("137").includes("137"));
  assert.ok(search("section 137").includes("137"));
  assert.ok(search("2(85)").includes("2(85)"));
});

test("search: by subject and by penalty text", () => {
  assert.ok(search("charge").includes("77"));
  assert.ok(search("disqualification").includes("164"));
  assert.ok(search("120 days").includes("173"));
  assert.ok(search("void against the liquidator").includes("77"));
});

test("search: multiple terms narrow", () => {
  const broad = search("director");
  const narrow = search("director disqualification");
  assert.ok(narrow.length < broad.length);
  assert.ok(narrow.includes("164"));
});

test("search: no match returns empty", () => {
  assert.deepEqual(search("zzzznotathing"), []);
});

test("definitional sections may carry no penalty", () => {
  assert.equal(find("2(85)").penalty, null);
  assert.ok(find("137").penalty !== null);
});
