import assert from "node:assert/strict";
import test from "node:test";

import { ALL_TEMPLATES, DOC_TEMPLATES, clockTime, findTemplates, initialValues, longDate, templatesById } from "@/lib/documents/templates";
import { DOC_CATEGORIES, type DocContext } from "@/lib/documents/types";
import { toDocx, toPdf, toPlainText } from "@/lib/documents/export";

const ctx: DocContext = {
  companyName: "Meridian Analytics Private Limited",
  cin: "U62099KA2019PTC128740",
  registeredOffice: "No. 4, Residency Road, Bengaluru 560025",
  entityLabel: "Private Limited Company",
  directors: [
    { name: "Ananya Raghavan", din: "07712345" },
    { name: "Farhan Qureshi", din: "08123456" },
  ],
  today: new Date(2026, 9, 28),
};
const empty: DocContext = { ...ctx, companyName: "", cin: "", registeredOffice: "", directors: [] };

test("every template has a known category, a statutory reference and unique field ids", () => {
  assert.equal(new Set(DOC_TEMPLATES.map((t) => t.id)).size, DOC_TEMPLATES.length);
  for (const t of DOC_TEMPLATES) {
    assert.ok((DOC_CATEGORIES as readonly string[]).includes(t.category), t.id);
    assert.ok(t.reference.length > 10, t.id);
    assert.equal(new Set(t.fields.map((f) => f.id)).size, t.fields.length, t.id);
  }
});

test("every template renders, pre-filled from the company, without throwing", () => {
  for (const t of DOC_TEMPLATES) {
    const blocks = t.render(initialValues(t, ctx), ctx);
    assert.ok(blocks.length > 3, t.id);
    const text = toPlainText(blocks);
    assert.ok(text.includes("Meridian Analytics Private Limited"), `${t.id} names the company`);
    assert.ok(!/undefined|NaN|\[object/.test(text), `${t.id}: no rendering leaks`);
  }
});

test("blank details render as fill-in lines, not as broken text", () => {
  for (const t of DOC_TEMPLATES) {
    const text = toPlainText(t.render(initialValues(t, empty), empty));
    assert.ok(!/undefined|NaN/.test(text), t.id);
    assert.ok(text.includes("__________"), `${t.id} leaves blanks to fill`);
  }
});

test("the Board meeting notice carries the date, time, venue and the agenda", () => {
  const t = templatesById.get("board-meeting-notice")!;
  const v = { ...initialValues(t, ctx), meetingDate: "2026-11-12", meetingTime: "15:30" };
  const text = toPlainText(t.render(v, ctx));
  assert.match(text, /12 November 2026 at 3:30 p\.m\./);
  assert.match(text, /1\. To grant leave of absence/);
  assert.match(text, /Ananya Raghavan/, "signed by the first director by default");
});

test("the additional-director resolution names the appointee and authorises DIR-12", () => {
  const t = templatesById.get("resolution-additional-director")!;
  const v = { ...initialValues(t, ctx), appointee: "Leela Menon", appointeeDin: "09234567" };
  const text = toPlainText(t.render(v, ctx));
  assert.match(text, /Leela Menon \(DIN: 09234567\)/);
  assert.match(text, /Section 161\(1\)/);
  assert.match(text, /Form DIR-12/);
});

test("the interim dividend works out the percentage of face value", () => {
  const t = templatesById.get("resolution-interim-dividend")!;
  const v = { ...initialValues(t, ctx), perShare: "2.5", faceValue: "10" };
  assert.match(toPlainText(t.render(v, ctx)), /₹2\.5 per equity share of ₹10 each \(25% of the face value\)/);
});

test("an independent director's letter adds the independence clauses", () => {
  const t = templatesById.get("director-appointment-letter")!;
  const ind = toPlainText(t.render({ ...initialValues(t, ctx), category: "Independent Director" }, ctx));
  const ne = toPlainText(t.render({ ...initialValues(t, ctx), category: "Non-Executive Director" }, ctx));
  assert.match(ind, /Section 149\(7\)/);
  assert.doesNotMatch(ne, /Section 149\(7\)/);
});

test("Find matches plain-language requests", () => {
  assert.equal(findTemplates("open a bank account")[0].id, "resolution-bank-account");
  assert.equal(findTemplates("change the registered office address")[0].id, "resolution-registered-office");
  assert.ok(findTemplates("appoint a new director").some((t) => t.id === "resolution-additional-director"));
  assert.ok(findTemplates("director resignation").some((t) => t.id === "director-resignation-letter"));
  assert.equal(findTemplates("").length, ALL_TEMPLATES.length);
  assert.deepEqual(findTemplates("zzzz"), []);
});

test("date and time helpers", () => {
  assert.equal(longDate("2026-10-28"), "28 October 2026");
  assert.equal(longDate(""), "__________");
  assert.equal(clockTime("09:05"), "9:05 a.m.");
  assert.equal(clockTime("12:00"), "12:00 p.m.");
  assert.equal(clockTime("00:30"), "12:30 a.m.");
});

test("Word and PDF downloads are real files of the right kind", async () => {
  const t = templatesById.get("agm-notice")!;
  const blocks = t.render({ ...initialValues(t, ctx), agmNo: "7th", agmDate: "2027-09-20", dividend: "1.50" }, ctx);
  const docx = new Uint8Array(await (await toDocx(blocks, t.title)).arrayBuffer());
  assert.equal(String.fromCharCode(docx[0], docx[1]), "PK", ".docx is a zip");
  const { unzipSync, strFromU8 } = await import("fflate");
  const xml = strFromU8(unzipSync(docx)["word/document.xml"]);
  assert.match(xml, /Annual General Meeting/);
  assert.match(xml, /Bookman Old Style/);

  const pdf = new Uint8Array(await (await toPdf(blocks)).arrayBuffer());
  assert.equal(String.fromCharCode(...pdf.slice(0, 5)), "%PDF-");
});

test("every letterhead carries the company's mobile and email", () => {
  const withContact: DocContext = { ...ctx, mobile: "98765 43210", email: "office@meridian.in" };
  for (const t of DOC_TEMPLATES) {
    const letterhead = t.render(initialValues(t, withContact), withContact).find((b) => b.kind === "letterhead");
    if (!letterhead || letterhead.kind !== "letterhead") continue;
    assert.ok(letterhead.lines.some((l) => l.includes("98765 43210") && l.includes("office@meridian.in")), t.id);
  }
});
