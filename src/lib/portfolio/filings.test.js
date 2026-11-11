import assert from "node:assert/strict";
import test from "node:test";

import { parseIsoDate } from "@/lib/dates";
import {
  cleanFilings,
  filingKey,
  kycDirectorId,
  validateFiling,
  withFiling,
  withoutFiling,
} from "@/lib/portfolio/filings";
import { checkSrn, normaliseSrn } from "@/lib/portfolio/srn";
import { computeClientHealth } from "@/lib/portfolio/health";
import { resolveClientYear } from "@/lib/portfolio/schedule";
import { buildPortfolioReport } from "@/lib/portfolio/report";
import { applyDirectorDraft } from "@/lib/portfolio/directors";
import { normalise } from "@/lib/portfolio/repository";
const d = (s) => parseIsoDate(s);

function client(over = {}) {
  return {
    id: "c1",
    name: "Test Co",
    cin: "U00000KA2019PTC000000",
    type: "private",
    incorporatedOn: "2019-07-18",
    registeredOffice: "x",
    status: "active",
    msmeDuesOver45Days: true,
    createdAt: "",
    updatedAt: "",
    ...over,
  };
}

const row = (c, fy, id, qualifier) =>
  resolveClientYear(c, [], fy).find(
    (r) => r.source.id === id && (qualifier === undefined || r.qualifier === qualifier),
  );

/* ---------------- SRN ---------------- */

test("SRNs are normalised to uppercase without spaces or dashes", () => {
  assert.equal(normaliseSrn(" ab 123-4567 "), "AB1234567");
});

test("real SRN shapes pass; obvious mistakes do not", () => {
  for (const ok of ["AB1234567", "G12345678", "t98765432", "AA0012345"]) {
    assert.equal(checkSrn(ok), null, ok);
  }
  assert.match(checkSrn("AB12#456"), /letters and numbers/);
  assert.match(checkSrn("A12"), /length/);
  assert.match(checkSrn("ABCDEFGH"), /numbers/);
  assert.equal(checkSrn(""), null, "empty is a 'required' question, not a format one");
});

test("an e-form needs an SRN; holding the AGM does not; the date cannot be in the future", () => {
  const asOf = d("2026-10-27");
  assert.ok(validateFiling({ filedOn: "2026-10-20", srn: "" }, { srnRequired: true, asOf }).srn);
  assert.deepEqual(validateFiling({ filedOn: "2026-10-20", srn: "" }, { srnRequired: false, asOf }), {});
  assert.ok(validateFiling({ filedOn: "2026-11-01", srn: "AB1234567" }, { srnRequired: true, asOf }).filedOn);
  assert.ok(validateFiling({ filedOn: "", srn: "AB1234567" }, { srnRequired: true, asOf }).filedOn);
});

/* ---------------- recording a filing ---------------- */

test("a recorded filing shows on its row with the SRN, and only on that row", () => {
  const before = client();
  const aoc = row(before, 2026, "aoc-4");
  const after = withFiling(before, filingKey(aoc), { filedOn: "2026-10-20", srn: "ab1234567" });

  const filed = row(after, 2026, "aoc-4");
  assert.equal(filed.srn, "AB1234567");
  assert.equal(filed.filedOn?.getTime(), d("2026-10-20").getTime());

  assert.equal(row(after, 2027, "aoc-4").filedOn ?? null, null, "next year's AOC-4 is still open");
  assert.equal(row(after, 2026, "mgt-7").filedOn ?? null, null, "other forms are untouched");
});

test("the filing stays with its row when the AGM date moves the due date", () => {
  const c = withFiling(client(), filingKey(row(client(), 2026, "aoc-4")), {
    filedOn: "2026-09-25",
    srn: "AB1234567",
  });
  const withAgm = { ...c, lastAgmOn: "2026-08-20" };
  const aoc = row(withAgm, 2026, "aoc-4");
  assert.equal(aoc.statutoryDue.getTime(), d("2026-09-19").getTime(), "statutory due date moved");
  assert.equal(aoc.srn, "AB1234567", "filing still attached");
});

