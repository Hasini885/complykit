"use client";

import * as React from "react";
import { CloudAlert, CloudCheck, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tip } from "@/components/shared/tip";
import { formatDate } from "@/lib/dates";
import { syncPlan } from "@/lib/sync-plan";
import { USER_DATA_KEYS } from "@/lib/user-storage";
import { emptySnapshot } from "@/lib/portfolio/types";

/**
 * Saves the signed-in user's data on the server under their account (via
 * /api/data), so the same login shows the same companies on any computer. Fully automatic:
 * when the app opens the newest copy is brought in, and every change here is
 * saved within a few seconds. Nothing to connect or click. Whatever is saved
 * to the account always wins: this computer's copy never replaces it.
 */

const PORTFOLIO_KEY = USER_DATA_KEYS[0];
/** Saved online besides the companies: checklists, saved documents, firm details, GST register, tasks. */
const EXTRA_KEYS = [
  "complykit.checklists.v1",
  "complykit.documents.v1",
  "complykit.documents.firm.v1",
  "complykit.gst.v1",
  "complykit.tasks.v1",
];
const CHECK_EVERY_MS = 4000;

function readLocal() {
  const raw = localStorage.getItem(PORTFOLIO_KEY);
  const extras = {};
  for (const k of EXTRA_KEYS) {
    const v = localStorage.getItem(k);
    if (v !== null) extras[k] = v;
  }
  return {
    portfolio: raw ? JSON.parse(raw) : null,
    extras,
    signature: `${raw ?? ""}|${EXTRA_KEYS.map((k) => extras[k] ?? "").join("|")}`,
  };
}

function hasData(p) {
  return !!p && (p.clients?.length > 0 || p.directors?.length > 0 || (p.consultants?.length ?? 0) > 0);
}

/** Puts the online copy into this browser (the page then reloads to show it). */
function writeLocal(data) {
  localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(data.portfolio));
  for (const k of EXTRA_KEYS) {
    if (data.extras[k] !== undefined) localStorage.setItem(k, data.extras[k]);
    else localStorage.removeItem(k);
  }
}

/** Everything this browser holds for the account, as one file's worth of JSON (for "Export data"). */
export function exportAccountData() {
  const local = readLocal();
  return {
    app: "complykit",
    version: 1,
    updatedAt: Date.now(),
    portfolio: local.portfolio ?? emptySnapshot(),
    extras: local.extras,
  };
}

/**
 * Replaces this browser's data with an exported file's (for "Import data").
 * The automatic sync then saves it to the account; reload to show it.
 */
export function importAccountData(data) {
  writeLocal(data);
}

function loadMeta(key) {
  const empty = { lastSyncedAt: null, signature: null };
  if (typeof window === "undefined") return empty;
  try {
    return { ...empty, ...JSON.parse(localStorage.getItem(key) ?? "{}") };
  } catch {
    return empty;
  }
}

/** The server's own explanation when saving or loading fails (e.g. "Sign in with Google…"). */
async function reason(res, fallback) {
  const body = await res.json().catch(() => ({}));
  return new Error(body.error ?? fallback);
}

async function fetchOnline() {
  const res = await fetch("/api/data", { cache: "no-store" });
  if (!res.ok) throw await reason(res, "Could not load your saved data.");
  return (await res.json()).data;
}

