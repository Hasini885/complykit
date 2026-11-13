import assert from "node:assert/strict";
import test from "node:test";

import { cellValue, deadlinesByDay, feeValue, isOverdue, newTask, taskSummary, withField } from "@/lib/tasks/tasks";

const T = "2026-11-13";

test("entering work stamps the creation date once", () => {
  let t = withField(newTask("1"), "work", "GST registration", T);
  assert.equal(t.created, T);
  t = withField(t, "work", "GST registration and LUT", "2026-11-20");
  assert.equal(t.created, T, "not moved by later edits");
  assert.equal(withField(newTask("2"), "work", "   ", T).created, "", "blank work does not count");
});

test("finishing stamps the completion date; back to pending clears it", () => {
  let t = withField(newTask("1"), "status", "Finished", T);
  assert.equal(t.completed, T);
  t = withField(t, "status", "Pending", T);
  assert.equal(t.completed, "");
});

test("overdue: pending with a deadline before today", () => {
  assert.equal(isOverdue({ ...newTask("1"), deadline: "2026-11-12" }, T), true);
  assert.equal(isOverdue({ ...newTask("1"), deadline: T }, T), false, "due today is not overdue");
  assert.equal(isOverdue({ ...newTask("1"), deadline: "2026-11-01", status: "Finished" }, T), false);
});

test("summary, fees and the calendar", () => {
  const rows = [
    { ...newTask("1"), deadline: "2026-11-01", fee: "1,500" },
    { ...newTask("2"), deadline: "2026-11-01", status: "Finished", fee: "2000" },
    { ...newTask("3"), deadline: "2026-11-30", fee: "abc" },
  ];
  assert.deepEqual(taskSummary(rows, T), { total: 3, pending: 2, clientPending: 0, finished: 1, overdue: 1 });
  assert.equal(
    rows.reduce((n, r) => n + feeValue(r.fee), 0),
    3500,
  );
  assert.deepEqual(deadlinesByDay(rows), {
    "2026-11-01": { pending: 1, finished: 1 },
    "2026-11-30": { pending: 1, finished: 0 },
  });
  assert.equal(cellValue(rows[0], "deadline"), "01-11-2026", "dates read DD-MM-YYYY");
});
