import assert from "node:assert/strict";
import test from "node:test";

import { parseIsoDate } from "@/lib/dates";
import {
  NOT_A_CHALLAN,
  NOT_A_DOCUMENT,
  parseFilingDocument,
  bestChallanRow,
  challanCandidates,
  findChallanCompany,
  normaliseFormCode,
  parseMcaChallan,
  sameCin,
} from "@/lib/challan";
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

function row(id, formCode, due, extra = {}) {
  return {
    source: { id, formCode },
    due: parseIsoDate(due),
    fyEndingYear: Number(due.slice(0, 4)),
    ...extra,
  };
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

test("finds the company despite look-alike characters, or by name", () => {
  const clients = [
    { id: "a", cin: "U35100TS2025PTC202358", name: "Truvoltz Green Energies Pvt. Ltd." },
    { id: "b", cin: "U12345KA2020PTC000001", name: "Other Co Private Limited" },
  ];
  assert.equal(findChallanCompany(clients, { cin: "U351OOTS2025PTC2O2358\u200b", companyName: "x" })?.client.id, "a");
  const byName = findChallanCompany(clients, {
    cin: "U99999TS2025PTC999999",
    companyName: "TRUVOLTZ GREEN ENERGIES PRIVATE LIMITED",
  });
  assert.deepEqual([byName?.client.id, byName?.by], ["a", "name"]);
  assert.equal(findChallanCompany(clients, { cin: "U00000XX0000PTC000000", companyName: "Nobody Ltd" }), null);
});

// The text lines of an ITR acknowledgement (ITR-6) from the e-filing portal.
const ITR_ACK = [
  "Acknowledgement Number:982638041251026    Date of filing : 25-Oct-2026",
  "INDIAN INCOME TAX RETURN ACKNOWLEDGEMENT    Assessment",
  "[Where the data of the Return of Income in Form ITR-1(SAHAJ), ITR-2, ITR-3, ITR-4(SUGAM), ITR-5, ITR-6, ITR-7    Year",
  "filed and verified]",
  "(Please see Rule 12 of the Income-tax Rules, 1962)    2026-27",
  "PAN    AAICI5890D",
  "Name    IGPL GROUPS PRIVATE LIMITED",
  "Status    7-Private company    Form Number    ITR-6",
  "Filed u/s    139(1)-On or before due date    e-Filing Acknowledgement Number    982638041251026",
];

test("reads an ITR acknowledgement", () => {
  const r = parseFilingDocument(ITR_ACK);
  assert.ok(r.ok);
  assert.equal(r.challan.kind, "itr");
  assert.equal(r.challan.srn, "982638041251026");
  assert.equal(r.challan.srnDate, "2026-10-25");
  assert.equal(r.challan.fyEndingYear, 2026);
  assert.equal(r.challan.pan, "AAICI5890D");
  assert.equal(r.challan.companyName, "IGPL GROUPS PRIVATE LIMITED");
  assert.equal(r.challan.fees[0].formCode, "ITR-6");
});

test("a challan still reads as a challan, and other PDFs are refused", () => {
  const c = parseFilingDocument(GAR7);
  assert.ok(c.ok && c.challan.kind !== "itr");
  assert.deepEqual(parseFilingDocument(["Some invoice", "Total 500"]), { ok: false, error: NOT_A_DOCUMENT });
});

test("an ITR acknowledgement picks the row for its year", () => {
  const r = parseFilingDocument(ITR_ACK);
  assert.ok(r.ok);
  const rows = [row("itr:company", "ITR-6", "2025-10-31"), row("itr:company", "ITR-6", "2026-10-31")];
  rows[0].fyEndingYear = 2025;
  rows[1].fyEndingYear = 2026;
  const best = bestChallanRow(challanCandidates(rows, ["ITR-6"]), r.challan);
  assert.equal(best?.fyEndingYear, 2026);
});
