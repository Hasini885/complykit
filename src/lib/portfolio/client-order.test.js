import assert from "node:assert/strict";
import test from "node:test";

import { moveClientId, sortClients } from "@/lib/portfolio/clients";

const co = (id, name, sortOrder) => ({ id, name, ...(sortOrder === undefined ? {} : { sortOrder }) });

test("companies are alphabetical until the user orders them", () => {
  const list = sortClients([co("b", "BETA"), co("a", "ALPHA"), co("c", "GAMMA")]);
  assert.deepEqual(
    list.map((c) => c.id),
    ["a", "b", "c"],
  );
});

test("the user's order wins; companies never placed come after, alphabetically", () => {
  const list = sortClients([co("a", "ALPHA", 2), co("z", "ZETA", 0), co("n", "NEW B"), co("m", "NEW A"), co("b", "BETA", 1)]);
  assert.deepEqual(
    list.map((c) => c.id),
    ["z", "b", "a", "m", "n"],
  );
});

test("moving a company between two others", () => {
  const ids = ["a", "b", "c", "d"];
  assert.deepEqual(moveClientId(ids, "d", 1), ["a", "d", "b", "c"], "dropped above b");
  assert.deepEqual(moveClientId(ids, "a", 3), ["b", "c", "a", "d"], "dropped above d");
  assert.deepEqual(moveClientId(ids, "a", 4), ["b", "c", "d", "a"], "dropped at the end");
  assert.deepEqual(moveClientId(ids, "b", 1), ids, "dropped where it was");
  assert.deepEqual(moveClientId(ids, "x", 0), ids, "unknown id");
});
