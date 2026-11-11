import { validateClient } from "@/lib/portfolio/clients";
import { boardSizeProblem, inOffice } from "@/lib/portfolio/board";
import { resolveReference } from "@/lib/portfolio/consultants";
/**
 * The company form, as four steps filled in order: Master data, Directors,
 * Consultant, Applicability of special forms. Each step is checked before the
 * next opens (Next), and all of them before saving (Finish). Pure, so the
 * rules are tested without the form.
 */

export const COMPANY_STEPS = ["master", "directors", "consultant", "forms"];
/** A "new" consultant left blank counts as no consultant. */
export function effectiveReference(ref) {
  return ref.mode === "new" && !ref.name.trim() && !ref.mobile.trim() ? { mode: "none" } : ref;
}

export function stepErrors(step, input) {
  const errors = {};
  const { draft } = input;

  if (step === "master") {
    for (const e of validateClient(draft, input.clients, input.clientId)) {
      // Auditor dates are no longer asked, so one kept from an older save can't block the form.
      if (e.field !== "firstAuditorAppointedOn" && e.field !== "adt1FiledOn") errors[e.field] = e.message;
    }
    // The capital is part of every company's master data.
    if (draft.type === "llp") {
      if (!(draft.llpContribution && draft.llpContribution > 0)) {
        errors.llpContribution ??= "Enter the partners' contribution.";
      }
    } else {
      if (!(draft.authorisedCapital && draft.authorisedCapital > 0)) {
        errors.authorisedCapital ??= "Enter the authorised capital.";
      }
      if (!(draft.paidUpCapital && draft.paidUpCapital > 0)) {
        errors.paidUpCapital ??= "Enter the paid-up capital.";
      }
    }
  }

  if (step === "directors") {
    const tooFew = boardSizeProblem(draft.type, input.board, input.asOf);
    if (tooFew) errors.board = tooFew;
    const key = input.authorisedKey;
    if (key === null) {
      errors.authorised = "Choose the authorised person: at least one director must be.";
    } else if (!inOffice(input.board, input.asOf).some((e) => e.key === key)) {
      errors.authorised = "The authorised person must be a director in office. Choose again.";
    }
  }

  if (step === "consultant") {
    const ref = effectiveReference(input.reference);
    if (input.pointOfContact === "consultant" && ref.mode === "none") {
      errors.ref_name = "The point of contact is a consultant, so enter the consultant's details.";
    }
    for (const e of resolveReference(ref, input.consultants).errors) errors[`ref_${e.field}`] = e.message;
  }

  // The "forms" step is only Applicable / Not applicable choices, so nothing can be missing.
  return errors;
}

/** The first step with something missing, and its errors; null when the form can be saved. */
export function firstIncomplete(input) {
  for (const step of COMPANY_STEPS) {
    const errors = stepErrors(step, input);
    if (Object.keys(errors).length > 0) return { step, errors };
  }
  return null;
}
