import assert from "node:assert/strict";
import test from "node:test";

import { isExcelFile, sheetsToLines } from "@/lib/xlsx-lines";
import { parseCompanyText } from "@/lib/pdf-text-parser";

// The shape of MCA's "AllMDSData.xlsx": label and value cells, then the director table.
const SHEETS = [
  {
    data: [
      ["Company Information", null],
      ["CIN", "U56290TS2025PTC208500"],
      ["Company Name", "IGPL GROUPS PRIVATE LIMITED"],
      ["Date of Incorporation", "23/12/2025"],
      ["Email Id", "gandhamsyambabu[at]gmail[dot]com"],
      ["Registered Address", "SY 134/2 & 134/2/P, FLAT NO 305, GACHIBOWLI, Telangana, India, 500032"],
      ["Authorised Capital (Rs)", "10,00,000"],
      ["Class of Company", "Private"],
    ],
  },
  {
    data: [
      ["Sr. No", "DIN/PAN", "Name", "Designation", "Category", "Date of Appointment", "Cessation Date", "Signatory"],
      ["1", "09418557", "SYAM BABU GANDHAM", "Director", "Promoter", new Date(2025, 11, 23), "-", "Yes"],
      ["4", "*****2343P", "KOTESWARA BABU", "CEO", "-", "01/05/2026", "-", "Yes"],
    ],
  },
];

test("an MCA master data workbook reads like the PDF", () => {
  const r = parseCompanyText(sheetsToLines(SHEETS));
  assert.equal(r.cin, "U56290TS2025PTC208500");
  assert.equal(r.companyName, "IGPL GROUPS PRIVATE LIMITED");
  assert.equal(r.incorporationDate, "2025-12-23");
  assert.equal(r.email, "gandhamsyambabu@gmail.com");
  assert.equal(r.authorisedCapital, 1_000_000);
  assert.deepEqual(r.directors, [{ name: "SYAM BABU GANDHAM", din: "09418557" }]);
});

test("dates in cells are written day first", () => {
  assert.deepEqual(sheetsToLines([{ data: [["Date", new Date(2026, 0, 5)]] }]), ["Date    05/01/2026"]);
});

test("Excel files are recognised by name or type", () => {
  assert.ok(isExcelFile({ name: "AllMDSData.XLSX", type: "" }));
  assert.ok(!isExcelFile({ name: "master.pdf", type: "application/pdf" }));
});
