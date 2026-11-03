import assert from "node:assert/strict";
import test from "node:test";

import { parseAmount, parseCompanyText, parseDate, wordsToNumber } from "@/lib/pdf-text-parser";
import {
  applyExtractionToClientDraft,
  classifyCompanyStatus,
  emptyExtraction,
  mergeExtractions,
} from "@/lib/pdf-extraction";
import type { ClientDraft } from "@/lib/portfolio/clients";

/*
 * Fixtures are shaped like the output of src/lib/pdf-text.ts: one string per
 * visual line, with a run of spaces where pdf.js saw a column gap.
 */

const MASTER_DATA = [
  "Company Master Data",
  "CIN    U62099KA2019PTC128740",
  "Company Name    RAGHAVAN SOFTWARE PRIVATE LIMITED",
  "ROC Name    RoC-Bangalore",
  "Registration Number    128740",
  "Company Category    Company limited by Shares",
  "Class of Company    Private",
  "Authorised Capital(Rs)    5000000",
  "Paid up Capital(Rs)    3200000",
  "Date of Incorporation    18/07/2019",
  "Registered Address    No. 4, Residency Road, Bengaluru,",
  "Karnataka, India, 560025",
  "Whether Listed or not    Unlisted",
  "Date of last AGM    26/09/2025",
  "Company Status    Active",
  "Director/Signatory Details",
  "DIN/PAN    Name    Begin Date    End Date",
  "07712345    ANANYA RAGHAVAN    18/07/2019    -",
  "03445901    NITA BHASKAR    02/04/2021    -",
  "Index of Charges",
  "10045678    State Bank of India    12/01/2022",
];

const CERTIFICATE = [
  "GOVERNMENT OF INDIA",
  "MINISTRY OF CORPORATE AFFAIRS",
  "Certificate of Incorporation",
  "I hereby certify that BLUEFIN ANALYTICS PRIVATE LIMITED is incorporated on this Fourteenth day of June Two thousand twenty three under",
  "the Companies Act, 2013 (18 of 2013) and that the company is limited by shares.",
  "The Corporate Identity Number of the company is U72900MH2023PTC401234.",
  "Mailing Address as per record available in Registrar of Companies office:",
  "Flat 12, Sea View Apartments, Bandra West,",
  "Mumbai, Maharashtra, India, 400050",
];

const FINANCIALS = [
  "KESTREL FOODS PRIVATE LIMITED",
  "CIN: U15400DL2016PTC300111",
  "Balance Sheet as at 31 March 2026",
  "(All amounts in ₹ lakhs, unless otherwise stated)",
  "Particulars    Note    31 March 2026    31 March 2025",
  "(a) Share capital    3    50.00    50.00",
  "Total equity    4    412.75    355.10",
  "(a) Long-term borrowings    5    120.00    140.00",
  "(b) Short-term borrowings    6    35.50    20.00",
  "Revenue from operations    18    1,845.20    1,610.00",
  "Profit for the year    63.40    48.25",
  "Turnover of the company grew by 14% over the previous year.",
  "For Rao & Associates    For and on behalf of the Board of Directors",
  "Chartered Accountants",
  "Firm Registration No. 012345S",
  "Ananya Raghavan    Nita Bhaskar",
  "Director    Director",
  "DIN: 07712345    DIN: 03445901",
];

/* ---------------- primitives ---------------- */

test("parseAmount reads Indian grouping, units, negatives, and skips note references", () => {
  assert.equal(parseAmount("₹ 32,00,000"), 3_200_000);
  assert.equal(parseAmount("Rs. 1.5 crore"), 15_000_000);
  assert.equal(parseAmount("40 lakh"), 4_000_000);
  assert.equal(parseAmount("(1,23,456)"), -123_456);
  assert.equal(parseAmount("3    50.00    50.00", 1e5), 5_000_000);
  assert.equal(parseAmount("nothing here"), null);
});

