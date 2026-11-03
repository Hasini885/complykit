import assert from "node:assert/strict";
import test from "node:test";

import {
  applyExtractionToApplicabilityProfile,
  applyExtractionToClientDraft,
  classifyEntityType,
  countExtractedFields,
  ExtractedCompanySchema,
  extractionToDirectorDrafts,
  normaliseIncorporationDate,
  PDF_MAX_BYTES,
  type ExtractedCompany,
} from "@/lib/pdf-extraction";
import { emptyProfile } from "@/lib/applicability";
import type { ClientDraft } from "@/lib/portfolio/clients";

function empty(): ExtractedCompany {
  return {
    companyName: null,
    cin: null,
    entityTypeRaw: null,
    incorporationDate: null,
    registeredOfficeAddress: null,
    paidUpCapital: null,
    authorisedCapital: null,
    turnover: null,
    netWorth: null,
    netProfit: null,
    borrowings: null,
    deposits: null,
    listed: null,
    auditorName: null,
    lastAgmDate: null,
    llpContribution: null,
    numberOfDirectors: null,
    companyStatusRaw: null,
    msmeDuesOver45Days: null,
    securitiesInDemat: null,
    directors: null,
  };
}

function emptyDraft(): ClientDraft {
  return {
    name: "",
    cin: "",
    type: "private",
    incorporatedOn: "",
    registeredOffice: "",
    status: "active",
  };
}

/* ---------------- schema ---------------- */

test("the schema accepts an all-null document -- extraction must never be forced to guess", () => {
  const parsed = ExtractedCompanySchema.safeParse(empty());
  assert.equal(parsed.success, true);
});

test("the schema accepts a fully populated document", () => {
  const full: ExtractedCompany = {
    ...empty(),
    companyName: "Example Private Limited",
    cin: "U62099KA2019PTC128740",
    entityTypeRaw: "Private Limited Company",
    incorporationDate: "2019-07-18",
    registeredOfficeAddress: "No. 4, Residency Road, Bengaluru",
    paidUpCapital: 3_200_000,
    authorisedCapital: 5_000_000,
    turnover: 46_500_000,
    netWorth: 18_400_000,
    netProfit: 4_100_000,
    borrowings: 12_000_000,
    deposits: 0,
    listed: false,
    auditorName: "Rao & Associates",
    directors: [{ name: "Ananya Raghavan", din: "07712345" }],
  };
  assert.equal(ExtractedCompanySchema.safeParse(full).success, true);
});

test("the schema rejects a made-up extra field rather than passing it through silently", () => {
  const withExtra = { ...empty(), notARealField: "hallucinated" };
  // Zod's default is to strip unknown keys, not error -- confirm the parsed
  // result really has dropped it, so nothing untyped reaches a form.
  const parsed = ExtractedCompanySchema.parse(withExtra);
  assert.ok(!("notARealField" in parsed));
});

/* ---------------- field counting ---------------- */

test("an all-null extraction counts zero fields found", () => {
  assert.deepEqual(countExtractedFields(empty()), { found: 0, total: 21 });
});

test("field count increases by exactly one per non-null scalar, plus one if directors is non-empty", () => {
  const one = countExtractedFields({ ...empty(), companyName: "X" });
  assert.equal(one.found, 1);

  const two = countExtractedFields({ ...empty(), companyName: "X", cin: "Y" });
  assert.equal(two.found, 2);

  const withDirectors = countExtractedFields({
    ...empty(),
    directors: [{ name: "A", din: null }],
  });
  assert.equal(withDirectors.found, 1);
});

test("an empty directors array does not count as found", () => {
  assert.equal(countExtractedFields({ ...empty(), directors: [] }).found, 0);
});

/* ---------------- entity classification ---------------- */

test("classifyEntityType recognises every phrasing this app's five types actually use", () => {
  assert.equal(classifyEntityType("Private Limited Company"), "private");
  assert.equal(classifyEntityType("Public Limited Company"), "public");
  assert.equal(classifyEntityType("One Person Company"), "opc");
  assert.equal(classifyEntityType("OPC"), "opc");
  assert.equal(classifyEntityType("Limited Liability Partnership"), "llp");
  assert.equal(classifyEntityType("LLP"), "llp");
  assert.equal(classifyEntityType("Section 8 Company"), "section8");
  assert.equal(classifyEntityType("Section-8 Company"), "section8");
  assert.equal(classifyEntityType("Not-for-profit company"), "section8");
});

test("classifyEntityType returns null on null or unrecognised text, never a guess", () => {
  assert.equal(classifyEntityType(null), null);
  assert.equal(classifyEntityType(""), null);
  assert.equal(classifyEntityType("Sole Proprietorship"), null);
  assert.equal(classifyEntityType("gibberish xyz"), null);
});

test("classifyEntityType checks OPC before LLP so 'One Person Company' can't be misread", () => {
  // A regression guard: an OPC description must never fall through to llp.
  assert.equal(classifyEntityType("Registered as a One Person Company (OPC)"), "opc");
});

/* ---------------- date normalisation ---------------- */

