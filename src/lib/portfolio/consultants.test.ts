import assert from "node:assert/strict";
import test from "node:test";

import { newClient, validateClient, type ClientDraft } from "@/lib/portfolio/clients";
import {
  assignmentChanges,
  clientsForConsultant,
  companiesToLink,
  consultantToAdd,
  consultantOf,
  newConsultant,
  resolveReference,
  validateConsultant,
} from "@/lib/portfolio/consultants";
import { InMemoryPortfolioRepository, normalise } from "@/lib/portfolio/repository";
import { resolveClientYear } from "@/lib/portfolio/schedule";
import { SEED_CLIENTS, SEED_DIRECTORS } from "@/lib/portfolio/sample-portfolio.fixture";

const draft: ClientDraft = {
  name: "Example Private Limited",
  cin: "U62099KA2019PTC128740",
  type: "private",
  incorporatedOn: "2019-07-18",
  registeredOffice: "Bengaluru",
  status: "active",
  mobile: "9123456789",
  email: "accounts@example.in",
};

test("a consultant needs a name and a valid mobile, unique across the master", () => {
  assert.deepEqual(validateConsultant({ name: "CA Priya", mobile: "+91 98765 43210" }, []), []);
  const fields = validateConsultant({ name: "", mobile: "12345" }, []).map((e) => e.field);
  assert.deepEqual(fields.sort(), ["mobile", "name"]);
  const first = newConsultant({ name: "CA Priya", mobile: "9876543210" });
  assert.equal(first.mobile, "9876543210");
  const dup = validateConsultant({ name: "Someone else", mobile: "098765 43210" }, [first]);
  assert.ok(dup.some((e) => e.field === "mobile"), "the same mobile twice is refused");
  assert.deepEqual(validateConsultant({ name: "CA Priya", mobile: "9876543210" }, [first], first.id), []);
});

test("a company's mobile is required and must be valid", () => {
  assert.deepEqual(validateClient(draft, []), []);
  assert.ok(validateClient({ ...draft, mobile: "" }, []).some((e) => e.field === "mobile"));
  assert.ok(validateClient({ ...draft, mobile: "12345" }, []).some((e) => e.field === "mobile"));
  assert.equal(newClient({ ...draft, mobile: "+91 91234 56789" }).mobile, "9123456789");
});

test("a company names its consultant as reference, and deleting the consultant clears it", async () => {
  const consultant = newConsultant({ name: "CA Priya", mobile: "9876543210" });
  const client = newClient({ ...draft, consultantId: consultant.id });
  assert.equal(consultantOf(client, [consultant])?.name, "CA Priya");
  assert.deepEqual(clientsForConsultant(consultant.id, [client]).map((c) => c.id), [client.id]);

  const repo = new InMemoryPortfolioRepository(
    normalise({ clients: [client], directors: [], consultants: [consultant] }),
  );
  await repo.deleteConsultant(consultant.id);
  const after = await repo.load();
  assert.equal(after.consultants.length, 0);
  assert.equal(after.clients[0].consultantId, null);
});

test("older saves without a consultant master load with an empty one", () => {
  const snap = normalise({ clients: [newClient({ ...draft, consultantId: "gone" })], directors: [] });
  assert.deepEqual(snap.consultants, []);
  assert.equal(snap.clients[0].consultantId, null, "a reference to a missing consultant is dropped");
});

function formsFor(client: (typeof SEED_CLIENTS)[number], fy: number): string[] {
  return resolveClientYear(client, SEED_DIRECTORS, fy, { asOf: new Date(2026, 9, 31) }).map((i) => i.source.id);
}

test("INC-20A cannot be switched off, but unticking DPT-3 removes that due", () => {
  // A company incorporated recently, in its first year: INC-20A and the first ADT-1 both apply.
  const fresh = newClient({ ...draft, incorporatedOn: "2026-09-01", filesDpt3: true });
  const fy = 2027;
  const on = formsFor(fresh, fy);
  assert.ok(on.some((id) => id.startsWith("inc-20a")), `INC-20A expected in ${on.join(", ")}`);
  assert.ok(on.some((id) => id.startsWith("adt-1") || id.startsWith("first-auditor")), "ADT-1 expected");
  assert.ok(on.some((id) => id.startsWith("dpt-3")), "DPT-3 expected");

  // An older save may still hold filesInc20a: false; it must be ignored.
  const olderSave = { ...fresh, filesInc20a: false, filesDpt3: false };
  const off = formsFor(olderSave, fy);
  assert.ok(off.some((id) => id.startsWith("inc-20a")), `INC-20A expected in ${off.join(", ")}`);
  assert.ok(!off.some((id) => id.startsWith("dpt-3")), `dpt-3 should be gone: ${off.join(", ")}`);
});