test("each half of a half-yearly return is filed separately", () => {
  const c = client();
  const first = row(c, 2027, "msme-1", "April to September");
  const marked = withFiling(c, filingKey(first), { filedOn: "2026-10-25", srn: "AB1111111" });
  assert.equal(row(marked, 2027, "msme-1", "April to September").srn, "AB1111111");
  assert.equal(row(marked, 2027, "msme-1", "October to March").filedOn ?? null, null);
});

test("marking again replaces the record; un-marking removes it", () => {
  const key = filingKey(row(client(), 2026, "aoc-4"));
  const once = withFiling(client(), key, { filedOn: "2026-10-20", srn: "AB1234567" });
  const twice = withFiling(once, key, { filedOn: "2026-10-21", srn: "AB7654321" });
  assert.equal(twice.filings.length, 1);
  assert.equal(row(twice, 2026, "aoc-4").srn, "AB7654321");
  assert.equal(withoutFiling(twice, key).filings.length, 0);
});

test("a filed deadline is no longer overdue, and the report counts it completed with its SRN", () => {
  const asOf = d("2027-01-05"); // after the AOC-4 date as extended by GC 05/2026 (31 Dec)
  const open = computeClientHealth(client(), asOf);
  assert.ok(open.overdue.some((r) => r.source.id === "aoc-4" && r.fyEndingYear === 2026));

  const c = withFiling(client(), filingKey(row(client(), 2026, "aoc-4")), {
    filedOn: "2026-10-28",
    srn: "AB1234567",
  });
  assert.ok(!computeClientHealth(c, asOf).overdue.some((r) => r.source.id === "aoc-4"));

  const report = buildPortfolioReport([c], [], { asOf });
  const item = report.sections[0].items.find((i) => i.item.source.id === "aoc-4" && i.item.fyEndingYear === 2026);
  assert.equal(item.bucket, "completed");
  assert.equal(item.item.srn, "AB1234567");
});

/* ---------------- DIR-3 KYC ---------------- */

test("KYC rows carry the director's SRN, and are identified as director rows", () => {
  const director = {
    id: "d1",
    name: "Ananya",
    din: "07712345",
    dinAllottedOn: "2023-07-15",
    lastKycFiledOn: "2026-05-20",
    lastKycSrn: "AB9999999",
    directorships: [{ clientId: "c1", role: "Director", appointedOn: "2023-07-15" }],
    createdAt: "",
    updatedAt: "",
  };
  const kyc = resolveClientYear(client(), [director], 2026).find((r) => r.source.id === "dir-3-kyc:d1");
  assert.equal(kyc.srn, "AB9999999");
  assert.equal(kycDirectorId(kyc), "d1");
});

test("editing a director keeps the KYC SRN; clearing the KYC date clears the SRN", () => {
  const director = {
    id: "d1",
    name: "Ananya",
    din: "07712345",
    dinAllottedOn: "2023-07-15",
    lastKycFiledOn: "2026-05-20",
    lastKycSrn: "AB9999999",
    directorships: [],
    createdAt: "",
    updatedAt: "",
  };
  const draft = { ...director, name: "Ananya R" };
  assert.equal(applyDirectorDraft(director, draft).lastKycSrn, "AB9999999");
  assert.equal(applyDirectorDraft(director, { ...draft, lastKycFiledOn: null }).lastKycSrn, null);
});

/* ---------------- storage ---------------- */

test("malformed filing records in storage are dropped, good ones kept", () => {
  const stored = client({
    filings: [
      { key: "aoc-4|2026|", filedOn: "2026-10-20", srn: "AB1234567" },
      { key: "mgt-7|2026|", filedOn: "not a date", srn: "X" },
      null,
    ],
  });
  const [loaded] = normalise({ clients: [stored], directors: [] }).clients;
  assert.deepEqual(loaded.filings, [{ key: "aoc-4|2026|", filedOn: "2026-10-20", srn: "AB1234567" }]);
  assert.deepEqual(cleanFilings("nonsense"), []);
});
