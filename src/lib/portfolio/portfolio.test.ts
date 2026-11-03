import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";

import { parseIsoDate, isoDate } from "@/lib/dates";
import {
  InMemoryPortfolioRepository,
  normalise,
} from "@/lib/portfolio/repository";
import { emptySnapshot, type Client, type Director } from "@/lib/portfolio/types";
import {
  applicabilityProfileFor,
  applyDraft,
  draftFrom,
  formEntityScopeFor,
  initials,
  newClient,
  sortClients,
  validateClient,
  type ClientDraft,
} from "@/lib/portfolio/clients";
import { evaluateApplicability } from "@/lib/applicability";
import {
  SECTION_165_PUBLIC_LIMIT,
  SECTION_165_TOTAL_LIMIT,
  activeDirectorships,
  clientsForDirector,
  countDirectorships,
  directorsForClient,
  financialYearEndYear,
  firstKycDueDate,
  kycDueDates,
  kycPending,
  kycStatus,
  onMultipleBoards,
  validateDirector,
} from "@/lib/portfolio/directors";
import { SEED_CLIENTS, SEED_DIRECTORS, seedSnapshot } from "@/lib/portfolio/sample-portfolio.fixture";
import { computeClientHealth } from "@/lib/portfolio/health";

const d = (s: string) => parseIsoDate(s)!;

/* ---------------- DIR-3 KYC: triennial cycle ---------------- */

test("financial year end year: April to March", () => {
  assert.equal(financialYearEndYear(d("2023-07-15")), 2024, "July 2023 is FY 2023-24");
  assert.equal(financialYearEndYear(d("2024-03-31")), 2024, "March 2024 closes FY 2023-24");
  assert.equal(financialYearEndYear(d("2024-04-01")), 2025, "April 2024 opens FY 2024-25");
  assert.equal(financialYearEndYear(d("2024-01-10")), 2024);
});

test("first KYC due date is 30 June after the third financial year", () => {
  // DIN allotted 15 Jul 2023 -> FY 2023-24, 2024-25, 2025-26 -> due 30 Jun 2026.
  assert.equal(isoDate(firstKycDueDate(d("2023-07-15"))), "2026-06-30");
  // Allotted in March 2024 is still FY 2023-24, so the same due date.
  assert.equal(isoDate(firstKycDueDate(d("2024-03-31"))), "2026-06-30");
  // One day later is the next financial year, pushing the cycle out a year.
  assert.equal(isoDate(firstKycDueDate(d("2024-04-01"))), "2027-06-30");
});

test("subsequent due dates fall every three years", () => {
  const dates = kycDueDates(d("2023-07-15"), 4).map(isoDate);
  assert.deepEqual(dates, ["2026-06-30", "2029-06-30", "2032-06-30", "2035-06-30"]);
});

function director(over: Partial<Director> = {}): Director {
  return {
    id: "d1",
    name: "Test Director",
    din: "12345678",
    dinAllottedOn: "2023-07-15",
    lastKycFiledOn: null,
    directorships: [],
    createdAt: "",
    updatedAt: "",
    ...over,
  };
}

test("KYC status: nothing filed and the due date has passed is overdue", () => {
  const s = kycStatus(director(), d("2026-09-03"))!;
  assert.equal(s.state, "overdue");
  assert.equal(isoDate(s.previousDueOn!), "2026-06-30");
  assert.equal(isoDate(s.dueOn), "2029-06-30", "the next due date is three years on");
  assert.equal(kycPending(director(), d("2026-09-03")), true);
});

test("KYC status: a filing after the last due date satisfies the current cycle", () => {
  const filed = director({ lastKycFiledOn: "2026-05-20" });
  const s = kycStatus(filed, d("2026-09-03"))!;
  assert.equal(s.state, "filed");
  assert.equal(kycPending(filed, d("2026-09-03")), false);
});

