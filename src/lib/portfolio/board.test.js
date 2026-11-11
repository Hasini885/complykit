import assert from "node:assert/strict";
import test from "node:test";

import {
  boardChanges,
  boardFor,
  boardSizeProblem,
  followIncorporation,
  placeOnBoard,
  validateBoardEntry,
} from "@/lib/portfolio/board";
import { newClient } from "@/lib/portfolio/clients";
import { dir12ItemsFor } from "@/lib/portfolio/schedule";
import {
  allDins,
  applyDirectorDraft,
  dinAt,
  kycStatus,
  newDirector,
  validateDirector,
} from "@/lib/portfolio/directors";

const asOf = new Date(2026, 9, 31);

function draft(name, din, clientIds = []) {
  return {
    name,
    din,
    dinAllottedOn: "2020-05-01",
    directorships: clientIds.map((clientId) => ({ clientId, role: "Director", appointedOn: "2021-01-01" })),
  };
}

test("the board lists the company's current directors only", () => {
  const a = newDirector(draft("Asha", "12345678", ["c1", "c2"]));
  const b = newDirector(draft("Bala", "23456789", ["c2"]));
  assert.deepEqual(
    boardFor("c1", [a, b], asOf).map((e) => e.directorId),
    [a.id],
  );
  assert.deepEqual(boardFor(null, [a, b], asOf), [], "a new company has no board yet");
});

test("a director added in the form joins this company's board when it is saved", () => {
  const entries = [{ key: "k1", directorId: null, draft: draft("Chitra", "34567890"), dirty: true }];
  const [change] = boardChanges("new-co", entries, [], [], asOf);
  assert.equal(change.kind, "add");
  assert.deepEqual(
    change.draft.directorships.map((d) => d.clientId),
    ["new-co"],
  );
});

test("editing a director keeps their other boards; removing takes off only this one", () => {
  const a = newDirector(draft("Asha", "12345678", ["c1", "c2"]));
  const edited = {
    key: a.id,
    directorId: a.id,
    draft: { ...draft("Asha R", "12345678"), directorships: [] },
    dirty: true,
  };
  const [upd] = boardChanges("c1", [edited], [], [a], asOf);
  assert.equal(upd.kind, "update");
  assert.equal(upd.draft.name, "Asha R");
  assert.deepEqual(upd.draft.directorships.map((d) => d.clientId).sort(), ["c1", "c2"]);

  const [removed] = boardChanges("c1", [], [a.id], [a], asOf);
  assert.deepEqual(
    removed.draft.directorships.map((d) => d.clientId),
    ["c2"],
  );
});

test("an existing director put on this board gets a seat; untouched ones are not re-saved", () => {
  const a = newDirector(draft("Asha", "12345678", ["c2"]));
  const b = newDirector(draft("Bala", "23456789", ["c1"]));
  const entries = [
    { key: a.id, directorId: a.id, draft: draft("Asha", "12345678", ["c2"]), dirty: false },
    ...boardFor("c1", [a, b], asOf),
  ];
  const changes = boardChanges("c1", entries, [], [a, b], asOf);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].kind === "update" && changes[0].id, a.id);
  assert.deepEqual(changes[0].draft.directorships.map((d) => d.clientId).sort(), ["c1", "c2"]);
});

test("two directors in the form cannot share a DIN", () => {
  const entries = [{ key: "k1", directorId: null, draft: draft("Chitra", "34567890"), dirty: true }];
  const errors = validateBoardEntry(draft("Dev", "34567890"), "k2", null, entries, []);
  assert.ok(errors.some((e) => e.field === "din"));
  assert.deepEqual(validateBoardEntry(draft("Dev", "45678901"), "k2", null, entries, []), []);
});

test("a DIN already saved is the same director: linked here, with their other boards kept", () => {
  const asha = newDirector(draft("Asha", "12345678", ["c2"]));
  let n = 0;
  const key = () => `k${++n}`;
  const placed = placeOnBoard([], "new", draft("A. Rao (typed again)", "12345678"), [asha], key);
  assert.deepEqual(placed.errors, []);
  assert.equal(placed.linked?.id, asha.id);
  assert.equal(placed.entries[0].directorId, asha.id);
  assert.equal(placed.entries[0].draft.name, "ASHA", "the saved record is kept, not a second copy");

  const [change] = boardChanges("c1", placed.entries, [], [asha], asOf);
  assert.equal(change.kind, "update");
  assert.deepEqual(change.draft.directorships.map((d) => d.clientId).sort(), ["c1", "c2"]);

  const twice = placeOnBoard(placed.entries, "new", draft("Asha", "12345678"), [asha], key);
  assert.ok(
    twice.errors.some((e) => e.field === "din"),
    "the same person cannot sit twice on one board",
  );

  const fresh = placeOnBoard([], "new", draft("Bala", "23456789"), [asha], key);
  assert.equal(fresh.linked, null);
  assert.equal(fresh.entries[0].directorId, null);
});

test("one director, a different DIN at each company", () => {
  // Harish sits on c2 under his main DIN; at c1 the form records another one.
  const harish = newDirector(draft("Harish", "12345678", ["c2"]));
  let n = 0;
  const placed = placeOnBoard([], "new", draft("Harish", "12345678"), [harish], () => `k${++n}`);
  const entry = placed.entries[0];
  const edited = { ...entry, draft: { ...entry.draft, din: "87654321" }, dirty: true };
  const [change] = boardChanges("c1", [edited], [], [harish], asOf);
  assert.equal(change.kind, "update");
  assert.equal(change.draft.din, "12345678", "the main DIN stays");
  const updated = applyDirectorDraft(harish, change.draft);
  assert.equal(dinAt(updated, "c1"), "87654321");
  assert.equal(dinAt(updated, "c2"), "12345678");
  assert.deepEqual(allDins(updated), ["12345678", "87654321"]);
  assert.equal(boardFor("c1", [updated], asOf)[0].draft.din, "87654321", "the form shows this company's DIN");

  // Either DIN identifies him, so typing it again links him rather than duplicating.
  const again = placeOnBoard([], "new", draft("H. Earu", "87654321"), [updated], () => "x");
  assert.equal(again.linked?.id, harish.id);

  // Nobody else may hold either DIN.
  assert.ok(validateDirector(draft("Someone", "87654321"), [updated]).some((e) => e.field === "din"));
});

