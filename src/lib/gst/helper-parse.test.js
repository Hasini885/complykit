import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// The GST Helper extension's table reader (a plain browser script), run as the browser would.
const sandbox = {};
vm.runInNewContext(readFileSync("extensions/gst-helper/parse.js", "utf8"), sandbox);
const { readFiling, monthsIn, fyFits, returnTypeOf, target } = sandbox.cactGstParse;

test("the month's financial year", () => {
  assert.deepEqual({ ...target("2026-10") }, { m: 9, fyStart: 2026 });
  assert.deepEqual({ ...target("2027-02") }, { m: 1, fyStart: 2026 }, "February belongs to the year that began in April");
});

test("periods: a month, or a quarter covering it", () => {
  assert.deepEqual([...monthsIn("October")], [9]);
  assert.deepEqual([...monthsIn("July - September")], [6, 7, 8]);
  assert.deepEqual([...monthsIn("Jan-Mar")], [0, 1, 2]);
  assert.deepEqual([...monthsIn("Filed")], []);
});

test("financial year forms", () => {
  assert.ok(fyFits("2026-2027", 2026));
  assert.ok(fyFits("2026-27", 2026));
  assert.ok(!fyFits("2025-2026", 2026));
  assert.ok(fyFits("October", 2026), "no year named: fits");
});

test("which return a heading names", () => {
  assert.equal(returnTypeOf("GSTR-1/IFF"), "g1");
  assert.equal(returnTypeOf("GSTR3B"), "g3b");
  assert.equal(returnTypeOf("GSTR-1 GSTR-3B"), "g3b", "the last one named is the nearest");
  assert.equal(returnTypeOf("GSTR-10"), null, "GSTR-10 is not GSTR-1");
});

const portalLike = [
  {
    context: "Filing Table  GSTR-1/IFF",
    rows: [
      ["Financial Year", "Tax Period", "Date of filing", "Status"],
      ["2026-2027", "September", "11/10/2026", "Filed"],
      ["2026-2027", "October", "10/11/2026", "Filed"],
    ],
  },
  {
    context: "GSTR-3B",
    rows: [
      ["Financial Year", "Tax Period", "Date of filing", "Status"],
      ["2026-2027", "September", "20/10/2026", "Filed"],
    ],
  },
];

test("reads GSTR-1 filed and GSTR-3B missing for October", () => {
  const r = readFiling(portalLike, "2026-10");
  assert.deepEqual({ ...r.g1 }, { filed: true, date: "10/11/2026" });
  assert.equal(r.g3b, null, "no GSTR-3B row for October yet");
});

test("a quarterly (QRMP) GSTR-1 counts for each month in the quarter", () => {
  const r = readFiling(
    [{ context: "GSTR-1/IFF", rows: [["2026-2027", "July - September", "13/10/2026", "Filed"]] }],
    "2026-08",
  );
  assert.equal(r.g1.filed, true);
});

test("another financial year's row does not count", () => {
  const r = readFiling([{ context: "GSTR-3B", rows: [["2025-2026", "October", "20/11/2025", "Filed"]] }], "2026-10");
  assert.equal(r.g3b, null);
});

test("return type in the row itself wins over the heading", () => {
  const r = readFiling(
    [{ context: "Returns", rows: [["GSTR3B", "2026-27", "October", "18/11/2026", "Filed"], ["GSTR1", "2026-27", "October", "", "Not Filed"]] }],
    "2026-10",
  );
  assert.equal(r.g3b.filed, true);
  assert.equal(r.g1.filed, false);
});

test("the downloadable GST Helper zip matches the extension folder", async () => {
  const { readdirSync } = await import("node:fs");
  const { unzipSync, strFromU8 } = await import("fflate");
  const zip = unzipSync(new Uint8Array(readFileSync("public/downloads/gst-helper.zip")));
  const names = readdirSync("extensions/gst-helper").sort();
  assert.deepEqual(Object.keys(zip).sort(), names.map((n) => `gst-helper/${n}`), "run npm run zip:extension");
  for (const n of names) {
    assert.equal(strFromU8(zip[`gst-helper/${n}`]), readFileSync(`extensions/gst-helper/${n}`, "utf8"), `${n} is out of date: run npm run zip:extension`);
  }
});

test("the GST Helper Guide names the extension's current version", () => {
  const { version } = JSON.parse(readFileSync("extensions/gst-helper/manifest.json", "utf8"));
  assert.match(readFileSync("src/app/(app)/gst/guide/page.jsx", "utf8"), new RegExp(`HELPER_VERSION = "${version.replace(".", "\.")}"`));
});