test("KYC status: a filing from a closed cycle does not count for the current one", () => {
  // DIN allotted Feb 2013 -> due 2015, 2018, 2021, 2024, 2027.
  // A filing in Jan 2020 covers the 2021 deadline, so the 2024 one stands unmet.
  const stale = director({ dinAllottedOn: "2013-02-19", lastKycFiledOn: "2020-01-01" });
  const s = kycStatus(stale, d("2026-09-03"))!;
  assert.equal(isoDate(s.previousDueOn!), "2024-06-30");
  assert.equal(s.state, "overdue");
  assert.equal(kycPending(stale, d("2026-09-03")), true);

  // Whereas a filing in Sep 2023 does cover that 2024 deadline.
  const covered = director({ dinAllottedOn: "2013-02-19", lastKycFiledOn: "2023-09-14" });
  assert.equal(kycStatus(covered, d("2026-09-03"))!.state, "filed");
});

test("KYC status: a newly allotted DIN is not yet due", () => {
  const fresh = director({ dinAllottedOn: "2026-08-01" });
  const s = kycStatus(fresh, d("2026-09-03"))!;
  assert.equal(s.state, "not-yet-due");
  assert.equal(isoDate(s.dueOn), "2029-06-30");
  assert.equal(kycPending(fresh, d("2026-09-03")), false, "nothing to chase yet");
});

test("KYC status: inside 90 days of the due date it reads as due, not overdue", () => {
  const s = kycStatus(director(), d("2026-05-01"))!;
  assert.equal(s.state, "due");
  assert.equal(isoDate(s.dueOn), "2026-06-30");
  assert.ok(s.daysUntilDue > 0 && s.daysUntilDue <= 90);
});

test("KYC status: filing early does not move the next due date", () => {
  // The cycle is anchored to DIN allotment, not to the filing.
  const early = director({ lastKycFiledOn: "2026-04-02" });
  const s = kycStatus(early, d("2026-05-01"))!;
  assert.equal(s.state, "filed");
  assert.equal(isoDate(s.dueOn), "2026-06-30", "still the same cycle");
  const after = kycStatus(early, d("2026-07-01"))!;
  assert.equal(isoDate(after.dueOn), "2029-06-30");
  assert.equal(after.state, "filed", "the 2026 filing carried the cycle");
});

test("KYC status: an unparseable allotment date yields null rather than throwing", () => {
  assert.equal(kycStatus(director({ dinAllottedOn: "not-a-date" })), null);
});

/* ---------------- Section 165 ---------------- */

function client(id: string, type: Client["type"]): Client {
  return {
    id,
    name: id,
    cin: id,
    type,
    incorporatedOn: "2020-01-01",
    registeredOffice: "x",
    status: "active",
    createdAt: "",
    updatedAt: "",
  };
}

test("directorship count separates public companies from the rest", () => {
  const clients = [client("a", "private"), client("b", "public"), client("c", "public")];
  const dir = director({
    directorships: [
      { clientId: "a", role: "Director", appointedOn: "2021-01-01" },
      { clientId: "b", role: "Director", appointedOn: "2021-01-01" },
      { clientId: "c", role: "Director", appointedOn: "2021-01-01" },
    ],
  });
  const count = countDirectorships(dir, clients);
  assert.equal(count.total, 3);
  assert.equal(count.public, 2);
  assert.equal(count.overAnyLimit, false);
});

test("Section 165 limits are 20 in total and 10 public", () => {
  assert.equal(SECTION_165_TOTAL_LIMIT, 20);
  assert.equal(SECTION_165_PUBLIC_LIMIT, 10);

  const many = Array.from({ length: 21 }, (_, i) => client(`c${i}`, "private"));
  const dir = director({
    directorships: many.map((c) => ({ clientId: c.id, role: "Director", appointedOn: "2021-01-01" })),
  });
  const count = countDirectorships(dir, many);
  assert.equal(count.total, 21);
  assert.equal(count.overTotalLimit, true, "21 exceeds 20");
  assert.equal(count.overAnyLimit, true);
});

