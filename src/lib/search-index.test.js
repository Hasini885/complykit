import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync } from "node:fs";

import { forms } from "@/data/forms";
import { sections } from "@/data/sections";
import { dueDates } from "@/data/due-dates";
import { allNavItems } from "@/config/navigation";
import { SEARCH_GROUPS, getSearchItem, scoreItem, searchAll, searchIndex } from "@/lib/search-index";

const codes = (q) => searchAll(q).map((i) => i.badge ?? i.title);
const ids = (q) => searchAll(q).map((i) => i.id);

test("index covers every dataset exactly once", () => {
  const toolCount = searchIndex.filter((i) => i.group === "Tools").length;
  assert.equal(toolCount, 6, "the six calculators on /tools");
  assert.equal(searchIndex.length, forms.length + sections.length + dueDates.length + toolCount + allNavItems.length);
  assert.equal(new Set(searchIndex.map((i) => i.id)).size, searchIndex.length, "ids unique");
  for (const g of SEARCH_GROUPS) {
    assert.ok(
      searchIndex.some((i) => i.group === g),
      `group ${g} is empty`,
    );
  }
});

test("every entry has a title, href and haystack", () => {
  for (const i of searchIndex) {
    assert.ok(i.title.length > 0, `${i.id} has no title`);
    assert.ok(i.href.startsWith("/"), `${i.id} has a non-relative href: ${i.href}`);
    assert.ok(i.haystack.length > 10, `${i.id} has a thin haystack`);
  }
});

test("hrefs land on something specific, not just a list page", () => {
  for (const i of searchIndex.filter((x) => x.group === "Forms")) {
    assert.match(i.href, /^\/forms\?form=[a-z0-9-]+$/, `${i.id}: ${i.href}`);
  }
  for (const i of searchIndex.filter((x) => x.group === "Sections")) {
    assert.match(i.href, /^\/sections\?section=[a-z0-9-]+$/, `${i.id}: ${i.href}`);
  }
});

test("form and section deep links resolve to real records", () => {
  const formIds = new Set(forms.map((f) => f.id));
  const sectionIds = new Set(sections.map((s) => s.id));
  for (const i of searchIndex) {
    const form = /^\/forms\?form=(.+)$/.exec(i.href);
    if (form) assert.ok(formIds.has(form[1]), `dead form link: ${i.href}`);
    const sec = /^\/sections\?section=(.+)$/.exec(i.href);
    if (sec) assert.ok(sectionIds.has(sec[1]), `dead section link: ${i.href}`);
  }
});

test("getSearchItem round-trips by id", () => {
  for (const i of searchIndex.slice(0, 5)) {
    assert.equal(getSearchItem(i.id)?.id, i.id);
  }
  assert.equal(getSearchItem("nope:nope"), null);
});

test("empty query keeps everything, in index order", () => {
  assert.equal(searchAll("").length, searchIndex.length);
  assert.equal(searchAll("   ").length, searchIndex.length);
});

test("searches across all three datasets at once", () => {
  const results = searchAll("annual return");
  assert.ok(results.some((r) => r.group === "Forms"));
  assert.ok(results.some((r) => r.group === "Sections"));
  assert.ok(results.some((r) => r.group === "Due dates"));
});

test("ranking: an exact code match comes first", () => {
  assert.equal(codes("AOC-4")[0], "AOC-4");
  assert.equal(codes("aoc4")[0], "AOC-4", "hyphen-insensitive");
  assert.equal(codes("aoc 4")[0], "AOC-4");
  assert.equal(codes("MGT-7")[0], "MGT-7");
});

test("ranking: a section number finds the section", () => {
  assert.equal(codes("s.137")[0], "s.137");
  assert.ok(ids("137").includes("section:s-137"));
  assert.ok(ids("2(85)").includes("section:s-2-85"));
});

test("ranking: exact beats prefix beats title beats body", () => {
  const aoc4 = searchIndex.find((i) => i.badge === "AOC-4");
  const aoc4cfs = searchIndex.find((i) => i.badge === "AOC-4 CFS");
  assert.ok(
    scoreItem(aoc4, "aoc-4") > scoreItem(aoc4cfs, "aoc-4"),
    "the exact code must outrank the longer one that merely starts with it",
  );

  const s77 = searchIndex.find((i) => i.id === "section:s-77");
  assert.ok(scoreItem(s77, "s.77") > scoreItem(s77, "liquidator"), "badge beats body text");
});

test("ranking: non-matches score zero", () => {
  for (const i of searchIndex) assert.equal(scoreItem(i, "zzzznotathing"), 0);
  assert.deepEqual(searchAll("zzzznotathing"), []);
});

test("due dates are findable by entity type", () => {
  const llp = searchAll("Limited Liability Partnership");
  assert.ok(llp.some((r) => r.id === "due:llp-11"));
  assert.ok(llp.some((r) => r.id === "due:llp-8"));
});

test("pages are reachable by name", () => {
  assert.ok(ids("document generator").includes("page:/documents"));
  assert.ok(ids("consultant master").includes("page:/consultants"));
  assert.ok(ids("company master data").includes("page:/portfolio"));
});

test("every nav item points at a route that exists", () => {
  // Guards against a nav entry outliving its page, or arriving before it.
  // App routes live in the (app) route group, which is not part of the URL.
  const routes = new Set(
    readdirSync("src/app/(app)", { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => `/${e.name}`),
  );
  for (const item of allNavItems) {
    assert.ok(routes.has(item.href), `${item.title} points at missing route ${item.href}`);
  }
});

test("multiple terms narrow the result set", () => {
  const broad = searchAll("charge").length;
  const narrow = searchAll("charge satisfaction").length;
  assert.ok(narrow > 0 && narrow < broad);
});

test("tools are reachable by what they do, not just their name", () => {
  assert.ok(ids("late fee").includes("tool:late-fee"));
  assert.ok(ids("penalty").includes("tool:late-fee"));
  assert.ok(ids("120 days").includes("tool:board-meetings"));
  assert.ok(ids("board meeting gap").includes("tool:board-meetings"));
});

test("tool links point at a real anchor on the tools page", () => {
  for (const i of searchIndex.filter((x) => x.group === "Tools")) {
    assert.match(
      i.href,
      /^\/tools#(filing-fee|late-fee|dir3-kyc|penalty|deadline|board-meetings)$/,
      `${i.id}: ${i.href}`,
    );
  }
});
