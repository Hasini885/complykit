import { agmFyOf } from "@/lib/portfolio/clients";
import { cleanFilings } from "@/lib/portfolio/filings";
import { cleanDueOverrides } from "@/lib/portfolio/due-overrides";
import { directorName, financialYearEndYear } from "@/lib/portfolio/directors";
import { parseIsoDate, today } from "@/lib/dates";
import {
  PORTFOLIO_VERSION,
  emptySnapshot,
  type Client,
  type Consultant,
  type Director,
  type PortfolioSnapshot,
} from "@/lib/portfolio/types";

/**
 * Storage boundary for the portfolio.
 *
 * Every method is async even though localStorage is synchronous. That is the
 * whole point: callers already await, so swapping this for an HTTP or SQL
 * implementation later is a constructor change and nothing else. No React and
 * no component imports this directly — the provider does.
 */
export interface PortfolioRepository {
  load(): Promise<PortfolioSnapshot>;
  upsertClient(client: Client): Promise<void>;
  deleteClient(id: string): Promise<void>;
  upsertDirector(director: Director): Promise<void>;
  deleteDirector(id: string): Promise<void>;
  upsertConsultant(consultant: Consultant): Promise<void>;
  /** Also clears the reference on every company that named this consultant. */
  deleteConsultant(id: string): Promise<void>;
  setActiveClientId(id: string | null): Promise<void>;
  /** Replace everything. Used by seeding and by the reset control. */
  replaceAll(snapshot: PortfolioSnapshot): Promise<void>;
}

/* ------------------------------------------------------------------ */
/* In-memory — the reference implementation, and what tests run against */
/* ------------------------------------------------------------------ */

export class InMemoryPortfolioRepository implements PortfolioRepository {
  private snapshot: PortfolioSnapshot;

  constructor(initial?: PortfolioSnapshot) {
    this.snapshot = initial ? clone(initial) : emptySnapshot();
  }

  async load() {
    return clone(this.snapshot);
  }

  async upsertClient(client: Client) {
    const i = this.snapshot.clients.findIndex((c) => c.id === client.id);
    if (i === -1) this.snapshot.clients.push(clone(client));
    else this.snapshot.clients[i] = clone(client);
  }

  async deleteClient(id: string) {
    this.snapshot.clients = this.snapshot.clients.filter((c) => c.id !== id);
    // Deleting a client must not leave directorships pointing at nothing.
    this.snapshot.directors = this.snapshot.directors.map((d) => ({
      ...d,
      directorships: d.directorships.filter((ds) => ds.clientId !== id),
    }));
    // Back to the all-companies (admin) view, rather than silently switching
    // the user to some other company.
    if (this.snapshot.activeClientId === id) this.snapshot.activeClientId = null;
  }

  async upsertDirector(director: Director) {
    const i = this.snapshot.directors.findIndex((d) => d.id === director.id);
    if (i === -1) this.snapshot.directors.push(clone(director));
    else this.snapshot.directors[i] = clone(director);
  }

  async deleteDirector(id: string) {
    this.snapshot.directors = this.snapshot.directors.filter((d) => d.id !== id);
  }

  async upsertConsultant(consultant: Consultant) {
    const i = this.snapshot.consultants.findIndex((c) => c.id === consultant.id);
    if (i === -1) this.snapshot.consultants.push(clone(consultant));
    else this.snapshot.consultants[i] = clone(consultant);
  }

  async deleteConsultant(id: string) {
    this.snapshot.consultants = this.snapshot.consultants.filter((c) => c.id !== id);
    // A company must not keep pointing at a consultant who is gone.
    this.snapshot.clients = this.snapshot.clients.map((c) =>
      c.consultantId === id ? { ...c, consultantId: null } : c,
    );
  }

  async setActiveClientId(id: string | null) {
    this.snapshot.activeClientId = id;
  }

  async replaceAll(snapshot: PortfolioSnapshot) {
    this.snapshot = clone(snapshot);
  }
}

/* ------------------------------------------------------------------ */
/* localStorage                                                        */
/* ------------------------------------------------------------------ */

export const STORAGE_KEY = "complykit.portfolio.v1";

/**
 * Reads and writes the whole snapshot on every operation.
 *
 * That is wasteful in principle and irrelevant in practice at portfolio size
 * (tens of clients), and it keeps writes atomic — there is no window in which
 * a client exists but its directorships do not.
 */
export class LocalStoragePortfolioRepository implements PortfolioRepository {
  private memo = new InMemoryPortfolioRepository();
  private hydrated = false;

