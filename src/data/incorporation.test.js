import assert from "node:assert/strict";
import test from "node:test";

import {
  COMPARISON_ROWS,
  DOCUMENT_COLUMNS,
  ENTITY_TYPE_CARDS,
  FILLIP_STEPS,
  SPICE_PLUS_STEPS,
} from "@/data/incorporation";

test("five entity type cards, matching the comparison table one-for-one", () => {
  assert.equal(ENTITY_TYPE_CARDS.length, 5);
  assert.equal(COMPARISON_ROWS.length, 5);
  assert.deepEqual(ENTITY_TYPE_CARDS.map((c) => c.id).sort(), COMPARISON_ROWS.map((r) => r.entityId).sort());
});

test("exactly two entity types are marked popular: private and LLP", () => {
  const popular = ENTITY_TYPE_CARDS.filter((c) => c.popular).map((c) => c.id);
  assert.deepEqual(popular.sort(), ["llp", "private"]);
});

test("every entity card has two stat pills and a non-empty description", () => {
  for (const c of ENTITY_TYPE_CARDS) {
    assert.equal(c.statPills.length, 2, `${c.id} should have exactly two stat pills`);
    assert.ok(c.description.length > 0);
    assert.ok(c.title.length > 0);
  }
});

test("every comparison row has all six columns populated", () => {
  for (const r of COMPARISON_ROWS) {
    for (const key of ["entity", "members", "directors", "minCapital", "statutoryAudit", "bestFor"]) {
      assert.ok(r[key].length > 0, `${r.entityId} is missing ${key}`);
    }
  }
});

test("both registration processes have exactly nine steps", () => {
  assert.equal(SPICE_PLUS_STEPS.length, 9);
  assert.equal(FILLIP_STEPS.length, 9);
});

test("step ids are unique within each process, and every step is fully populated", () => {
  for (const steps of [SPICE_PLUS_STEPS, FILLIP_STEPS]) {
    assert.equal(new Set(steps.map((s) => s.id)).size, steps.length);
    for (const s of steps) {
      assert.ok(s.title.length > 0, `${s.id} has no title`);
      assert.ok(s.detail.length > 20, `${s.id}'s detail is suspiciously thin`);
    }
  }
});

test("the LLP process does not silently copy the company e-MOA/e-AOA step", () => {
  // These are genuinely different procedures -- the LLP Agreement is filed
  // separately in Form 3, not alongside the incorporation form itself.
  const companyStep4 = SPICE_PLUS_STEPS[3];
  const llpStep4 = FILLIP_STEPS[3];
  assert.notEqual(companyStep4.title, llpStep4.title);
  assert.match(llpStep4.detail, /Form 3/);
});

test("three document columns, each with at least four real items", () => {
  assert.equal(DOCUMENT_COLUMNS.length, 3);
  for (const col of DOCUMENT_COLUMNS) {
    assert.ok(col.items.length >= 4, `${col.id} has too few items`);
    assert.ok(col.title.length > 0);
    for (const item of col.items) assert.ok(item.length > 0);
  }
});

test("document column ids are unique", () => {
  assert.equal(new Set(DOCUMENT_COLUMNS.map((c) => c.id)).size, DOCUMENT_COLUMNS.length);
});