test("the public-company limit bites before the total one", () => {
  const publics = Array.from({ length: 11 }, (_, i) => client(`p${i}`, "public"));
  const dir = director({
    directorships: publics.map((c) => ({
      clientId: c.id,
      role: "Director",
      appointedOn: "2021-01-01",
    })),
  });
  const count = countDirectorships(dir, publics);
  assert.equal(count.total, 11);
  assert.equal(count.overTotalLimit, false, "11 is within the 20 limit");
  assert.equal(count.overPublicLimit, true, "but 11 public exceeds 10");
  assert.equal(count.overAnyLimit, true);
});

test("exactly at the limit is not over it", () => {
  const twenty = Array.from({ length: 20 }, (_, i) => client(`c${i}`, "private"));
  const dir = director({
    directorships: twenty.map((c) => ({
      clientId: c.id,
      role: "Director",
      appointedOn: "2021-01-01",
    })),
  });
  assert.equal(countDirectorships(dir, twenty).overTotalLimit, false);
});

test("a ceased directorship stops counting from the cessation date", () => {
  const clients = [client("a", "private"), client("b", "private")];
  const dir = director({
    directorships: [
      { clientId: "a", role: "Director", appointedOn: "2021-01-01" },
      { clientId: "b", role: "Director", appointedOn: "2021-01-01", cessationOn: "2026-03-31" },
    ],
  });
  assert.equal(activeDirectorships(dir, d("2026-01-01")).length, 2, "before cessation");
  assert.equal(activeDirectorships(dir, d("2026-09-03")).length, 1, "after cessation");
  assert.equal(countDirectorships(dir, clients, d("2026-09-03")).total, 1);
});

test("a directorship pointing at an unknown client counts to the total, not to public", () => {
  const dir = director({
    directorships: [{ clientId: "ghost", role: "Director", appointedOn: "2021-01-01" }],
  });
  const count = countDirectorships(dir, []);
  assert.equal(count.total, 1);
  assert.equal(count.public, 0, "an unknown company cannot be assumed public");
});

/* ---------------- queries ---------------- */

test("seed portfolio wires directors to clients both ways", () => {
  const meridian = SEED_CLIENTS.find((c) => c.id === "cl-meridian")!;
  const onMeridian = directorsForClient(SEED_DIRECTORS, meridian.id).map((x) => x.name);
  assert.ok(onMeridian.includes("Ananya Raghavan"));
  assert.ok(onMeridian.includes("Farhan Qureshi"));

  const ananya = SEED_DIRECTORS.find((x) => x.name === "Ananya Raghavan")!;
  const herClients = clientsForDirector(ananya, SEED_CLIENTS).map((c) => c.id);
  assert.deepEqual(herClients.sort(), ["cl-meridian", "cl-satara", "cl-varsha"]);
});

test("multi-board directors are identified", () => {
  const names = onMultipleBoards(SEED_DIRECTORS).map((x) => x.name);
  assert.ok(names.includes("Ananya Raghavan"), "three boards");
  assert.ok(!names.includes("Leela Menon"), "only one board");
});

test("every seeded directorship points at a real seeded client", () => {
  const ids = new Set(SEED_CLIENTS.map((c) => c.id));
  for (const dir of SEED_DIRECTORS) {
    for (const ds of dir.directorships) {
      assert.ok(ids.has(ds.clientId), `${dir.name} points at unknown client ${ds.clientId}`);
    }
  }
});

/* ---------------- client validation ---------------- */

const validDraft: ClientDraft = {
  name: "Example Private Limited",
  cin: "U62099KA2019PTC128740",
  type: "private",
  incorporatedOn: "2019-07-18",
  registeredOffice: "Somewhere",
  status: "active",
  mobile: "98765 43210",
  email: "office@example.in",
};

test("a well-formed client passes validation", () => {
  assert.deepEqual(validateClient(validDraft, []), []);
});

test("CIN format is enforced, and LLPIN is accepted for an LLP", () => {
  const bad = validateClient({ ...validDraft, cin: "NOTACIN" }, []);
  assert.ok(bad.some((e) => e.field === "cin"));

  const llp = validateClient(
    { ...validDraft, type: "llp", cin: "AAB-4471" },
    [],
  );
  assert.deepEqual(llp, [], "an LLPIN is valid for an LLP");

  const llpWithCin = validateClient({ ...validDraft, type: "llp" }, []);
  assert.ok(llpWithCin.some((e) => e.field === "cin"), "a 21-char CIN is not an LLPIN");
});

