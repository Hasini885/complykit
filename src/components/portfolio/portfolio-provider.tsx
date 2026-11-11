"use client";

import * as React from "react";

import {
  LocalStoragePortfolioRepository,
  type PortfolioRepository,
} from "@/lib/portfolio/repository";
import {
  applyDraft,
  newClient,
  sortClients,
  type ClientDraft,
} from "@/lib/portfolio/clients";
import { withAdt1Appointment, withAuditorTerm } from "@/lib/portfolio/auditor";
import { applyDirectorDraft, newDirector, type DirectorDraft } from "@/lib/portfolio/directors";
import {
  applyConsultantDraft,
  assignmentChanges,
  companiesToLink,
  consultantToAdd,
  newConsultant,
  sortConsultants,
  type ConsultantDraft,
} from "@/lib/portfolio/consultants";
import {
  emptySnapshot,
  type Client,
  type Consultant,
  type Director,
  type PortfolioSnapshot,
} from "@/lib/portfolio/types";
import { filingKey, kycDirectorId, withFiling, withoutFiling, type FilingInput } from "@/lib/portfolio/filings";
import { normaliseSrn } from "@/lib/portfolio/srn";
import { withDueOverride, withoutDueOverride } from "@/lib/portfolio/due-overrides";
import type { ResolvedDueDate } from "@/lib/resolve-due-dates";

/**
 * The single place component state for the portfolio lives.
 *
 * Components read from this context and call its actions; none of them touch
 * localStorage or construct records. Swapping storage is a matter of passing a
 * different `repository` — nothing below this file changes.
 */

type PortfolioContextValue = {
  ready: boolean;
  clients: Client[];
  directors: Director[];
  /** The consultant master, sorted by name. */
  consultants: Consultant[];
  activeClient: Client | null;
  activeClientId: string | null;

  setActiveClient: (id: string | null) => Promise<void>;
  addClient: (draft: ClientDraft) => Promise<Client>;
  updateClient: (id: string, draft: ClientDraft) => Promise<void>;
  removeClient: (id: string) => Promise<void>;

  addDirector: (draft: DirectorDraft) => Promise<Director>;
  updateDirector: (id: string, draft: DirectorDraft) => Promise<void>;
  removeDirector: (id: string) => Promise<void>;

  addConsultant: (draft: ConsultantDraft) => Promise<Consultant>;
  updateConsultant: (id: string, draft: ConsultantDraft) => Promise<void>;
  /** Companies that named this consultant are left with no reference. */
  removeConsultant: (id: string) => Promise<void>;
  /** Sets which companies name this consultant as their reference. */
  assignConsultant: (consultantId: string, clientIds: string[]) => Promise<void>;
  /** The director who is a company's authorised person. */
  setAuthorisedDirector: (clientId: string, directorId: string | null) => Promise<void>;
  /** The auditor appointed at this year's AGM for this many years (1 to 5). */
  setAuditorTerm: (clientId: string, appointedFy: number, years: number) => Promise<void>;
  /** A subsequent auditor's ADT-1: SRN, date of filing and years appointed. */
  saveAuditorAppointment: (
    clientId: string,
    input: FilingInput,
    years: number,
    replacesFy: number | null,
  ) => Promise<void>;

  /**
   * Records a deadline as met, with its SRN. DIR-3 KYC rows update the
   * director (one KYC covers every board); everything else the company.
   */
  markFiled: (clientId: string, item: ResolvedDueDate, input: FilingInput) => Promise<void>;
  unmarkFiled: (clientId: string, item: ResolvedDueDate) => Promise<void>;
  /** A one-off date for this occurrence only; next year's keeps its usual date. */
  setDueDate: (clientId: string, item: ResolvedDueDate, input: { date: string; note?: string }) => Promise<void>;
  resetDueDate: (clientId: string, item: ResolvedDueDate) => Promise<void>;
  /**
   * Several one-off dates at once, across companies: `input` sets the date,
   * null puts that occurrence back on its usual date. Saved together.
   */
  applyDueDates: (
    changes: { clientId: string; item: ResolvedDueDate; input: { date: string; note?: string } | null }[],
  ) => Promise<void>;

  clearAll: () => Promise<void>;
};

const PortfolioContext = React.createContext<PortfolioContextValue | null>(null);