test("the Reference section: pick one, type a new one, or reuse one by mobile", () => {
  const priya = newConsultant({ name: "CA Priya", mobile: "9876543210" });
  assert.deepEqual(resolveReference({ mode: "none" }, [priya]), { consultantId: null, create: null, errors: [] });
  assert.equal(resolveReference({ mode: "existing", consultantId: priya.id }, [priya]).consultantId, priya.id);

  const fresh = resolveReference({ mode: "new", name: "CS Ravi", mobile: "91234 56789" }, [priya]);
  assert.deepEqual(fresh.create, { name: "CS Ravi", mobile: "91234 56789" });
  assert.equal(fresh.consultantId, null);

  const again = resolveReference({ mode: "new", name: "Priya S", mobile: "+91 98765 43210" }, [priya]);
  assert.equal(again.consultantId, priya.id, "the same mobile is the same consultant");
  assert.equal(again.create, null);

  const bad = resolveReference({ mode: "new", name: "", mobile: "123" }, [priya]);
  assert.equal(bad.create, null);
  assert.ok(bad.errors.length >= 2);
});

test("a consultant's companies: ticked ones move to them, unticked ones are cleared", () => {
  const a = { ...newClient(draft), id: "a", consultantId: "priya" };
  const b = { ...newClient(draft), id: "b", consultantId: "ravi" };
  const c = { ...newClient(draft), id: "c", consultantId: null };
  assert.deepEqual(assignmentChanges("priya", ["b", "c"], [a, b, c]), [
    { clientId: "a", consultantId: null },
    { clientId: "b", consultantId: "priya" },
    { clientId: "c", consultantId: "priya" },
  ]);
  assert.deepEqual(assignmentChanges("priya", ["a"], [a, b, c]), [], "nothing to change");
});

test("company master data: email is required and checked, and paid-up cannot exceed authorised capital", () => {
  assert.ok(validateClient({ ...draft, email: "" }, []).some((e) => e.field === "email"), "email is mandatory");
  assert.ok(validateClient({ ...draft, email: "not-an-email" }, []).some((e) => e.field === "email"));
  assert.deepEqual(validateClient({ ...draft, email: "office@example.in" }, []), []);
  const over = validateClient({ ...draft, authorisedCapital: 100000, paidUpCapital: 500000 }, []);
  assert.ok(over.some((e) => e.field === "paidUpCapital"));
  assert.deepEqual(validateClient({ ...draft, authorisedCapital: 1000000, paidUpCapital: 100000 }, []), []);
  const saved = newClient({ ...draft, email: " office@example.in ", authorisedCapital: 1000000 });
  assert.equal(saved.email, "office@example.in");
  assert.equal(saved.authorisedCapital, 1000000);
});

test("first auditor: ADT-1 falls 15 days after the Board meeting, in that year only", () => {
  const co = newClient({
    ...draft,
    incorporatedOn: "2026-06-01",
    auditorType: "first",
    firstAuditorAppointedOn: "2026-06-20",
    filesAdt1: false, // ignored: ADT-1 applies to every company
  });
  assert.equal(co.filesAdt1, true);
  const items = resolveClientYear(co, [], 2027, { asOf: new Date(2026, 9, 31) });
  const first = items.find((i) => i.source.id === "first-auditor");
  assert.ok(first, "the first auditor's ADT-1 is listed");
  assert.equal(first.source.title, "File ADT-1 for the first auditor");
  assert.equal(first.due?.toDateString(), new Date(2026, 6, 5).toDateString());
  const nextYear = resolveClientYear(co, [], 2028, { asOf: new Date(2026, 9, 31) });
  assert.ok(!nextYear.some((i) => i.source.id === "first-auditor"));
  assert.ok(validateClient({ ...draft, incorporatedOn: "2026-06-01", auditorType: "first", firstAuditorAppointedOn: "2026-05-01" }, [])
    .some((e) => e.field === "firstAuditorAppointedOn"), "not before incorporation");
});

test("a consultant named as a director's authorised person goes into the consultant master once", () => {
  const priya = newConsultant({ name: "CA Priya", mobile: "9876543210" });
  assert.deepEqual(
    consultantToAdd({ isAuthorisedPerson: false, consultantName: " CS Ravi ", consultantMobile: "91234 56789" }, [priya]),
    { name: "CS Ravi", mobile: "9123456789" },
  );
  assert.equal(consultantToAdd({ isAuthorisedPerson: false, consultantName: "Priya S", consultantMobile: "9876543210" }, [priya]), null, "already there by mobile");
  assert.equal(consultantToAdd({ isAuthorisedPerson: true }, [priya]), null, "the director is the authorised person");
  assert.equal(consultantToAdd({ isAuthorisedPerson: false, consultantName: "X", consultantMobile: "123" }, [priya]), null);
});

test("a director's consultant becomes the reference of their companies that have none", () => {
  const free = { ...newClient(draft), id: "free", consultantId: null };
  const taken = { ...newClient(draft), id: "taken", consultantId: "someone" };
  const left = { ...newClient(draft), id: "left", consultantId: null };
  const director = {
    isAuthorisedPerson: false,
    directorships: [{ clientId: "free" }, { clientId: "taken" }, { clientId: "left", cessationOn: "2026-01-01" }],
  };
  assert.deepEqual(companiesToLink(director, [free, taken, left]), ["free"]);
  assert.deepEqual(companiesToLink({ ...director, isAuthorisedPerson: true }, [free]), []);
});