test("parseDate reads day-first numeric dates and written months", () => {
  assert.equal(parseDate("18/07/2019"), "2019-07-18");
  assert.equal(parseDate("18-07-2019"), "2019-07-18");
  assert.equal(parseDate("2019-07-18"), "2019-07-18");
  assert.equal(parseDate("18th July, 2019"), "2019-07-18");
  assert.equal(parseDate("18-Jul-2019"), "2019-07-18");
  assert.equal(parseDate("July 18, 2019"), "2019-07-18");
  assert.equal(parseDate("31/02/2019"), null, "an impossible date is rejected, not rolled over");
  assert.equal(parseDate("-"), null);
});

test("wordsToNumber reads the certificate's written-out dates", () => {
  assert.equal(wordsToNumber("Fourteenth"), 14);
  assert.equal(wordsToNumber("Twenty first"), 21);
  assert.equal(wordsToNumber("Thirty-first"), 31);
  assert.equal(wordsToNumber("Two thousand twenty three"), 2023);
  assert.equal(wordsToNumber("Two Thousand and Nineteen"), 2019);
  assert.equal(wordsToNumber("June"), null);
});

/* ---------------- MCA master data ---------------- */

test("master data: every labelled field is read", () => {
  const r = parseCompanyText(MASTER_DATA);
  assert.equal(r.cin, "U62099KA2019PTC128740");
  assert.equal(r.companyName, "RAGHAVAN SOFTWARE PRIVATE LIMITED");
  assert.equal(r.entityTypeRaw, "Private Limited Company");
  assert.equal(r.authorisedCapital, 5_000_000);
  assert.equal(r.paidUpCapital, 3_200_000);
  assert.equal(r.incorporationDate, "2019-07-18");
  assert.equal(r.registeredOfficeAddress, "No. 4, Residency Road, Bengaluru, Karnataka, India, 560025");
  assert.equal(r.listed, false);
  assert.equal(r.lastAgmDate, "2025-09-26");
  assert.equal(r.companyStatusRaw, "Active");
});

test("master data: directors come from the table, and the charges table is not read as directors", () => {
  const r = parseCompanyText(MASTER_DATA);
  assert.deepEqual(r.directors, [
    { name: "ANANYA RAGHAVAN", din: "07712345" },
    { name: "NITA BHASKAR", din: "03445901" },
  ]);
});

test("master data: nothing is invented for fields the printout does not carry", () => {
  const r = parseCompanyText(MASTER_DATA);
  assert.equal(r.turnover, null);
  assert.equal(r.netProfit, null);
  assert.equal(r.deposits, null);
  assert.equal(r.msmeDuesOver45Days, null);
});

/* ---------------- Certificate of Incorporation ---------------- */

test("certificate: name, CIN, written-out date, type and mailing address", () => {
  const r = parseCompanyText(CERTIFICATE);
  assert.equal(r.companyName, "BLUEFIN ANALYTICS PRIVATE LIMITED");
  assert.equal(r.cin, "U72900MH2023PTC401234");
  assert.equal(r.incorporationDate, "2023-06-14");
  assert.equal(r.entityTypeRaw, "Private Limited Company");
  assert.equal(r.listed, false, "U-prefixed CIN = unlisted");
  assert.equal(r.registeredOfficeAddress, "Flat 12, Sea View Apartments, Bandra West, Mumbai, Maharashtra, India, 400050");
});

test("CIN ownership code identifies OPCs, public and section 8 companies", () => {
  assert.equal(parseCompanyText(["CIN U74999TN2020OPC123456"]).entityTypeRaw, "One Person Company");
  assert.equal(parseCompanyText(["CIN L17110MH1973PLC019786"]).entityTypeRaw, "Public Limited Company");
  assert.equal(parseCompanyText(["CIN L17110MH1973PLC019786"]).listed, true);
  assert.match(parseCompanyText(["CIN U85300DL2018NPL331122"]).entityTypeRaw ?? "", /section 8/i);
});