test("duplicate CINs are rejected, but editing a client is not blocked by itself", () => {
  const existing = newClient(validDraft);
  const dupe = validateClient(validDraft, [existing]);
  assert.ok(dupe.some((e) => e.field === "cin" && /already uses/.test(e.message)));

  const selfEdit = validateClient(validDraft, [existing], existing.id);
  assert.deepEqual(selfEdit, [], "a client may keep its own CIN");
});

test("a future incorporation date is rejected", () => {
  const errors = validateClient({ ...validDraft, incorporatedOn: "2099-01-01" }, []);
  assert.ok(errors.some((e) => e.field === "incorporatedOn"));
});

test("draft round-trips through the record", () => {
  const created = newClient(validDraft);
  assert.deepEqual(draftFrom(created), {
    ...validDraft,
    mobile: "9876543210",
    email: "office@example.in",
    consultantId: null,
    authorisedDirectorId: null,
    pointOfContact: "authorised",
    adt1Srn: "",
    adt1FiledOn: null,
    authorisedCapital: 0,
    auditorType: undefined,
    firstAuditorAppointedOn: null,
    filesAdt1: true,
    filesInc20a: true,
    lastAgmOn: null,
    notes: "",
    listed: false,
    workingFyEndingYear: null,
    paidUpCapital: 0,
    turnover: 0,
    netWorth: 0,
    netProfit: 0,
    borrowings: 0,
    deposits: 0,
    llpContribution: 0,
    directorsCount: 0,
    msmeDuesOver45Days: false,
    securitiesInDemat: false,
    filesDpt3: false,
    transferPricing: false,
    auditorAppointedAtAgmFy: null,
    auditorTermYears: null,
  });

  const edited = applyDraft(created, { ...validDraft, name: "Renamed Private Limited" });
  assert.equal(edited.name, "Renamed Private Limited");
  assert.equal(edited.id, created.id, "identity survives an edit");
  assert.equal(edited.createdAt, created.createdAt);
});

test("a client's stored figures feed the Applicability Analyzer directly", () => {
  const rich = newClient({
    ...validDraft,
    listed: true,
    paidUpCapital: 20_00_00_000,
    turnover: 3_50_00_00_000,
    netWorth: 1_20_00_00_000,
    netProfit: 8_00_00_000,
    borrowings: 60_00_00_000,
    deposits: 1_00_00_000,
    msmeDuesOver45Days: true,
    securitiesInDemat: true,
  });
  const profile = applicabilityProfileFor(rich);
  assert.equal(profile.entityType, rich.type);
  assert.equal(profile.listed, true);
  assert.equal(profile.paidUpCapital, 20_00_00_000);
  assert.equal(profile.turnover, 3_50_00_00_000);
  assert.equal(profile.netWorth, 1_20_00_00_000);
  assert.equal(profile.netProfit, 8_00_00_000);
  assert.equal(profile.borrowings, 60_00_00_000);
  assert.equal(profile.deposits, 1_00_00_000);
  assert.equal(profile.msmeDuesOver45Days, true);
  assert.equal(profile.securitiesInDemat, true);
});

test("a client with no figures entered feeds an all-zero profile, not undefined", () => {
  const bare = newClient(validDraft);
  const profile = applicabilityProfileFor(bare);
  assert.equal(profile.paidUpCapital, 0);
  assert.equal(profile.listed, false);
  assert.doesNotThrow(() => evaluateApplicability(profile));
});

test("director validation enforces an 8-digit DIN and rejects duplicates", () => {
  const base = {
    name: "A Person",
    din: "12345678",
    dinAllottedOn: "2023-07-15",
    directorships: [],
  };
  assert.deepEqual(validateDirector(base, []), []);
  assert.ok(validateDirector({ ...base, din: "123" }, []).some((e) => e.field === "din"));
  assert.ok(validateDirector({ ...base, din: "abcdefgh" }, []).some((e) => e.field === "din"));

  const existing = SEED_DIRECTORS[0];
  assert.ok(
    validateDirector({ ...base, din: existing.din }, [existing]).some((e) => e.field === "din"),
  );
});