async function saveOnline(data) {
  const res = await fetch("/api/data", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw await reason(res, "Could not save your data.");
}

const AccountSyncContext = React.createContext(null);

export function useAccountSync() {
  const ctx = React.useContext(AccountSyncContext);
  if (!ctx) throw new Error("useAccountSync must be used inside AccountSyncProvider");
  return ctx;
}

export function AccountSyncProvider({ userId, children }) {
  const META_KEY = `complykit.sync@${userId}`;
  const [status, setStatus] = React.useState("loading");
  const [lastSyncedAt, setLastSyncedAt] = React.useState(() => loadMeta(META_KEY).lastSyncedAt);
  const [problem, setProblem] = React.useState(null);
  const fail = React.useCallback((error) => {
    console.error("Account sync failed", error);
    setProblem(error instanceof Error ? error.message : null);
    setStatus("error");
  }, []);
  const busy = React.useRef(false);
  // Until the first check is done, nothing is saved (so an empty computer never overwrites the online copy).
  const ready = React.useRef(false);

  const writeMeta = React.useCallback(
    (m) => {
      const next = { ...loadMeta(META_KEY), ...m };
      localStorage.setItem(META_KEY, JSON.stringify(next));
      setLastSyncedAt(next.lastSyncedAt);
    },
    [META_KEY],
  );

  const push = React.useCallback(async () => {
    const local = readLocal();
    if (!local.portfolio) return;
    const updatedAt = Date.now();
    await saveOnline({ app: "complykit", version: 1, updatedAt, portfolio: local.portfolio, extras: local.extras });
    writeMeta({ lastSyncedAt: updatedAt, signature: local.signature });
  }, [writeMeta]);

  const pull = React.useCallback(
    (online) => {
      writeLocal(online);
      writeMeta({ lastSyncedAt: online.updatedAt, signature: readLocal().signature });
      window.location.reload();
    },
    [writeMeta],
  );

  /** On opening: compare this computer with the online copy and act. */
  const check = React.useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const online = await fetchOnline();
      const meta = loadMeta(META_KEY);
      const local = readLocal();
      const plan = syncPlan(
        {
          lastSyncedAt: meta.lastSyncedAt,
          changedSinceSync: local.signature !== meta.signature,
          hasData: hasData(local.portfolio),
        },
        online ? { updatedAt: online.updatedAt } : null,
      );
      if (plan === "pull" && online) return pull(online);
      if (plan === "push") {
        setStatus("saving");
        await push();
      }
      ready.current = true;
      setProblem(null);
      setStatus("saved");
    } catch (error) {
      fail(error);
    } finally {
      busy.current = false;
    }
  }, [META_KEY, pull, push, fail]);

  React.useEffect(() => {
    void Promise.resolve().then(check);
  }, [check]);

  // Every few seconds: anything changed here is saved online. `check` looks at
  // the account first, so if it was updated elsewhere in the meantime the
  // account's copy is loaded instead of being overwritten (the account wins).
  React.useEffect(() => {
    const timer = window.setInterval(() => {
      if (!ready.current || busy.current) return;
      if (readLocal().signature === loadMeta(META_KEY).signature) return;
      void check();
    }, CHECK_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [META_KEY, check]);

  const value = React.useMemo(
    () => ({ status, lastSyncedAt, problem, retry: () => void check() }),
    [status, lastSyncedAt, problem, check],
  );

  return <AccountSyncContext.Provider value={value}>{children}</AccountSyncContext.Provider>;
}

/** The save status in the top bar. */
export function AccountSyncStatus() {
  const { status, lastSyncedAt, problem, retry } = useAccountSync();
  const when = lastSyncedAt
    ? ` · ${formatDate(new Date(lastSyncedAt))} ${new Date(lastSyncedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
    : "";
  const view = {
    loading: { icon: <Loader2 className="size-4 animate-spin" aria-hidden />, label: "Loading your saved data…" },
    saving: { icon: <Loader2 className="size-4 animate-spin" aria-hidden />, label: "Saving to your account…" },
    saved: {
      icon: <CloudCheck className="size-4 text-emerald-600" aria-hidden />,
      label: `Saved to your account${when}`,
    },
    error: {
      icon: <CloudAlert className="size-4 text-destructive" aria-hidden />,
      label: `${problem ?? "Could not save your data."} Click to try again.`,
    },
  }[status];
  return (
    <Tip label={view.label}>
      <Button variant="ghost" size="icon" onClick={status === "error" ? retry : undefined} aria-label={view.label}>
        {view.icon}
      </Button>
    </Tip>
  );
}