  private read(): PortfolioSnapshot {
    if (typeof window === "undefined") return emptySnapshot();
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptySnapshot();
      const parsed = JSON.parse(raw) as Partial<PortfolioSnapshot>;
      return normalise(parsed);
    } catch {
      // Corrupt or unreadable storage must not brick the app.
      return emptySnapshot();
    }
  }

  private write(snapshot: PortfolioSnapshot) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Quota or private-mode failures are non-fatal; the session keeps working.
    }
  }

  private async sync() {
    if (!this.hydrated) {
      await this.memo.replaceAll(this.read());
      this.hydrated = true;
    }
  }

  private async flush() {
    this.write(await this.memo.load());
  }

  async load() {
    await this.sync();
    return this.memo.load();
  }

  async upsertClient(client: Client) {
    await this.sync();
    await this.memo.upsertClient(client);
    await this.flush();
  }

  async deleteClient(id: string) {
    await this.sync();
    await this.memo.deleteClient(id);
    await this.flush();
  }

  async upsertDirector(director: Director) {
    await this.sync();
    await this.memo.upsertDirector(director);
    await this.flush();
  }

  async deleteDirector(id: string) {
    await this.sync();
    await this.memo.deleteDirector(id);
    await this.flush();
  }

  async upsertConsultant(consultant: Consultant) {
    await this.sync();
    await this.memo.upsertConsultant(consultant);
    await this.flush();
  }

  async deleteConsultant(id: string) {
    await this.sync();
    await this.memo.deleteConsultant(id);
    await this.flush();
  }

  async setActiveClientId(id: string | null) {
    await this.sync();
    await this.memo.setActiveClientId(id);
    await this.flush();
  }

  async replaceAll(snapshot: PortfolioSnapshot) {
    await this.memo.replaceAll(snapshot);
    this.hydrated = true;
    await this.flush();
  }
}

/* ------------------------------------------------------------------ */

/** Coerces whatever was in storage into a valid snapshot. */
export function normalise(input: Partial<PortfolioSnapshot> | null | undefined): PortfolioSnapshot {
  const clients = Array.isArray(input?.clients) ? input.clients.map(migrateClient) : [];
  const directors = Array.isArray(input?.directors) ? input.directors : [];
  const consultants = Array.isArray(input?.consultants) ? input.consultants : [];
  const clientIds = new Set(clients.map((c) => c.id));
  const consultantIds = new Set(consultants.map((c) => c.id));

  return {
    version: PORTFOLIO_VERSION,
    // A reference to a consultant no longer in the master is dropped.
    clients: clients.map((c) =>
      c.consultantId && !consultantIds.has(c.consultantId) ? { ...c, consultantId: null } : c,
    ),
    consultants,
    // Drop directorships whose client no longer exists, so the UI never has to
    // guard against a dangling reference.
    directors: directors.map((d) => ({
      ...d,
      // Names are kept in capitals; older saves may have them as typed.
      name: typeof d.name === "string" ? directorName(d.name) : d.name,
      directorships: Array.isArray(d.directorships)
        ? d.directorships.filter((ds) => clientIds.has(ds.clientId))
        : [],
    })),
    // Null is a real choice — the all-companies (admin) view — so it is kept
    // as null; only a stale id (its company deleted) is dropped back to it.
    activeClientId:
      input?.activeClientId && clientIds.has(input.activeClientId) ? input.activeClientId : null,
  };
}

/**
 * Older saves recorded the auditor as a yes/no "appointed this year", which
 * stayed true forever once ticked. Turn it into the year of appointment: the
 * year of the AGM on record (that is where the appointment was made), else
 * the year that closed most recently.
 */
function migrateClient(stored: Client): Client {
  let client = stored.filings === undefined ? stored : { ...stored, filings: cleanFilings(stored.filings) };
  if (client.dueOverrides !== undefined) client = { ...client, dueOverrides: cleanDueOverrides(client.dueOverrides) };
  // ADT-1 became compulsory for every company: an older "not applicable" is dropped.
  if (client.filesAdt1 === false) client = { ...client, filesAdt1: true };
  if (client.auditorAppointedThisYear === undefined) return client;
  const { auditorAppointedThisYear, ...rest } = client;
  if (!auditorAppointedThisYear || rest.auditorAppointedAtAgmFy != null) return rest;
  const agm = rest.lastAgmOn ? parseIsoDate(rest.lastAgmOn) : null;
  return {
    ...rest,
    auditorAppointedAtAgmFy: agm ? agmFyOf(agm) : financialYearEndYear(today()) - 1,
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
