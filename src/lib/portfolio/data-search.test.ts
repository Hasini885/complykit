import assert from "node:assert/strict";
import test from "node:test";

import { buildDataIndex, scoreDataItem } from "@/lib/portfolio/data-search";
import { newClient } from "@/lib/portfolio/clients";
import { newConsultant } from "@/lib/portfolio/consultants";
import { newDirector } from "@/lib/portfolio/directors";

const co = {
  ...newClient({
    name: "IGPL Groups Private Limited",
    cin: "U56290TS2025PTC208500",
    type: "private",
    incorporatedOn: "2025-04-10",
    registeredOffice: "Hyderabad",
    status: "active",
    mobile: "9876543210",
    email: "office@igpl.in",
  }),
  id: "igpl",
  filings: [{ key: "aoc-4|2026|", filedOn: "2026-10-20", srn: "AB1234567" }],
};
const harish = newDirector({
  name: "Harish Earu",
  din: "12345678",
  dinAllottedOn: "2020-01-01",
  lastKycFiledOn: "2026-06-01",
  lastKycSrn: "K7654321",
  directorships: [{ clientId: "igpl", role: "Director", appointedOn: "2025-04-10", din: "87654321" }],
});
const priya = { ...newConsultant({ name: "CA Priya Sharma", mobile: "9123456789" }), id: "priya" };
const index = buildDataIndex([{ ...co, consultantId: "priya" }], [harish], [priya]);

function top(query: string) {
  return index
    .map((item) => ({ item, score: scoreDataItem(item, query) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item);
}

test("an SRN finds the filing, named by form, year and company", () => {
  const [hit] = top("AB1234567");
  assert.equal(hit.group, "Filings");
  assert.equal(hit.title, "AOC-4 · FY 2025–26");
  assert.match(hit.subtitle, /IGPL Groups/);
  assert.deepEqual(hit.target, { kind: "company", clientId: "igpl" });
});

test("companies by name, CIN, mobile (typed with a space) or email", () => {
  for (const q of ["igpl", "U56290TS2025", "98765 43210", "office@igpl"]) {
    assert.equal(top(q)[0]?.id, "data:company:igpl", q);
  }
});

test("directors by either DIN, their KYC by its SRN, consultants by mobile", () => {
  assert.equal(top("87654321")[0]?.group, "Directors");
  assert.equal(top("12345678")[0]?.title, "HARISH EARU");
  assert.equal(top("K7654321")[0]?.title, "DIR-3 KYC · HARISH EARU");
  assert.equal(top("91234")[0]?.title, "CA Priya Sharma");
});

test("nothing of the user's shows before they type, and nonsense finds nothing", () => {
  assert.equal(top("").length, 0);
  assert.equal(top("zzqqxx").length, 0);
});
