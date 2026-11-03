import { isoDate, today, type CompanyType } from "@/lib/dates";
import { activeDirectorships, allDins, dinAt, validateDirector, type DirectorDraft } from "@/lib/portfolio/directors";
import type { CessationReason, Director, Directorship } from "@/lib/portfolio/types";

/** A director's appointment at this company, as edited in the company form. */
export type Seat = {
  /** ISO date of appointment. */
  appointedOn: string;
  /** ISO date of cessation, or null while in office. */
  cessationOn: string | null;
  cessationReason?: CessationReason;
};

/**
 * The directors section of the company (master data) form. Directors are
 * entered with the company rather than on a page of their own, but stay one
 * record per person (by DIN), so a director on two boards is still counted
 * once for KYC and Section 165.
 *
 * Nothing is saved while the form is open: the form keeps a list of entries
 * and, when the company is saved, `boardChanges` turns it into the director
 * records to add or update. That is what lets directors be added to a company
 * that does not exist yet.
 */

export type BoardEntry = {
  /** Stable key for the list, also for entries not yet saved. */
  key: string;
  /** The saved director this is, or null for one added in this form. */
  directorId: string | null;
  draft: DirectorDraft;
  /** Edited in this form (or newly put on this board), so it must be saved. */
  dirty: boolean;
  /** Appointment and cessation at this company. Absent: appointed today, in office. */
  seat?: Seat;
};

/** The seat this director holds (or last held) at this company. */
export function seatAt(d: Director, clientId: string): Directorship | undefined {
  const seats = d.directorships.filter((ds) => ds.clientId === clientId);
  return seats.find((ds) => !ds.cessationOn) ?? seats.sort((a, b) => (b.appointedOn ?? "").localeCompare(a.appointedOn ?? ""))[0];
}

function seatOf(ds: Directorship | undefined): Seat | undefined {
  return ds ? { appointedOn: ds.appointedOn, cessationOn: ds.cessationOn ?? null, cessationReason: ds.cessationReason } : undefined;
}

/**
 * A director as a form draft. With `clientId`, the DIN is the one they hold at
 * that company (each company can have its own); without, their main DIN.
 */
export function directorDraftFrom(d: Director, clientId?: string): DirectorDraft {
  return {
    name: d.name,
    din: clientId ? dinAt(d, clientId) : d.din,
    dinAllottedOn: d.dinAllottedOn,
    lastKycFiledOn: d.lastKycFiledOn ?? null,
    lastKycSrn: d.lastKycSrn ?? null,
    email: d.email,
    isAuthorisedPerson: d.isAuthorisedPerson,
    consultantName: d.consultantName,
    consultantMobile: d.consultantMobile,
    directorships: d.directorships,
  };
}

/**
 * The directors of this company, as form entries: those in office first, then
 * those who have ceased (kept, so their dates can still be seen and edited).
 */
export function boardFor(clientId: string | null, directors: Director[], asOf: Date = today()): BoardEntry[] {
  if (!clientId) return [];
  const active = (d: Director) => activeDirectorships(d, asOf).some((ds) => ds.clientId === clientId);
  return directors
    .filter((d) => d.directorships.some((ds) => ds.clientId === clientId))
    .sort((a, b) => Number(active(b)) - Number(active(a)))
    .map((d) => ({
      key: d.id,
      directorId: d.id,
      draft: directorDraftFrom(d, clientId),
      dirty: false,
      seat: seatOf(seatAt(d, clientId)),
    }));
}

/**
 * Checks one entry: the usual director rules against the saved directors
 * (other than itself), plus no two entries in this form sharing a DIN.
 */
export function validateBoardEntry(
  draft: DirectorDraft,
  key: string,
  directorId: string | null,
  entries: BoardEntry[],
  directors: Director[],
): { field: keyof DirectorDraft; message: string }[] {
  const errors = validateDirector(draft, directors, directorId ?? undefined);
  const din = draft.din.trim();
  if (
    din !== "" &&
    !errors.some((e) => e.field === "din") &&
    entries.some((e) => e.key !== key && e.draft.din.trim() === din)
  ) {
    errors.push({ field: "din", message: "Another director in this company already has that DIN." });
  }
  return errors;
}

export type BoardChange =
  /** `key` is the form entry's, so a new director can be found once saved. */
  | { kind: "add"; key: string; draft: DirectorDraft }
  | { kind: "update"; id: string; draft: DirectorDraft };

/**
 * What to save once the company is saved (and so has an id): new directors
 * are added on this board; edited ones, or ones newly put on it, are updated
 * with this board in their directorships; ones taken off lose it.
 */
