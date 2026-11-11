import assert from "node:assert/strict";
import test from "node:test";

import { newClient } from "@/lib/portfolio/clients";
import { newConsultant } from "@/lib/portfolio/consultants";
import { newDirector } from "@/lib/portfolio/directors";
import {
  createMasterDataPdf,
  createMasterDataXlsx,
  directorAt,
  directorsText,
  masterColumns,
  masterDataRows,
} from "@/lib/portfolio/master-data";

const asOf = new Date(2026, 10, 1);
const priya = { ...newConsultant({ name: "CA Priya Sharma", mobile: "9123456789" }), id: "priya" };
const igpl = {
  ...newClient({
    name: "IGPL Groups Private Limited",
    cin: "U56290TS2025PTC208500",
    type: "private",
    incorporatedOn: "2025-04-10",
    registeredOffice: "Hyderabad",
    status: "active",
    mobile: "9876543210",
    email: "office@igpl.in",
    consultantId: "priya",
  }),
  id: "igpl",
};
const plain = {
  ...newClient({ ...igpl, name: "Plain Pvt Ltd", cin: "U62099KA2019PTC128740", email: "", consultantId: null }),
  id: "plain",
};
const harish = newDirector({
  name: "Harish Earu",
  din: "12345678",
  dinAllottedOn: "2020-01-01",
  directorships: [{ clientId: "igpl", role: "Director", appointedOn: "2025-04-10", din: "87654321" }],
});
const left = newDirector({
  name: "Former Director",
  din: "23456789",
  dinAllottedOn: "2020-01-01",
  directorships: [{ clientId: "igpl", role: "Director", appointedOn: "2025-04-10", cessationOn: "2026-05-01" }],
});

test("one row per company: contact, consultant and directors in office", () => {
  const [row, other] = masterDataRows([igpl, plain], [harish, left], [priya], asOf);
  assert.equal(row.mobile, "98765 43210");
  assert.equal(row.email, "office@igpl.in");
  assert.equal(row.consultantName, "CA Priya Sharma");
  assert.equal(row.consultantMobile, "91234 56789");
  assert.deepEqual(
    row.directors,
    [{ name: "HARISH EARU", din: "87654321" }],
    "the DIN at this company; ceased directors left out",
  );
  assert.equal(directorsText(row), "HARISH EARU (DIN 87654321)");
  assert.equal(other.consultantName, "");
  assert.deepEqual(other.directors, []);
});

test("the download is a real .xlsx of every company", async () => {
  const bytes = new Uint8Array(
    await (await createMasterDataXlsx(masterDataRows([igpl, plain], [harish], [priya], asOf), asOf)).arrayBuffer(),
  );
  assert.equal(String.fromCharCode(bytes[0], bytes[1]), "PK");
});

test("the PDF download is a real PDF of every company", async () => {
  const bytes = new Uint8Array(
    await (await createMasterDataPdf(masterDataRows([igpl, plain], [harish], [priya], asOf), asOf)).arrayBuffer(),
  );
  assert.equal(String.fromCharCode(...bytes.slice(0, 5)), "%PDF-");
});

test("one Director column per director: as many as the company with the most has", () => {
  const rows = masterDataRows([igpl, plain], [harish], [priya], asOf);
  const headers = masterColumns(rows).map((c) => c.header);
  assert.deepEqual(
    headers.filter((h) => h.startsWith("Director")),
    ["Director 1"],
  );
  assert.equal(directorAt(rows[0], 0), "HARISH EARU (DIN 87654321)");
  assert.equal(directorAt(rows[1], 0), "", "a company with fewer directors leaves the cell blank");
  const none = masterColumns(masterDataRows([plain], [], [priya], asOf)).map((c) => c.header);
  assert.ok(!none.some((h) => h.startsWith("Director")), "no directors yet, no director columns");

  const many = [1, 2, 3].map((n) =>
    newDirector({
      name: `Director ${n}`,
      din: `1000000${n}`,
      dinAllottedOn: "2020-01-01",
      directorships: [{ clientId: "igpl", role: "Director", appointedOn: "2025-04-10" }],
    }),
  );
  const wide = masterColumns(masterDataRows([igpl], many, [priya], asOf)).map((c) => c.header);
  assert.deepEqual(wide.slice(-3), ["Director 1", "Director 2", "Director 3"]);
});