export function PortfolioProvider({
  children,
  repository,
}: {
  children: React.ReactNode;
  /** Injectable so tests and a future server implementation can swap it. */
  repository?: PortfolioRepository;
}) {
  const repo = React.useMemo(
    () => repository ?? new LocalStoragePortfolioRepository(),
    [repository],
  );

  const [snapshot, setSnapshot] = React.useState<PortfolioSnapshot>(emptySnapshot);
  const [ready, setReady] = React.useState(false);

  // One-time hydration. Loads exactly what is in storage — nothing is ever
  // written here. A genuinely fresh browser starts at zero clients and zero
  // directors. There is no sample data in the app.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await repo.load();
      if (!cancelled) {
        setSnapshot(loaded);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [repo]);

  const refresh = React.useCallback(async () => {
    setSnapshot(await repo.load());
  }, [repo]);

  /**
   * A consultant named as a director's authorised person is added to the
   * consultant master, unless one with that mobile is already there, and the
   * director's companies with no consultant are put under them. Reads
   * the stored list, not the rendered one, so several directors saved in a
   * row with the same new consultant add it only once.
   */
  const syncConsultant = React.useCallback(
    async (director: Director) => {
      const stored = await repo.load();
      const draft = consultantToAdd(director, stored.consultants);
      let consultantId: string | null = null;
      if (draft) {
        const created = newConsultant(draft);
        await repo.upsertConsultant(created);
        consultantId = created.id;
      } else if (director.isAuthorisedPerson === false && director.consultantMobile) {
        consultantId = stored.consultants.find((c) => c.mobile === director.consultantMobile)?.id ?? null;
      }
      // The director's companies show under that consultant too (unless they have one already).
      if (!consultantId) return;
      const now = new Date().toISOString();
      for (const id of companiesToLink(director, stored.clients)) {
        const client = stored.clients.find((c) => c.id === id)!;
        await repo.upsertClient({ ...client, consultantId, updatedAt: now });
      }
    },
    [repo],
  );

  const value = React.useMemo<PortfolioContextValue>(() => {
    const clients = sortClients(snapshot.clients);
    // The app always works across all companies: there is no single-company view.
    const activeClient: Client | null = null;

    return {
      ready,
      clients,
      directors: snapshot.directors,
      consultants: sortConsultants(snapshot.consultants),
      activeClient,
      activeClientId: null,

      // Kept for callers; it only clears any company chosen in an older version.
      async setActiveClient() {
        if (snapshot.activeClientId !== null) {
          await repo.setActiveClientId(null);
          await refresh();
        }
      },

      async addClient(draft) {
        const created = newClient(draft);
        await repo.upsertClient(created);
        // Adding a company does not select it: the admin (all companies) view
        // stays as it was. Selecting is a deliberate choice in the switcher.
        await refresh();
        return created;
      },

      async updateClient(id, draft) {
        const existing = snapshot.clients.find((c) => c.id === id);
        if (!existing) return;
        await repo.upsertClient(applyDraft(existing, draft));
        await refresh();
      },

      async removeClient(id) {
        await repo.deleteClient(id);
        await refresh();
      },

      async addDirector(draft) {
        const created = newDirector(draft);
        await repo.upsertDirector(created);
        await syncConsultant(created);
        await refresh();
        return created;
      },

      async updateDirector(id, draft) {
        const existing = snapshot.directors.find((d) => d.id === id);
        if (!existing) return;
        const updated = applyDirectorDraft(existing, draft);
        await repo.upsertDirector(updated);
        await syncConsultant(updated);
        await refresh();
      },

      async removeDirector(id) {
        await repo.deleteDirector(id);
        await refresh();
      },

      async addConsultant(draft) {
        const created = newConsultant(draft);
        await repo.upsertConsultant(created);
        await refresh();
        return created;
      },

      async updateConsultant(id, draft) {
        const existing = snapshot.consultants.find((c) => c.id === id);
        if (!existing) return;
        await repo.upsertConsultant(applyConsultantDraft(existing, draft));
        await refresh();
      },

      async removeConsultant(id) {
        await repo.deleteConsultant(id);
        await refresh();
      },

      async setAuthorisedDirector(clientId, directorId) {
        // Read the stored record: it may have been saved a moment ago in the same flow.
        const client = (await repo.load()).clients.find((c) => c.id === clientId);
        if (!client) return;
        await repo.upsertClient({ ...client, authorisedDirectorId: directorId, updatedAt: new Date().toISOString() });
        await refresh();
      },

      async setAuditorTerm(clientId, appointedFy, years) {
        // Read the stored record: a filing may have been saved a moment ago in the same flow.
        const client = (await repo.load()).clients.find((c) => c.id === clientId);
        if (!client) return;
        await repo.upsertClient(withAuditorTerm(client, appointedFy, years));
        await refresh();
      },

      async saveAuditorAppointment(clientId, input, years, replacesFy) {
        const client = (await repo.load()).clients.find((c) => c.id === clientId);
        if (!client) return;
        await repo.upsertClient(withAdt1Appointment(client, input, years, replacesFy));
        await refresh();
      },

      async assignConsultant(consultantId, clientIds) {
        const now = new Date().toISOString();
        for (const change of assignmentChanges(consultantId, clientIds, snapshot.clients)) {
          const client = snapshot.clients.find((c) => c.id === change.clientId);
          if (client) await repo.upsertClient({ ...client, consultantId: change.consultantId, updatedAt: now });
        }
        await refresh();
      },

      async markFiled(clientId, item, input) {
        const directorId = kycDirectorId(item);
        if (directorId) {
          const director = snapshot.directors.find((d) => d.id === directorId);
          if (!director) return;
          await repo.upsertDirector({
            ...director,
            lastKycFiledOn: input.filedOn,
            lastKycSrn: normaliseSrn(input.srn) || null,
            updatedAt: new Date().toISOString(),
          });
        } else {
          const client = snapshot.clients.find((c) => c.id === clientId);
          if (!client) return;
          await repo.upsertClient(withFiling(client, filingKey(item), input));
        }
        await refresh();
      },

      async unmarkFiled(clientId, item) {
        const directorId = kycDirectorId(item);
        if (directorId) {
          const director = snapshot.directors.find((d) => d.id === directorId);
          if (!director) return;
          await repo.upsertDirector({
            ...director,
            lastKycFiledOn: null,
            lastKycSrn: null,
            updatedAt: new Date().toISOString(),
          });
        } else {
          const client = snapshot.clients.find((c) => c.id === clientId);
          if (!client) return;
          await repo.upsertClient(withoutFiling(client, filingKey(item)));
        }
        await refresh();
      },

      async setDueDate(clientId, item, input) {
        const client = snapshot.clients.find((c) => c.id === clientId);
        if (!client) return;
        await repo.upsertClient(withDueOverride(client, filingKey(item), input));
        await refresh();
      },

      async resetDueDate(clientId, item) {
        const client = snapshot.clients.find((c) => c.id === clientId);
        if (!client) return;
        await repo.upsertClient(withoutDueOverride(client, filingKey(item)));
        await refresh();
      },

      async applyDueDates(changes) {
        const byId = new Map(snapshot.clients.map((c) => [c.id, c]));
        const touched = new Set<string>();
        for (const ch of changes) {
          const client = byId.get(ch.clientId);
          if (!client) continue;
          const key = filingKey(ch.item);
          byId.set(ch.clientId, ch.input ? withDueOverride(client, key, ch.input) : withoutDueOverride(client, key));
          touched.add(ch.clientId);
        }
        for (const id of touched) await repo.upsertClient(byId.get(id)!);
        await refresh();
      },

      async clearAll() {
        await repo.replaceAll(emptySnapshot());
        await refresh();
      },
    };
  }, [repo, refresh, snapshot, ready, syncConsultant]);

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
}

export function usePortfolio(): PortfolioContextValue {
  const ctx = React.useContext(PortfolioContext);
  if (!ctx) throw new Error("usePortfolio must be used inside a PortfolioProvider");
  return ctx;
}

/** Convenience for the many pages that are scoped to one client. */
export function useActiveClient(): Client | null {
  return usePortfolio().activeClient;
}

/**
 * The companies a list page should show: only the active company when one is
 * selected in the switcher, otherwise all of them.
 */
export function useScopedClients(): { clients: Client[]; activeClient: Client | null } {
  const { clients, activeClient } = usePortfolio();
  return React.useMemo(
    () => ({ clients: activeClient ? [activeClient] : clients, activeClient }),
    [clients, activeClient],
  );
}