test("initials strip corporate suffixes", () => {
  assert.equal(initials("Meridian Analytics Private Limited"), "MA");
  assert.equal(initials("Satara Textiles Limited"), "ST");
  assert.equal(initials("Northline Logistics LLP"), "NL");
});

test("clients sort by name", () => {
  const sorted = sortClients(SEED_CLIENTS).map((c) => c.name);
  assert.deepEqual(sorted, [...sorted].sort((a, b) => a.localeCompare(b, "en-IN")));
});

/* ---------------- repository ---------------- */

test("repository round-trips clients and directors", async () => {
  const repo = new InMemoryPortfolioRepository(seedSnapshot());
  const before = await repo.load();
  assert.equal(before.clients.length, SEED_CLIENTS.length);

  const created = newClient({ ...validDraft, cin: "U11111KA2020PTC000001" });
  await repo.upsertClient(created);
  assert.equal((await repo.load()).clients.length, SEED_CLIENTS.length + 1);

  await repo.upsertClient({ ...created, name: "Changed Limited" });
  const after = await repo.load();
  assert.equal(after.clients.length, SEED_CLIENTS.length + 1, "upsert updates, not duplicates");
  assert.equal(after.clients.find((c) => c.id === created.id)!.name, "Changed Limited");
});

test("load returns a copy, so callers cannot mutate the store by accident", async () => {
  const repo = new InMemoryPortfolioRepository(seedSnapshot());
  const snap = await repo.load();
  snap.clients[0].name = "Mutated";
  assert.notEqual((await repo.load()).clients[0].name, "Mutated");
});

test("deleting a client removes its directorships and moves the active selection", async () => {
  const repo = new InMemoryPortfolioRepository(seedSnapshot());
  await repo.setActiveClientId("cl-meridian");
  await repo.deleteClient("cl-meridian");

  const snap = await repo.load();
  assert.ok(!snap.clients.some((c) => c.id === "cl-meridian"));
  assert.equal(
    snap.directors.flatMap((x) => x.directorships).filter((ds) => ds.clientId === "cl-meridian")
      .length,
    0,
    "no dangling directorships",
  );
  assert.equal(snap.activeClientId, null, "back to the all-companies view, not another company");
});

test("normalise repairs bad stored data instead of throwing", () => {
  assert.deepEqual(normalise(null), emptySnapshot());
  assert.deepEqual(normalise({}), emptySnapshot());

  const repaired = normalise({
    clients: [client("a", "private")],
    directors: [director({ directorships: [{ clientId: "gone", role: "D", appointedOn: "x" }] })],
    activeClientId: "does-not-exist",
    version: 1,
  });
  assert.equal(repaired.directors[0].directorships.length, 0, "dangling reference dropped");
  assert.equal(repaired.activeClientId, null, "a stale selection falls back to the all-companies view");
  assert.equal(
    normalise({ clients: [client("a", "private")], directors: [], activeClientId: null, version: 1 }).activeClientId,
    null,
    "choosing all companies survives a reload",
  );
});

test("formEntityScopeFor collapses every non-LLP type to company", () => {
  assert.equal(formEntityScopeFor("llp"), "llp");
  for (const t of ["private", "public", "opc", "section8"] as const) {
    assert.equal(formEntityScopeFor(t), "company");
  }
});

/* ---------------- seed data's financial figures do what they were chosen to do ---------------- */

test("seed: Satara (large listed public) triggers CSR, internal audit and independent directors", () => {
  const satara = SEED_CLIENTS.find((c) => c.id === "cl-satara")!;
  const profile = applicabilityProfileFor(satara);
  const results = evaluateApplicability(profile);
  const status = (id: string) => results.find((r) => r.id === id)!.status;

  assert.equal(profile.listed, true);
  assert.equal(status("csr"), "applicable", "net profit of 8cr crosses the 5cr trigger");
  assert.equal(status("internal-audit"), "applicable", "listed is always in");
  assert.equal(status("independent-directors"), "applicable", "listed public company");
  assert.equal(status("secretarial-audit"), "applicable");
});

