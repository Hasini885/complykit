import assert from "node:assert/strict";
import test from "node:test";

import { checklists } from "@/data/checklists";
import { setChecklistItem, clearChecklist, useChecklistState } from "@/lib/checklist-store";

const EXPECTED_COUNTS: Record<string, number> = {
  "private-annual": 14,
  "post-incorporation": 11,
  "opc-annual": 8,
  "llp-annual": 8,
  "section8-annual": 8,
  "event-based": 8,
};

test("there are exactly six checklists, matching the specified ids", () => {
  assert.equal(checklists.length, 6);
  assert.deepEqual(
    checklists.map((c) => c.id).sort(),
    Object.keys(EXPECTED_COUNTS).sort(),
  );
});

test("each checklist has exactly the specified item count", () => {
  for (const c of checklists) {
    assert.equal(c.items.length, EXPECTED_COUNTS[c.id], `${c.id} has the wrong item count`);
  }
});

test("item ids are unique within each checklist", () => {
  for (const c of checklists) {
    assert.equal(new Set(c.items.map((i) => i.id)).size, c.items.length, `${c.id} has duplicate item ids`);
  }
});

test("checklist ids are globally unique", () => {
  assert.equal(new Set(checklists.map((c) => c.id)).size, checklists.length);
});

test("every checklist and item is fully populated", () => {
  for (const c of checklists) {
    assert.ok(c.title.length > 0, `${c.id} has no title`);
    assert.ok(c.description.length > 0, `${c.id} has no description`);
    assert.ok(c.pill.length > 0, `${c.id} has no pill label`);
    assert.ok(c.icon, `${c.id} has no icon`);
    for (const item of c.items) {
      assert.ok(item.text.length > 0, `${c.id}/${item.id} has no text`);
      assert.ok(item.detail.length > 0, `${c.id}/${item.id} has no detail`);
    }
  }
});

/* ---------------- store: pure logic, no DOM required ---------------- */

test("useChecklistState is the exported hook — it exists and is a function", () => {
  // Actual read/write behaviour needs a browser (localStorage) and a React
  // render tree, neither available under plain node:test — exercised via the
  // production build and the manual SSR/CSR checks instead. This just guards
  // the module's shape.
  assert.equal(typeof useChecklistState, "function");
  assert.equal(typeof setChecklistItem, "function");
  assert.equal(typeof clearChecklist, "function");
});
