"use client";

import * as React from "react";
import { CloudAlert, CloudCheck, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Tip } from "@/components/shared/tip";
import { formatDate } from "@/lib/dates";
import { syncPlan, type AccountData } from "@/lib/sync-plan";
import { USER_DATA_KEYS } from "@/lib/user-storage";

/**
 * Saves the signed-in user's data on the server under their account (via
 * /api/data), so the same login shows the same companies on any computer. Fully automatic:
 * when the app opens the newest copy is brought in, and every change here is
 * saved within a few seconds. Nothing to connect or click.
 */

const PORTFOLIO_KEY = USER_DATA_KEYS[0];
/** Saved online besides the companies: checklists, saved documents, firm details. */
const EXTRA_KEYS = ["complykit.checklists.v1", "complykit.documents.v1", "complykit.documents.firm.v1"];
const CHECK_EVERY_MS = 4000;

type Status = "loading" | "saving" | "saved" | "error";
type Meta = { lastSyncedAt: number | null; signature: string | null };

function readLocal() {
  const raw = localStorage.getItem(PORTFOLIO_KEY);
  const extras: Record<string, string> = {};
  for (const k of EXTRA_KEYS) {
    const v = localStorage.getItem(k);
    if (v !== null) extras[k] = v;
  }
  return {
    portfolio: raw ? (JSON.parse(raw) as AccountData["portfolio"]) : null,
    extras,
    signature: `${raw ?? ""}|${EXTRA_KEYS.map((k) => extras[k] ?? "").join("|")}`,
  };
}

function hasData(p: AccountData["portfolio"] | null): boolean {
  return !!p && (p.clients?.length > 0 || p.directors?.length > 0 || (p.consultants?.length ?? 0) > 0);
}

/** Puts the online copy into this browser (the page then reloads to show it). */
function writeLocal(data: AccountData) {
  localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(data.portfolio));
  for (const k of EXTRA_KEYS) {
    if (data.extras[k] !== undefined) localStorage.setItem(k, data.extras[k]);
    else localStorage.removeItem(k);
  }
}

function loadMeta(key: string): Meta {
  const empty: Meta = { lastSyncedAt: null, signature: null };
  if (typeof window === "undefined") return empty;
  try {
    return { ...empty, ...JSON.parse(localStorage.getItem(key) ?? "{}") };
  } catch {
    return empty;
  }
}

/** The server's own explanation when saving or loading fails (e.g. "Sign in with Google…"). */
async function reason(res: Response, fallback: string): Promise<Error> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return new Error(body.error ?? fallback);
}

async function fetchOnline(): Promise<AccountData | null> {
  const res = await fetch("/api/data", { cache: "no-store" });
  if (!res.ok) throw await reason(res, "Could not load your saved data.");
  return ((await res.json()) as { data: AccountData | null }).data;
}

async function saveOnline(data: AccountData): Promise<void> {
  const res = await fetch("/api/data", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw await reason(res, "Could not save your data.");
}

type AccountSync = { status: Status; lastSyncedAt: number | null; problem: string | null; retry: () => void };
const AccountSyncContext = React.createContext<AccountSync | null>(null);

export function useAccountSync(): AccountSync {
  const ctx = React.useContext(AccountSyncContext);
  if (!ctx) throw new Error("useAccountSync must be used inside AccountSyncProvider");
  return ctx;
}

export function AccountSyncProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const META_KEY = `complykit.sync@${userId}`;
  const [status, setStatus] = React.useState<Status>("loading");
  const [lastSyncedAt, setLastSyncedAt] = React.useState<number | null>(() => loadMeta(META_KEY).lastSyncedAt);
  const [choice, setChoice] = React.useState<AccountData | null>(null);
  const [problem, setProblem] = React.useState<string | null>(null);
  const fail = React.useCallback((error: unknown) => {
    console.error("Account sync failed", error);
    setProblem(error instanceof Error ? error.message : null);
    setStatus("error");
  }, []);
  const busy = React.useRef(false);
  // Until the first check is done, nothing is saved (so an empty computer never overwrites the online copy).
  const ready = React.useRef(false);

  const writeMeta = React.useCallback(
    (m: Partial<Meta>) => {
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
    (online: AccountData) => {
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
        { lastSyncedAt: meta.lastSyncedAt, changedSinceSync: local.signature !== meta.signature, hasData: hasData(local.portfolio) },
        online ? { updatedAt: online.updatedAt } : null,
      );
      if (plan === "pull" && online) return pull(online);
      if (plan === "ask" && online) {
        setChoice(online);
        setStatus("saved");
        return;
      }
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

  // Every few seconds: anything changed here since the last save is saved online.
  React.useEffect(() => {
    const timer = window.setInterval(() => {
      if (!ready.current || busy.current || choice) return;
      if (readLocal().signature === loadMeta(META_KEY).signature) return;
      busy.current = true;
      setStatus("saving");
      push()
        .then(() => {
          setProblem(null);
          setStatus("saved");
        })
        .catch(fail)
        .finally(() => {
          busy.current = false;
        });
    }, CHECK_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [META_KEY, push, choice, fail]);

  const value = React.useMemo(
    () => ({ status, lastSyncedAt, problem, retry: () => void check() }),
    [status, lastSyncedAt, problem, check],
  );

  return (
    <AccountSyncContext.Provider value={value}>
      {children}
      {/* This computer and the online copy both have different data: the user decides. */}
      <Dialog open={choice !== null} onOpenChange={(o) => (o ? null : setChoice(null))}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle className="font-heading text-lg">Which data do you want to keep?</DialogTitle>
          <DialogDescription>
            Your account has data saved online on {choice ? formatDate(new Date(choice.updatedAt)) : ""} with{" "}
            {choice?.portfolio.clients.length ?? 0} companies, and this computer has different data.
          </DialogDescription>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="outline"
              onClick={() => {
                setChoice(null);
                setStatus("saving");
                push()
                  .then(() => {
                    ready.current = true;
                    setStatus("saved");
                  })
                  .catch(() => setStatus("error"));
              }}
            >
              Keep this computer&apos;s data
            </Button>
            <Button onClick={() => choice && pull(choice)}>Use my saved online data</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AccountSyncContext.Provider>
  );
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
    saved: { icon: <CloudCheck className="size-4 text-emerald-600" aria-hidden />, label: `Saved to your account${when}` },
    error: {
      icon: <CloudAlert className="size-4 text-destructive" aria-hidden />,
      label: `${problem ?? "Could not save your data."} Click to try again.`,
    },
  }[status];
  return (
    <Tip label={view.label}>
      <Button
        variant="ghost"
        size="icon"
        onClick={status === "error" ? retry : undefined}
        aria-label={view.label}
      >
        {view.icon}
      </Button>
    </Tip>
  );
}