test("seed: Meridian (small-ish private) stays below most thresholds", () => {
  const meridian = SEED_CLIENTS.find((c) => c.id === "cl-meridian")!;
  const profile = applicabilityProfileFor(meridian);
  const results = evaluateApplicability(profile);
  const status = (id: string) => results.find((r) => r.id === id)!.status;

  assert.equal(profile.listed, false);
  assert.equal(status("csr"), "not-applicable", "net profit of 41L is well under the 5cr trigger");
  assert.equal(status("woman-director"), "not-applicable", "private companies are never caught");
});

test("seed: Varsha is flagged for MSME-1, matching its stored checkbox", () => {
  const varsha = SEED_CLIENTS.find((c) => c.id === "cl-varsha")!;
  assert.equal(varsha.msmeDuesOver45Days, true);
  const results = evaluateApplicability(applicabilityProfileFor(varsha));
  assert.equal(results.find((r) => r.id === "msme-1")!.status, "applicable");
});

test("seed: every client's stored figures are non-negative", () => {
  for (const c of SEED_CLIENTS) {
    for (const key of [
      "paidUpCapital", "turnover", "netWorth", "netProfit", "borrowings", "deposits", "llpContribution", "directorsCount",
    ] as const) {
      const v = c[key];
      assert.ok(v === undefined || v >= 0, `${c.id}.${key} is negative`);
    }
  }
});

test("seed: Meridian and Satara re-appointed auditors at the FY 2024-25 AGM, so ADT-1 shows then and not the next year", () => {
  const meridian = SEED_CLIENTS.find((c) => c.id === "cl-meridian")!;
  const satara = SEED_CLIENTS.find((c) => c.id === "cl-satara")!;
  for (const c of [meridian, satara]) {
    const then = computeClientHealth(c, new Date(2025, 9, 1));
    const adt = then.dated.find((r) => r.source.id === "adt-1");
    assert.ok(adt, `${c.name}: ADT-1 is due after the AGM that appointed the auditor`);
    assert.equal(adt.fyEndingYear, 2025);
    const nextYear = computeClientHealth(c, new Date(2026, 8, 3));
    assert.ok(!nextYear.dated.some((r) => r.source.id === "adt-1"), "not again until the five-year term ends");
  }
});

/* ---------------- no auto-seed on fresh storage (regression) ---------------- */

test("a repository with no initial snapshot loads as genuinely empty", async () => {
  const repo = new InMemoryPortfolioRepository();
  const loaded = await repo.load();
  assert.deepEqual(loaded.clients, []);
  assert.deepEqual(loaded.directors, []);
  assert.equal(loaded.activeClientId, null);
});

test("load() never writes -- calling it repeatedly on empty storage stays empty", async () => {
  const repo = new InMemoryPortfolioRepository();
  await repo.load();
  await repo.load();
  const loaded = await repo.load();
  assert.equal(loaded.clients.length, 0, "load() must be read-only, never a side-effecting seed");
});

test("no app code imports the test portfolio, so no sample data ships to users", () => {
  // An earlier version wrote this portfolio into storage on first load, and
  // later kept a reset-to-sample action. Only tests may use it now.
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$|\.fixture\.ts$/.test(entry.name)) {
        if (readFileSync(path, "utf-8").includes("sample-portfolio.fixture")) offenders.push(path);
      }
    }
  };
  walk("src");
  assert.deepEqual(offenders, []);
});

test("clearAll() removes every company and director, and clears the active selection", async () => {
  const repo = new InMemoryPortfolioRepository(seedSnapshot());
  const before = await repo.load();
  assert.ok(before.clients.length > 0 && before.directors.length > 0, "fixture must be non-empty");

  await repo.replaceAll(emptySnapshot());

  const after = await repo.load();
  assert.deepEqual(after.clients, []);
  assert.deepEqual(after.directors, []);
  assert.equal(after.activeClientId, null, "a stale active id would break the switcher");
});