export function boardChanges(
  clientId: string,
  entries: BoardEntry[],
  removedIds: Iterable<string>,
  directors: Director[],
  now: Date = today(),
): BoardChange[] {
  const fresh = { clientId, role: "Director", appointedOn: isoDate(now) };
  /** This company's seat as stored: the entry's dates over whatever was saved. */
  const seatFor = (e: BoardEntry, saved?: Directorship): Directorship => {
    const base = saved ?? fresh;
    if (!e.seat) return base;
    return {
      ...base,
      appointedOn: e.seat.appointedOn || base.appointedOn,
      cessationOn: e.seat.cessationOn || null,
      cessationReason: e.seat.cessationOn ? e.seat.cessationReason : undefined,
    };
  };
  const byId = new Map(directors.map((d) => [d.id, d]));
  const changes: BoardChange[] = [];

  for (const e of entries) {
    if (e.directorId === null) {
      changes.push({ kind: "add", key: e.key, draft: { ...e.draft, directorships: [seatFor(e)] } });
      continue;
    }
    const saved = byId.get(e.directorId);
    if (!saved) continue;
    const savedSeat = seatAt(saved, clientId);
    if (!e.dirty && savedSeat) continue;
    // Their other boards come from the saved record, never from the form.
    const others = saved.directorships.filter((ds) => ds.clientId !== clientId);
    const here = seatFor(e, savedSeat);
    // The DIN in the form is the one for THIS company. A director on other
    // boards keeps their main DIN and this seat records its own; one with no
    // other board simply has the DIN changed.
    const formDin = e.draft.din.trim();
    const draft: DirectorDraft =
      others.length === 0
        ? { ...e.draft, din: formDin, directorships: [{ ...here, din: undefined }] }
        : { ...e.draft, din: saved.din, directorships: [...others, { ...here, din: formDin }] };
    changes.push({ kind: "update", id: e.directorId, draft });
  }

  const kept = new Set(entries.map((e) => e.directorId));
  for (const id of removedIds) {
    const saved = byId.get(id);
    if (!saved || kept.has(id)) continue;
    changes.push({
      kind: "update",
      id,
      draft: { ...directorDraftFrom(saved), directorships: saved.directorships.filter((ds) => ds.clientId !== clientId) },
    });
  }
  return changes;
}

/**
 * Puts a director typed into the company form onto its board. A DIN belongs
 * to one person: when it is already saved (a director on another company),
 * that director is linked here with their saved details and other boards,
 * rather than entered a second time. Returns the new entries, any field
 * errors, and the existing director when one was linked.
 */
export function placeOnBoard(
  entries: BoardEntry[],
  target: { key: string; directorId: string | null } | "new",
  draft: DirectorDraft,
  directors: Director[],
  newKey: () => string,
  seat?: Seat,
): { entries: BoardEntry[]; errors: { field: keyof DirectorDraft; message: string }[]; linked: Director | null } {
  const din = draft.din.trim();
  const isNew = target === "new" || target.directorId === null;
  const sameDin = isNew ? directors.find((d) => allDins(d).includes(din)) : undefined;

  if (sameDin) {
    const already = entries.some((e) => e.directorId === sameDin.id);
    if (already) {
      return {
        entries,
        errors: [{ field: "din", message: `${sameDin.name} (DIN ${din}) is already in this company.` }],
        linked: null,
      };
    }
    const entry: BoardEntry = {
      key: sameDin.id,
      directorId: sameDin.id,
      draft: directorDraftFrom(sameDin),
      // Linked with the dates given here for this company.
      dirty: seat !== undefined,
      seat,
    };
    const next = target === "new" ? [...entries, entry] : entries.map((e) => (e.key === target.key ? entry : e));
    return { entries: next, errors: [], linked: sameDin };
  }

  const key = target === "new" ? newKey() : target.key;
  const directorId = target === "new" ? null : target.directorId;
  const errors = validateBoardEntry(draft, key, directorId, entries, directors);
  if (errors.length > 0) return { entries, errors, linked: null };
  const next =
    target === "new"
      ? [...entries, { key, directorId: null, draft, dirty: true, seat }]
      : entries.map((e) => (e.key === key ? { ...e, draft, dirty: true, seat: seat ?? e.seat } : e));
  return { entries: next, errors: [], linked: null };
}

/**
 * The fewest directors a company must have in office (Section 149(1) of the
 * Companies Act, 2013): three for a public company, one for a One Person
 * Company, two otherwise. An LLP needs two designated partners (Section 7 of
 * the LLP Act, 2008).
 */
export const MIN_DIRECTORS: Record<CompanyType, number> = {
  private: 2,
  public: 3,
  opc: 1,
  section8: 2,
  llp: 2,
};

/** Directors in office on this board: those with no cessation, or one still to come. */
export function inOffice(entries: BoardEntry[], asOf: Date = today()): BoardEntry[] {
  const day = isoDate(asOf);
  return entries.filter((e) => !e.seat?.cessationOn || e.seat.cessationOn > day);
}

/** Why the board is too small to save, or null when it has enough directors. */
export function boardSizeProblem(type: CompanyType, entries: BoardEntry[], asOf: Date = today()): string | null {
  const min = MIN_DIRECTORS[type];
  const have = inOffice(entries, asOf).length;
  if (have >= min) return null;
  const who = type === "llp" ? "designated partners" : "directors";
  const law = type === "llp" ? "Section 7 of the LLP Act" : "Section 149(1)";
  return `Add at least ${min} ${min === 1 ? who.replace(/s$/, "") : who} in office (${law}); this company has ${have}.`;
}

/**
 * Directors appointed on the day of incorporation follow it: when the
 * company's incorporation date is changed, every entry whose appointment was
 * that old date moves to the new one (and is saved). Dates set to anything
 * else were chosen deliberately and stay as they are.
 */
export function followIncorporation(entries: BoardEntry[], previous: string, next: string): BoardEntry[] {
  if (!previous || !next || previous === next) return entries;
  return entries.map((e) =>
    e.seat?.appointedOn === previous ? { ...e, dirty: true, seat: { ...e.seat, appointedOn: next } } : e,
  );
}
