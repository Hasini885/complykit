import { newId } from "@/lib/portfolio/clients";
import { MOBILE_ERROR, normaliseMobile } from "@/lib/portfolio/mobile";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateConsultant(draft, existing, id) {
  const errors = [];
  const name = draft.name.trim();
  if (name === "") errors.push({ field: "name", message: "Enter the consultant's name." });
  if (name.length > 120) errors.push({ field: "name", message: "That name is too long." });

  const mobile = normaliseMobile(draft.mobile);
  if (draft.mobile.trim() === "") {
    errors.push({ field: "mobile", message: "Enter the consultant's mobile number." });
  } else if (!mobile) {
    errors.push({ field: "mobile", message: MOBILE_ERROR });
  } else if (existing.some((c) => c.id !== id && c.mobile === mobile)) {
    // One person, one record: a second entry would split their companies.
    errors.push({ field: "mobile", message: "Another consultant already has that mobile number." });
  }

  const email = draft.email?.trim() ?? "";
  if (email !== "" && !EMAIL.test(email)) {
    errors.push({ field: "email", message: "That email address is not valid." });
  }
  return errors;
}

export function newConsultant(draft, now = new Date()) {
  const iso = now.toISOString();
  return { id: newId(), ...fields(draft), createdAt: iso, updatedAt: iso };
}

export function applyConsultantDraft(consultant, draft, now = new Date()) {
  return { ...consultant, ...fields(draft), updatedAt: now.toISOString() };
}

export function consultantDraftFrom(c) {
  return { name: c.name, mobile: c.mobile, email: c.email ?? "", firm: c.firm ?? "" };
}

function fields(draft) {
  return {
    name: draft.name.trim(),
    mobile: normaliseMobile(draft.mobile),
    email: draft.email?.trim() || undefined,
    firm: draft.firm?.trim() || undefined,
  };
}

/** The companies that name this consultant as their reference. */
export function clientsForConsultant(consultantId, clients) {
  return clients.filter((c) => c.consultantId === consultantId);
}

/** The consultant a company names, or null when none (or a deleted one). */
export function consultantOf(client, consultants) {
  return client.consultantId ? (consultants.find((c) => c.id === client.consultantId) ?? null) : null;
}

export function sortConsultants(consultants) {
  return [...consultants].sort((a, b) => a.name.localeCompare(b.name, "en-IN"));
}

/**
 * Works out what saving the Reference section means. A "new" consultant whose
 * mobile is already in the master is that consultant, so it is reused rather
 * than entered twice.
 */
export function resolveReference(input, consultants) {
  if (input.mode === "none") return { consultantId: null, create: null, errors: [] };
  if (input.mode === "existing") {
    const found = consultants.some((c) => c.id === input.consultantId);
    return found
      ? { consultantId: input.consultantId, create: null, errors: [] }
      : { consultantId: null, create: null, errors: [{ field: "name", message: "Choose a consultant." }] };
  }
  const mobile = normaliseMobile(input.mobile);
  const same = mobile ? consultants.find((c) => c.mobile === mobile) : undefined;
  if (same) return { consultantId: same.id, create: null, errors: [] };
  const draft = { name: input.name, mobile: input.mobile };
  const errors = validateConsultant(draft, consultants);
  return { consultantId: null, create: errors.length === 0 ? draft : null, errors };
}

/**
 * Companies to re-point when a consultant's list of companies is saved: the
 * ticked ones point at this consultant (a company has one reference, so it
 * moves from any other), the unticked ones that pointed here are cleared.
 */
export function assignmentChanges(consultantId, selectedIds, clients) {
  const selected = new Set(selectedIds);
  const changes = [];
  for (const c of clients) {
    const here = c.consultantId === consultantId;
    if (selected.has(c.id) && !here) changes.push({ clientId: c.id, consultantId });
    else if (!selected.has(c.id) && here) changes.push({ clientId: c.id, consultantId: null });
  }
  return changes;
}

/**
 * A consultant named as a director's authorised person (in the company's
 * Directors section or the Director Master) belongs in the consultant master
 * too. Returns the consultant to add, or null when there is none to add: the
 * director is the authorised person, the details are incomplete or invalid,
 * or a consultant with that mobile is already in the master.
 */
export function consultantToAdd(director, consultants) {
  if (director.isAuthorisedPerson !== false) return null;
  const name = director.consultantName?.trim() ?? "";
  const mobile = normaliseMobile(director.consultantMobile ?? "");
  if (!name || !mobile) return null;
  if (consultants.some((c) => c.mobile === mobile)) return null;
  return { name, mobile };
}

/**
 * The companies to point at a director's consultant: every company the
 * director sits on (in office) that has no consultant yet. A company that
 * already names a different consultant keeps it.
 */
export function companiesToLink(director, clients) {
  if (director.isAuthorisedPerson !== false) return [];
  const seats = new Set(director.directorships.filter((ds) => !ds.cessationOn).map((ds) => ds.clientId));
  return clients.filter((c) => seats.has(c.id) && !c.consultantId).map((c) => c.id);
}
