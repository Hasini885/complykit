import assert from "node:assert/strict";
import test from "node:test";

import { buildPortfolioReport } from "@/lib/portfolio/report";
import { computeClientHealth } from "@/lib/portfolio/health";
import { SEED_CLIENTS, SEED_DIRECTORS } from "@/lib/portfolio/sample-portfolio.fixture";

const asOf = new Date(2026, 9, 10); // 10 Oct 2026

test("the firm-wide report has one section per company, in the portfolio's order", () => {
  const r = buildPortfolioReport(SEED_CLIENTS, SEED_DIRECTORS, { asOf });
  assert.equal(r.scope, null);
  assert.equal(r.sections.length, SEED_CLIENTS.length);
  assert.equal(r.totals.companies, SEED_CLIENTS.length);
});

test("totals add up to every dated item, and exceptions are exactly overdue + due soon", () => {
  const r = buildPortfolioReport(SEED_CLIENTS, SEED_DIRECTORS, { asOf });
  const all = r.sections.flatMap((s) => s.items);
  const t = r.totals;
  assert.equal(t.overdue + t["due-soon"] + t.upcoming + t.completed, all.length);
  assert.equal(r.exceptions.length, t.overdue + t["due-soon"]);
  assert.ok(r.exceptions.every((e) => e.bucket === "overdue" || e.bucket === "due-soon"));
});

test("exceptions come most urgent first", () => {
  const r = buildPortfolioReport(SEED_CLIENTS, SEED_DIRECTORS, { asOf });
  const days = r.exceptions.map((e) => e.days);
  assert.deepEqual(days, [...days].sort((a, b) => a - b));
});

test("the report agrees with the portfolio page's health for every company", () => {
  const r = buildPortfolioReport(SEED_CLIENTS, SEED_DIRECTORS, { asOf });
  for (const s of r.sections) {
    const h = computeClientHealth(s.client, asOf, SEED_DIRECTORS);
    assert.equal(s.health.score, h.score, s.client.name);
    assert.equal(s.items.filter((i) => i.bucket === "overdue").length, h.overdue.length, s.client.name);
  }
});

test("in October the previous year's AOC-4 is in the report at its extended date", () => {
  const r = buildPortfolioReport(SEED_CLIENTS, SEED_DIRECTORS, { asOf });
  const meridian = r.sections.find((s) => s.client.id === "cl-meridian")!;
  const aoc = meridian.items.find((i) => i.item.source.id === "aoc-4" && i.item.fyEndingYear === 2026);
  assert.ok(aoc);
  assert.equal(aoc.item.due!.toDateString(), new Date(2026, 11, 31).toDateString(), "GC 05/2026");
  assert.equal(aoc.bucket, "upcoming", "more than 30 days away on 10 Oct");
  const later = buildPortfolioReport(SEED_CLIENTS, SEED_DIRECTORS, { asOf: new Date(2026, 11, 10) });
  const soon = later.sections
    .find((s) => s.client.id === "cl-meridian")!
    .items.find((i) => i.item.source.id === "aoc-4" && i.item.fyEndingYear === 2026)!;
  assert.equal(soon.bucket, "due-soon", "within 30 days of 31 Dec");
});

test("a recorded KYC filing shows as completed", () => {
  const r = buildPortfolioReport(SEED_CLIENTS, SEED_DIRECTORS, { asOf });
  const completed = r.sections.flatMap((s) => s.items).filter((i) => i.bucket === "completed");
  assert.ok(completed.length > 0);
  assert.ok(completed.every((i) => i.item.filedOn && i.item.source.id.startsWith("dir-3-kyc")));
});

test("each company section lists its current directors with their KYC status", () => {
  const r = buildPortfolioReport(SEED_CLIENTS, SEED_DIRECTORS, { asOf });
  const meridian = r.sections.find((s) => s.client.id === "cl-meridian")!;
  assert.ok(meridian.directors.length > 0);
  assert.ok(meridian.directors.every((d) => d.kyc !== null));
});

test("directors who missed an earlier KYC are listed once, with every company they sit on", () => {
  const r = buildPortfolioReport(SEED_CLIENTS, SEED_DIRECTORS, { asOf });
  const all = r.sections.flatMap((s) => s.directors).filter((d) => d.kyc?.state === "overdue");
  const ids = new Set(all.map((d) => d.director.id));
  assert.equal(r.kycExceptions.length, ids.size);
  for (const k of r.kycExceptions) {
    const onBoards = r.sections.filter((s) => s.directors.some((d) => d.director.id === k.director.id));
    assert.deepEqual(k.companies.map((c) => c.id), onBoards.map((s) => s.client.id));
  }
});

test("a single-client report covers only that client", () => {
  const r = buildPortfolioReport(SEED_CLIENTS, SEED_DIRECTORS, { asOf, clientId: "cl-satara" });
  assert.equal(r.scope?.id, "cl-satara");
  assert.equal(r.sections.length, 1);
  assert.ok(r.exceptions.every((e) => e.client.id === "cl-satara"));
});

test("an unknown client id or an empty portfolio gives an empty report, not a crash", () => {
  const missing = buildPortfolioReport(SEED_CLIENTS, SEED_DIRECTORS, { asOf, clientId: "nope" });
  assert.equal(missing.scope, null);
  assert.equal(missing.sections.length, 0, "not the whole firm by accident");
  const empty = buildPortfolioReport([], [], { asOf });
  assert.equal(empty.sections.length, 0);
  assert.equal(empty.totals.averageHealth, null);
});
