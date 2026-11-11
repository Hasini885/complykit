import assert from "node:assert/strict";
import test from "node:test";

import { parseIsoDate } from "@/lib/dates";
import { buildIcs } from "@/lib/ics";

const d = (s) => parseIsoDate(s);

test("produces a well-formed VCALENDAR wrapper", () => {
  const ics = buildIcs([]);
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(ics.trimEnd().endsWith("END:VCALENDAR"));
  assert.match(ics, /VERSION:2\.0/);
  assert.match(ics, /PRODID:-\/\/CA Compliance Tool/);
  assert.ok(ics.endsWith("\r\n"), "file ends with a trailing CRLF");
});

test("one event produces one well-formed VEVENT block", () => {
  const ics = buildIcs([{ uid: "test-1@complykit", title: "AOC-4 due", date: d("2026-10-30") }]);
  assert.match(ics, /BEGIN:VEVENT\r\n/);
  assert.match(ics, /UID:test-1@complykit\r\n/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261030\r\n/);
  assert.match(ics, /SUMMARY:AOC-4 due\r\n/);
  assert.match(ics, /END:VEVENT\r\n/);
  assert.match(ics, /DTSTAMP:\d{8}T\d{6}Z\r\n/);
});

test("multiple events each get their own block, in order", () => {
  const ics = buildIcs([
    { uid: "a", title: "First", date: d("2026-06-30") },
    { uid: "b", title: "Second", date: d("2026-09-30") },
  ]);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  const firstIndex = ics.indexOf("First");
  const secondIndex = ics.indexOf("Second");
  assert.ok(firstIndex > 0 && secondIndex > firstIndex);
});

test("special characters in text fields are escaped per RFC 5545", () => {
  const ics = buildIcs([
    {
      uid: "c",
      title: "AOC-4; Annual, Filing",
      date: d("2026-10-30"),
      description: "Line one\nLine two, with a comma; and a semicolon",
    },
  ]);
  assert.match(ics, /SUMMARY:AOC-4\\; Annual\\, Filing/);
  assert.match(ics, /DESCRIPTION:Line one\\nLine two\\, with a comma\\; and a semicolon/);
});

test("a description field is optional", () => {
  const ics = buildIcs([{ uid: "d", title: "No description", date: d("2026-06-30") }]);
  assert.ok(!ics.includes("DESCRIPTION:"));
});

test("long lines are folded at 75 octets with a continuation space", () => {
  const longTitle = "A".repeat(120);
  const ics = buildIcs([{ uid: "e", title: longTitle, date: d("2026-06-30") }]);
  const lines = ics.split("\r\n");
  for (const line of lines) {
    // A folded continuation starts with a space and is itself short; the rule
    // that matters is no *unfolded* line exceeds 75 octets.
    assert.ok(line.length <= 75, `line too long: ${line.length} chars`);
  }
  assert.ok(ics.includes("\r\n A"), "continuation lines start with a single space");
});

test("date-only VALUE=DATE, not a timestamp, so no timezone ambiguity", () => {
  const ics = buildIcs([{ uid: "f", title: "x", date: d("2026-01-05") }]);
  assert.match(ics, /DTSTART;VALUE=DATE:20260105/);
  assert.ok(!ics.includes("DTSTART:20260105T"), "must not emit a timed DTSTART");
});
