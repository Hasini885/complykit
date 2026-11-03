import { validateClient, type ClientDraft } from "@/lib/portfolio/clients";
import { boardSizeProblem, inOffice, type BoardEntry } from "@/lib/portfolio/board";
import { resolveReference, type ReferenceInput } from "@/lib/portfolio/consultants";
import type { Client, Consultant } from "@/lib/portfolio/types";

/**
 * The company form, as four steps filled in order: Master data, Directors,
 * Consultant, Applicability of special forms. Each step is checked before the
 * next opens (Next), and all of them before saving (Finish). Pure, so the
 * rules are tested without the form.
 */

export const COMPANY_STEPS = ["master", "directors", "consultant", "forms"] as const;
export type CompanyStep = (typeof COMPANY_STEPS)[number];

/**
 * The authorised person is always one of the directors (by their entry's
 * key, which a new director has before it is saved). The point of contact is
 * that same person, unless a third person (a consultant) is involved.
 */
export type PointOfContactChoice = "authorised" | "consultant";

export type StepInput = {
  draft: ClientDraft;
  clients: Client[];
  clientId?: string;
  board: BoardEntry[];
  /** Key of the board entry who is the authorised person, or null when none is chosen yet. */
  authorisedKey: string | null;
  pointOfContact: PointOfContactChoice;
  reference: ReferenceInput;
  consultants: Consultant[];
  asOf?: Date;
};

export type StepErrors = Record<string, string>;

/** A "new" consultant left blank counts as no consultant. */
export function effectiveReference(ref: ReferenceInput): ReferenceInput {
  return ref.mode === "new" && !ref.name.trim() && !ref.mobile.trim() ? { mode: "none" } : ref;
}

export function stepErrors(step: CompanyStep, input: StepInput): StepErrors {
  const errors: StepErrors = {};
  const { draft } = input;

  if (step === "master") {
    for (const e of validateClient(draft, input.clients, input.clientId)) {
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

  if (step === "forms" && draft.type !== "llp") {
    if (draft.auditorType === "first" && !draft.firstAuditorAppointedOn) {
      errors.firstAuditorAppointedOn = "Enter the date of the Board meeting that appointed the first auditor.";
    }
    // A subsequent auditor: the one ADT-1 filed for the appointment, and its term.
    if (draft.auditorType === "subsequent") {
      if (!draft.adt1Srn?.trim()) errors.adt1Srn = "Enter the SRN of the ADT-1 filed for this appointment.";
      if (!draft.adt1FiledOn) errors.adt1FiledOn = "Enter the date that ADT-1 was filed.";
    }
    for (const e of validateClient(draft, input.clients, input.clientId)) {
      if (e.field === "firstAuditorAppointedOn" || e.field === "adt1FiledOn") errors[e.field] = e.message;
    }
  }
  return errors;
}

/** The first step with something missing, and its errors; null when the form can be saved. */
export function firstIncomplete(input: StepInput): { step: CompanyStep; errors: StepErrors } | null {
  for (const step of COMPANY_STEPS) {
    const errors = stepErrors(step, input);
    if (Object.keys(errors).length > 0) return { step, errors };
  }
  return null;
}
