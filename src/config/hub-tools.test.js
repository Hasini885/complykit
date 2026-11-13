import assert from "node:assert/strict";
import { test } from "node:test";

import { HUB_ORDER, TOOLS, hubTools } from "@/config/navigation";

// The dashboard and the home page both list hubTools(), so every tool added
// to TOOLS must come out of it exactly once.
test("hubTools lists every tool once, in dashboard order", () => {
  const ids = hubTools().map((t) => t.id);
  assert.deepEqual([...ids].sort(), TOOLS.map((t) => t.id).sort());
  assert.deepEqual(ids.slice(0, HUB_ORDER.length), HUB_ORDER);
});

test("every tool has what the home page shows", () => {
  for (const t of TOOLS) {
    assert.ok(t.title && t.href && t.icon && t.description, t.id);
    for (const i of t.items) assert.ok(i.title && i.href && i.icon, `${t.id} ${i.href}`);
  }
});