test("normaliseIncorporationDate accepts a real ISO date and rejects everything else", () => {
  assert.equal(normaliseIncorporationDate("2019-07-18"), "2019-07-18");
  assert.equal(normaliseIncorporationDate(null), null);
  assert.equal(normaliseIncorporationDate(""), null);
  assert.equal(normaliseIncorporationDate("18 July 2019"), null, "not ISO format");
  assert.equal(normaliseIncorporationDate("2019-02-30"), null, "not a real calendar date");
  assert.equal(normaliseIncorporationDate("not a date"), null);
});

/* ---------------- mapping onto ClientDraft: never overwrite with a blank ---------------- */

test("applying an all-null extraction leaves every existing field exactly as it was", () => {
  // Every field applyExtractionToClientDraft can touch is set explicitly here
  // (rather than left absent) so the comparison can't trip over Node's
  // assert.deepEqual distinguishing "key absent" from "key present as
  // undefined" -- a real difference this same function can produce.
  const draft: ClientDraft = {
    ...emptyDraft(),
    name: "Already Typed Pvt Ltd",
    cin: "U11111KA2020PTC000001",
    type: "public",
    incorporatedOn: "2020-01-01",
    registeredOffice: "Somewhere",
    listed: true,
    paidUpCapital: 500,
    turnover: 900,
    netWorth: 200,
    netProfit: 50,
    borrowings: 10,
    deposits: 0,
  };
  const result = applyExtractionToClientDraft(draft, empty());
  assert.deepEqual(result, draft);
});

test("applying a populated extraction fills only the fields the PDF covered", () => {
  const draft: ClientDraft = { ...emptyDraft(), turnover: 999, netWorth: 111 };
  const extracted: ExtractedCompany = {
    ...empty(),
    companyName: "New Co Private Limited",
    cin: "u62099ka2019ptc128740", // lower-case, to prove it gets normalised
    entityTypeRaw: "Private Limited Company",
    incorporationDate: "2021-05-01",
    registeredOfficeAddress: "123 Main Street",
    paidUpCapital: 4_000_000,
  };
  const result = applyExtractionToClientDraft(draft, extracted);

  assert.equal(result.name, "New Co Private Limited");
  assert.equal(result.cin, "U62099KA2019PTC128740", "CIN is upper-cased");
  assert.equal(result.type, "private");
  assert.equal(result.incorporatedOn, "2021-05-01");
  assert.equal(result.registeredOffice, "123 Main Street");
  assert.equal(result.paidUpCapital, 4_000_000);
  // Not covered by this extraction -- must survive untouched.
  assert.equal(result.turnover, 999);
  assert.equal(result.netWorth, 111);
});

test("a zero extracted value is applied, distinct from 'not found'", () => {
  const draft: ClientDraft = { ...emptyDraft(), deposits: 5_000 };
  const result = applyExtractionToClientDraft(draft, { ...empty(), deposits: 0 });
  assert.equal(result.deposits, 0, "an explicit zero from the document must overwrite the old value");
});

test("an unrecognisable entity type or date does not clobber the existing draft value", () => {
  const draft: ClientDraft = { ...emptyDraft(), type: "opc", incorporatedOn: "2018-01-01" };
  const result = applyExtractionToClientDraft(draft, {
    ...empty(),
    entityTypeRaw: "Something Unrecognisable",
    incorporationDate: "not a real date",
  });
  assert.equal(result.type, "opc");
  assert.equal(result.incorporatedOn, "2018-01-01");
});

/* ---------------- mapping onto the Applicability profile ---------------- */

test("applying extraction to an applicability profile only fills covered fields", () => {
  const profile = { ...emptyProfile(), entityType: "llp" as const, deposits: 42 };
  const result = applyExtractionToApplicabilityProfile(profile, {
    ...empty(),
    entityTypeRaw: "Public Limited Company",
    turnover: 10_000_000,
    listed: true,
  });
  assert.equal(result.entityType, "public");
  assert.equal(result.turnover, 10_000_000);
  assert.equal(result.listed, true);
  assert.equal(result.deposits, 42, "untouched field survives");
});

/* ---------------- director drafts ---------------- */

test("extractionToDirectorDrafts maps every named director, skipping blank names", () => {
  const drafts = extractionToDirectorDrafts(
    { ...empty(), directors: [{ name: "Ananya Raghavan", din: "07712345" }, { name: "  ", din: null }] },
    "2026-09-04",
  );
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].name, "Ananya Raghavan");
  assert.equal(drafts[0].din, "07712345");
  assert.equal(drafts[0].dinAllottedOn, "2026-09-04");
  assert.deepEqual(drafts[0].directorships, []);
});

test("extractionToDirectorDrafts returns an empty list when no directors were found", () => {
  assert.deepEqual(extractionToDirectorDrafts(empty(), "2026-09-04"), []);
  assert.deepEqual(extractionToDirectorDrafts({ ...empty(), directors: [] }, "2026-09-04"), []);
});

test("a director with no DIN maps to an empty string, not null, matching the form's own state shape", () => {
  const drafts = extractionToDirectorDrafts(
    { ...empty(), directors: [{ name: "No DIN Yet", din: null }] },
    "2026-09-04",
  );
  assert.equal(drafts[0].din, "");
});

/* ---------------- constants ---------------- */

test("the size cap matches the 10MB the spec asked for", () => {
  assert.equal(PDF_MAX_BYTES, 10 * 1024 * 1024);
});
