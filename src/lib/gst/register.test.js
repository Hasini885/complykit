import assert from "node:assert/strict";
import test from "node:test";

import {
  EMPTY_GST,
  GSTIN_RE,
  activeIn,
  fromBackup,
  monthSummary,
  newGstClient,
  shiftMonth,
  statusOf,
  withStatus,
} from "@/lib/gst/register";

const client = (id, extra = {}) => ({ ...newGstClient(id), name: id.toUpperCase(), ...extra });

test("GSTIN format", () => {
  assert.ok(GSTIN_RE.test("36ABCDE1234F1Z5"));
  assert.ok(!GSTIN_RE.test("36ABCDE1234F1X5"), "14th character must be Z");
  assert.ok(!GSTIN_RE.test("36abcde1234f1z5"), "upper case only");
});

test("a client is listed from its registration month to its deactivation month", () => {
  const c = client("a", { reg: "2026-04-15", deact: "2026-09-10" });
  assert.equal(activeIn(c, "2026-03"), false);
  assert.equal(activeIn(c, "2026-04"), true);
  assert.equal(activeIn(c, "2026-09"), true);
  assert.equal(activeIn(c, "2026-10"), false);
  assert.equal(activeIn(client("b"), "2020-01"), true, "no dates: always listed");
});

test("status per month: both returns must be filed to count as filed", () => {
  let data = { ...EMPTY_GST, clients: [client("a"), client("b"), client("c", { deact: "2026-01-31" })] };
  data = withStatus(data, "2026-11", "a", "g1", "filed");
  data = withStatus(data, "2026-11", "a", "g3b", "filed");
  data = withStatus(data, "2026-11", "b", "g1", "filed");
  assert.deepEqual(monthSummary(data, "2026-11"), { total: 2, filed: 1, notFiled: 1 });
  assert.equal(statusOf(data.status, "2026-12", "a").g1, "notfiled", "other months untouched");
  data = withStatus(data, "2026-11", "b", "remarks", "Awaiting sales data");
  assert.equal(statusOf(data.status, "2026-11", "b").g1, "filed", "remarks keep the status");
});

test("older single-value status counts for both returns", () => {
  assert.deepEqual(statusOf({ "2026-10": { a: "filed" } }, "2026-10", "a"), {
    g1: "filed",
    g3b: "filed",
    remarks: "",
    assigned: "",
  });
});

test("an extension backup imports, passwords included", () => {
  const backup = {
    clients: [{ id: "x1", name: "ABC Traders", gstin: "36abcde1234f1z5 ", user: "abc", pass: "secret" }],
    status: { "2026-10": { x1: { g1: "filed", g3b: "notfiled", remarks: "ok" }, gone: "filed" }, bad: {} },
  };
  const out = fromBackup(backup, () => "new");
  assert.equal(out.clients.length, 1);
  assert.equal(out.clients[0].gstin, "36ABCDE1234F1Z5");
  assert.equal(out.clients[0].pass, "secret");
  assert.equal(out.clients[0].user, "abc");
  assert.deepEqual(Object.keys(out.status), ["2026-10"]);
  assert.deepEqual(Object.keys(out.status["2026-10"]), ["x1"], "status for unknown clients dropped");
});

test("months shift across years", () => {
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
});
