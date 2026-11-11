import assert from "node:assert/strict";
import test from "node:test";

import { wordsToLayout, wordsToLines } from "@/lib/pdf-ocr";
import { parseCompanyText } from "@/lib/pdf-text-parser";

const w = (text: string, x0: number, y0: number, x1 = x0 + text.length * 10) => ({ text, x0, y0, x1, y1: y0 + 20 });

test("OCR words become lines, with a wide gap between label and value", () => {
  const lines = wordsToLines([w("CIN", 50, 100), w("U68200TS2024PTC186424", 600, 102), w("Company", 50, 150), w("Name", 130, 151)]);
  assert.deepEqual(lines, ["CIN    U68200TS2024PTC186424", "Company Name"]);
});

test("a wrapped name between two table rows goes to the nearer row", () => {
  // As OCR read "Master Data.pdf" (Microsoft Print to PDF): the second director's
  // first line sits closer to the second row than to the first.
  const lines = [
    "DIN/PAN    Name    Designation    Category    Signatory",
    "SYAM BABU",
    "1    09418557    GANDHAM    Director    Promoter    11/06/2024    -    Yes",
    "VENKATESWARA",
    "2    09601495    REDDY    Director    Promoter    11/06/2024    -    Yes",
    "YAKKANTI",
  ];
  const ys = [100, 160, 190, 280, 310, 340];
  assert.deepEqual(parseCompanyText(lines, ys).directors, [
    { name: "SYAM BABU GANDHAM", din: "09418557" },
    { name: "VENKATESWARA REDDY YAKKANTI", din: "09601495" },
  ]);
});

test("line positions come back with the lines", () => {
  const { ys } = wordsToLayout([w("a", 0, 0), w("b", 0, 100)]);
  assert.deepEqual(ys, [10, 110]);
});
