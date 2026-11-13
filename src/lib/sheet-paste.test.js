import assert from "node:assert/strict";
import test from "node:test";

import { pastedDate, pastedFiled } from "@/lib/sheet-paste";

test("pasted dates in Indian or ISO form", () => {
  assert.equal(pastedDate("13-11-2026"), "2026-11-13");
  assert.equal(pastedDate("3/4/2026"), "2026-04-03", "day first, as in India");
  assert.equal(pastedDate("2026-11-13"), "2026-11-13");
  assert.equal(pastedDate("next week"), "");
});

test("pasted GST status", () => {
  for (const v of ["Filed", "filed", " YES ", "done"]) assert.equal(pastedFiled(v), "filed", v);
  for (const v of ["Not Filed", "", "no", "pending"]) assert.equal(pastedFiled(v), "notfiled", v);
});
