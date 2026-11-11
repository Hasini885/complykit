"use client";

import * as React from "react";

import { LocalStoragePortfolioRepository } from "@/lib/portfolio/repository";
import { applyDraft, newClient, sortClients } from "@/lib/portfolio/clients";
import { withAdt1Appointment, withAuditorTerm } from "@/lib/portfolio/auditor";
import { applyDirectorDraft, newDirector } from "@/lib/portfolio/directors";
import {
  applyConsultantDraft,
  assignmentChanges,
  companiesToLink,
  consultantToAdd,
  newConsultant,
  sortConsultants,
} from "@/lib/portfolio/consultants";
import { emptySnapshot } from "@/lib/portfolio/types";
import { filingKey, kycDirectorId, withFiling, withoutFiling } from "@/lib/portfolio/filings";
import { normaliseSrn } from "@/lib/portfolio/srn";
import { withDueOverride, withoutDueOverride } from "@/lib/portfolio/due-overrides";
const PortfolioContext = React.createContext(null);

export function PortfolioProvider({ children, repository }) {
  const repo = React.useMemo(() => repository ?? new LocalStoragePortfolioRepository(), [repository]);

  const [snapshot, setSnapshot] = React.useState(emptySnapshot);
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
    async (director) => {
      const stored = await repo.load();
      const draft = consultantToAdd(director, stored.consultants);
      let consultantId = null;
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
        const client = stored.clients.find((c) => c.id === id);
        await repo.upsertClient({ ...client, consultantId, updatedAt: now });
      }
    },
    [repo],
  );

  const value = React.useMemo(() => {
    const clients = sortClients(snapshot.clients);
    // The app always works across all companies: there is no single-company view.
    const activeClient = null;

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
        const touched = new Set();
        for (const ch of changes) {
          const client = byId.get(ch.clientId);
          if (!client) continue;
          const key = filingKey(ch.item);
          byId.set(ch.clientId, ch.input ? withDueOverride(client, key, ch.input) : withoutDueOverride(client, key));
          touched.add(ch.clientId);
        }
        for (const id of touched) await repo.upsertClient(byId.get(id));
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

export function usePortfolio() {
  const ctx = React.useContext(PortfolioContext);
  if (!ctx) throw new Error("usePortfolio must be used inside a PortfolioProvider");
  return ctx;
}

/** Convenience for the many pages that are scoped to one client. */
export function useActiveClient() {
  return usePortfolio().activeClient;
}

/**
 * The companies a list page should show: only the active company when one is
 * selected in the switcher, otherwise all of them.
 */
export function useScopedClients() {
  const { clients, activeClient } = usePortfolio();
  return React.useMemo(
    () => ({ clients: activeClient ? [activeClient] : clients, activeClient }),
    [clients, activeClient],
  );
}
