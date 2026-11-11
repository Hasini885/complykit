import assert from "node:assert/strict";
import test from "node:test";

import { parseIsoDate } from "@/lib/dates";
import {
  NOT_A_CHALLAN,
  bestChallanRow,
  challanCandidates,
  normaliseFormCode,
  parseMcaChallan,
  sameCin,
} from "@/lib/challan";
import type { ResolvedDueDate } from "@/lib/resolve-due-dates";

// The text lines src/lib/pdf-text.ts gives for a G.A.R.7 receipt.
const GAR7 = [
  "MINISTRY OF CORPORATE AFFAIRS",
  "RECEIPT",
  "G.A.R.7",
  "SRN:    AC6752561/ BharatKoshOrderId :1-27884320375        Service Request Date:",
  "14/10/2026",
  "SRN Date: 13/10/2026 18:14:58",
  "RECEIVED FROM:",
  "Name:    MARAM CHIRANJEEVI SAI SURYA GOPI NATH",
  "Address:    *-**, KV REDDY NAGAR, Rangareddy, Rangareddy, Telangana, 500100",
  "ENTITY ON WHOSE BEHALF MONEY IS PAID",
  "LLPIN/CIN/DIN:    U35100TS2025PTC202358",
  "Name:    TRUVOLTZ GREEN ENERGIES PRIVATE LIMITED",
  "Address:  5-3/3/17 ANJAIAH ENCLAVE, NEAR SR JR COLLEGE, Ghatkesar, Hyderabad,",
  "Telangana, 500092",
  "FULL PARTICULARS OF REMITTANCE",
  "Service Type: eFiling",
  "Service Description    Type of Fee    Amount (Rs.)",
  "Fee for ADT - 1    Normal    200",
  "Additional    0",
  "Total    200",
  "Mode of Payment: Online",
  "Received Payment Rupees: Two  Hundred  Rupees Only.",
];

test("reads a G.A.R.7 challan", () => {
  const r = parseMcaChallan(GAR7);
  assert.ok(r.ok);
  const c = r.challan;
  assert.equal(c.srn, "AC6752561");
  assert.equal(c.srnDate, "2026-10-13");
  assert.equal(c.cin, "U35100TS2025PTC202358");
  assert.equal(c.companyName, "TRUVOLTZ GREEN ENERGIES PRIVATE LIMITED");
  assert.equal(c.address, "5-3/3/17 ANJAIAH ENCLAVE, NEAR SR JR COLLEGE, Ghatkesar, Hyderabad, Telangana, 500092");
  assert.equal(c.payerName, "MARAM CHIRANJEEVI SAI SURYA GOPI NATH");
  assert.deepEqual(c.fees, [{ description: "Fee for ADT - 1", formCode: "ADT-1", normal: 200, additional: 0 }]);
  assert.equal(c.total, 200);
});

test("rejects any other PDF", () => {
  const r = parseMcaChallan(["Bank of Somewhere", "Statement of account", "SRN: AB1234567"]);
  assert.deepEqual(r, { ok: false, error: NOT_A_CHALLAN });
});

test("rejects a challan with no SRN", () => {
  const r = parseMcaChallan(GAR7.filter((l) => !/SRN/.test(l)));
  assert.equal(r.ok, false);
});

test("normalises form codes", () => {
  assert.equal(normaliseFormCode("Fee for ADT - 1"), "ADT-1");
  assert.equal(normaliseFormCode("e-Form MGT 7A"), "MGT-7A");
  assert.equal(normaliseFormCode("AOC-4"), "AOC-4");
  assert.equal(normaliseFormCode("nothing here"), null);
});

test("CINs compare ignoring case and spaces", () => {
  assert.ok(sameCin("u35100ts2025ptc202358", "U35100TS2025PTC202358"));
  assert.ok(!sameCin("", ""));
});

function row(id: string, formCode: string | null, due: string, extra: Partial<ResolvedDueDate> = {}): ResolvedDueDate {
  return {
    source: { id, formCode } as ResolvedDueDate["source"],
    due: parseIsoDate(due),
    fyEndingYear: Number(due.slice(0, 4)),
    ...extra,
  } as ResolvedDueDate;
}

test("picks the open row nearest the SRN date", () => {
  const r = parseMcaChallan(GAR7);
  assert.ok(r.ok);
  const rows = [
    row("adt-1", "ADT-1", "2025-10-14", { filedOn: parseIsoDate("2025-10-01"), srn: "X1234567" }),
    row("adt-1", "ADT-1", "2026-10-14"),
    row("adt-1", "ADT-1", "2027-10-14"),
    row("aoc-4", "AOC-4", "2026-10-29"),
  ];
  const cands = challanCandidates(rows, ["ADT-1"]);
  assert.equal(cands.length, 3);
  assert.equal(bestChallanRow(cands, r.challan)?.due?.getFullYear(), 2026);
});

test("prefers the row already holding the same SRN", () => {
  const r = parseMcaChallan(GAR7);
  assert.ok(r.ok);
  const rows = [
    row("adt-1", "ADT-1", "2026-10-14"),
    row("adt-1", "ADT-1", "2025-10-14", { filedOn: parseIsoDate("2026-10-13"), srn: "AC6752561" }),
  ];
  assert.equal(bestChallanRow(challanCandidates(rows, ["ADT-1"]), r.challan)?.due?.getFullYear(), 2025);
});

test("matches rows listing alternative forms", () => {
  const rows = [row("itr", "ITR-7 / ITR-6", "2026-10-31")];
  assert.equal(challanCandidates(rows, ["ITR-6"]).length, 1);
});