test("cessation: saved on this company's seat only, and DIR-12 falls 30 days later", () => {
  const asha = newDirector(draft("Asha", "12345678", ["c1", "c2"]));
  const [entry] = boardFor("c1", [asha], asOf);
  const ceasing = {
    ...entry,
    dirty: true,
    seat: { appointedOn: "2021-01-01", cessationOn: "2026-10-10", cessationReason: "resignation" },
  };
  const [change] = boardChanges("c1", [ceasing], [], [asha], asOf);
  const updated = applyDirectorDraft(asha, change.draft);
  const c1 = updated.directorships.find((d) => d.clientId === "c1");
  const c2 = updated.directorships.find((d) => d.clientId === "c2");
  assert.equal(c1.cessationOn, "2026-10-10");
  assert.equal(c1.cessationReason, "resignation");
  assert.equal(c2.cessationOn ?? null, null, "still a director of the other company");

  const company = {
    ...newClient({
      name: "Co",
      cin: "U62099KA2019PTC128740",
      type: "private",
      incorporatedOn: "2019-07-18",
      registeredOffice: "X",
      status: "active",
      mobile: "9876543210",
    }),
    id: "c1",
  };
  const [dir12] = dir12ItemsFor(company, [updated], 2027, "private");
  assert.equal(dir12.source.formCode, "DIR-12");
  assert.equal(dir12.due?.toDateString(), new Date(2026, 10, 9).toDateString(), "30 days after 10 Oct 2026");
  assert.equal(dir12ItemsFor(company, [updated], 2026, "private").length, 0, "only in the year of cessation");
  assert.equal(dir12ItemsFor(company, [updated], 2027, "llp").length, 0, "an LLP files Form 4 instead");

  // A ceased director stays on the company's list, after those in office.
  const bala = newDirector(draft("Bala", "23456789", ["c1"]));
  assert.deepEqual(
    boardFor("c1", [updated, bala], asOf).map((e) => e.draft.name),
    ["BALA", "ASHA"],
  );
});

test("a cessation before the appointment is refused", () => {
  const bad = {
    ...draft("Asha", "12345678"),
    directorships: [{ clientId: "c1", role: "Director", appointedOn: "2024-05-01", cessationOn: "2024-04-01" }],
  };
  assert.ok(validateDirector(bad, []).some((e) => e.field === "directorships"));
});

test("the DIN allotment date is optional; without it there is simply no KYC date", () => {
  const noDate = { ...draft("Asha", "12345678", ["c1"]), dinAllottedOn: "" };
  assert.deepEqual(validateDirector(noDate, []), []);
  assert.ok(validateDirector({ ...noDate, dinAllottedOn: "2024-02-31" }, []).some((e) => e.field === "dinAllottedOn"));
  assert.equal(kycStatus(newDirector(noDate)), null);
});

test("minimum directors in office: 2 (private), 3 (public), 1 (OPC); ceased ones do not count", () => {
  const one = newDirector(draft("Asha", "12345678", ["c1"]));
  const two = newDirector(draft("Bala", "23456789", ["c1"]));
  const board = boardFor("c1", [one, two], asOf);
  assert.equal(boardSizeProblem("private", board, asOf), null);
  assert.match(boardSizeProblem("public", board, asOf) ?? "", /at least 3 directors/);
  assert.equal(boardSizeProblem("opc", board.slice(0, 1), asOf), null);
  assert.match(boardSizeProblem("private", board.slice(0, 1), asOf) ?? "", /at least 2 directors.*has 1/);

  const ceased = [{ ...board[0], seat: { appointedOn: "2021-01-01", cessationOn: "2026-01-01" } }, board[1]];
  assert.ok(boardSizeProblem("private", ceased, asOf), "a ceased director does not count");
  const leavingLater = [{ ...board[0], seat: { appointedOn: "2021-01-01", cessationOn: "2027-01-01" } }, board[1]];
  assert.equal(boardSizeProblem("private", leavingLater, asOf), null, "still in office until the date comes");
});

test("appointments made on the day of incorporation follow a change to that date", () => {
  const entries = [
    {
      key: "a",
      directorId: null,
      draft: draft("Asha", "12345678"),
      dirty: true,
      seat: { appointedOn: "2025-04-10", cessationOn: null },
    },
    {
      key: "b",
      directorId: null,
      draft: draft("Bala", "23456789"),
      dirty: true,
      seat: { appointedOn: "2025-09-01", cessationOn: null },
    },
  ];
  const moved = followIncorporation(entries, "2025-04-10", "2025-04-12");
  assert.equal(moved[0].seat?.appointedOn, "2025-04-12");
  assert.equal(moved[1].seat?.appointedOn, "2025-09-01", "a later appointment is left alone");
  assert.equal(followIncorporation(entries, "", "2025-04-12"), entries);
});

test("director names are kept in capitals, however they are typed", () => {
  assert.equal(newDirector(draft("  harish   earu ", "12345678")).name, "HARISH EARU");
  const saved = applyDirectorDraft(newDirector(draft("Asha", "12345678")), draft("asha rao", "12345678"));
  assert.equal(saved.name, "ASHA RAO");
});
