import assert from "node:assert/strict";
import test from "node:test";

import { PENALTY_VIOLATIONS, resolvePenalty } from "@/lib/penalties";

test("every violation resolves to a real section with a populated penalty", () => {
  for (const v of PENALTY_VIOLATIONS) {
    const resolved = resolvePenalty(v.id);
    assert.ok(resolved, `${v.id} did not resolve`);
    assert.equal(resolved.section.number, v.sectionNumber);
    assert.ok(resolved.section.penalty, `s.${v.sectionNumber} has no penalty data to show`);
    assert.ok(resolved.section.penalty.summary.length > 0);
    assert.ok(resolved.section.penalty.detail.length > 0);
  }
});

test("violation ids are unique", () => {
  assert.equal(new Set(PENALTY_VIOLATIONS.map((v) => v.id)).size, PENALTY_VIOLATIONS.length);
});

test("an unknown id resolves to null rather than throwing", () => {
  assert.equal(resolvePenalty("not-a-real-id"), null);
});