test("LLP: LLPIN and contribution", () => {
  const r = parseCompanyText([
    "LLP Master Data",
    "LLPIN    AAB-1234",
    "LLP Name    ORBIT ADVISORS LLP",
    "Total Obligation of Contribution    500000",
    "Number of Designated Partners    2",
  ]);
  assert.equal(r.cin, "AAB-1234");
  assert.equal(r.companyName, "ORBIT ADVISORS LLP");
  assert.equal(r.entityTypeRaw, "Limited Liability Partnership");
  assert.equal(r.llpContribution, 500_000);
  assert.equal(r.numberOfDirectors, 2);
});

/* ---------------- financial statements ---------------- */

test("financials: figures in lakhs are converted to rupees, note numbers skipped", () => {
  const r = parseCompanyText(FINANCIALS);
  assert.equal(r.companyName, "KESTREL FOODS PRIVATE LIMITED");
  assert.equal(r.paidUpCapital, 5_000_000);
  assert.equal(r.netWorth, 41_275_000);
  assert.equal(r.borrowings, 15_550_000, "long-term plus short-term, current year");
  assert.equal(r.turnover, 184_520_000);
  assert.equal(r.netProfit, 6_340_000);
});

test("financials: a sentence that mentions turnover is not read as the figure", () => {
  const r = parseCompanyText(["ACME LIMITED", "Turnover of the company grew by 14% over last year."]);
  assert.equal(r.turnover, null);
});

test("financials: auditor and side-by-side director signatures", () => {
  const r = parseCompanyText(FINANCIALS);
  assert.equal(r.auditorName, "Rao & Associates");
  assert.deepEqual(r.directors, [
    { name: "Ananya Raghavan", din: "07712345" },
    { name: "Nita Bhaskar", din: "03445901" },
  ]);
});

test("a document with no text yields an all-null result", () => {
  assert.deepEqual(parseCompanyText([]), emptyExtraction());
  assert.deepEqual(parseCompanyText(["   ", ""]), emptyExtraction());
});

/* ---------------- merging and the form ---------------- */

test("mergeExtractions keeps the primary's values and fills its gaps from the secondary", () => {
  const ai = { ...emptyExtraction(), companyName: "From AI", turnover: 100, directors: [] };
  const browser = {
    ...emptyExtraction(),
    companyName: "From browser",
    cin: "U62099KA2019PTC128740",
    directors: [{ name: "A", din: "12345678" }],
  };
  const merged = mergeExtractions(ai, browser);
  assert.equal(merged.companyName, "From AI");
  assert.equal(merged.turnover, 100);
  assert.equal(merged.cin, "U62099KA2019PTC128740");
  assert.deepEqual(merged.directors, [{ name: "A", din: "12345678" }]);
});

test("classifyCompanyStatus maps MCA wording onto client statuses", () => {
  assert.equal(classifyCompanyStatus("Active"), "active");
  assert.equal(classifyCompanyStatus("Strike Off"), "strike-off");
  assert.equal(classifyCompanyStatus("Under process of Striking off"), "strike-off");
  assert.equal(classifyCompanyStatus("Dormant under section 455"), "dormant");
  assert.equal(classifyCompanyStatus("Amalgamated"), "closed");
  assert.equal(classifyCompanyStatus("Something else"), null);
});

test("master data fills the whole Add Company form it covers, including AGM, status and director count", () => {
  const draft: ClientDraft = {
    name: "",
    cin: "",
    type: "public",
    incorporatedOn: "",
    registeredOffice: "",
    status: "dormant",
    notes: "typed by hand",
  };
  const filled = applyExtractionToClientDraft(draft, parseCompanyText(MASTER_DATA));
  assert.equal(filled.name, "RAGHAVAN SOFTWARE PRIVATE LIMITED");
  assert.equal(filled.cin, "U62099KA2019PTC128740");
  assert.equal(filled.type, "private");
  assert.equal(filled.incorporatedOn, "2019-07-18");
  assert.equal(filled.lastAgmOn, "2025-09-26");
  assert.equal(filled.status, "active");
  assert.equal(filled.paidUpCapital, 3_200_000);
  assert.equal(filled.listed, false);
  assert.equal(filled.directorsCount, 2);
  assert.equal(filled.notes, "typed by hand", "fields the PDF does not cover are left alone");
});
