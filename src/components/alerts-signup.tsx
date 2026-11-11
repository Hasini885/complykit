"use client";

import * as React from "react";
import { BellRing, Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkEmail } from "@/lib/email";
import { cn } from "@/lib/utils";

type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "done" }
  | { kind: "error"; message: string };

/**
 * Newsletter signup for deadline alerts.
 *
 * This gates nothing. Every form, section and due date on the site stays
 * readable without an address — the list is a separate thing you can opt into.
 */
export function AlertsSignup({ className }: { className?: string }) {
  const [email, setEmail] = React.useState("");
  const [website, setWebsite] = React.useState(""); // honeypot
  const [state, setState] = React.useState<State>({ kind: "idle" });
  const messageId = React.useId();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.kind === "sending") return;

    const check = checkEmail(email);
    if (!check.ok) {
      setState({ kind: "error", message: check.reason });
      return;
    }

    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: check.email, website }),
      });
      const data: { error?: string } = await res.json().catch(() => ({}));

      if (!res.ok) {
        setState({
          kind: "error",
          message: data.error ?? "Something went wrong. Please try again.",
        });
        return;
      }
      setState({ kind: "done" });
      setEmail("");
    } catch {
      setState({
        kind: "error",
        message: "We could not reach the server. Check your connection and try again.",
      });
    }
  }

  if (state.kind === "done") {
    return (
      <aside className={cn("rounded-3xl border border-primary/30 bg-primary/5 p-6", className)}>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-4" aria-hidden />
          </span>
          <div>
            <p className="font-heading text-lg font-semibold">Check your inbox</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Confirm the subscription from the email we just sent and the next deadline round-up
              will reach you. Nothing else, and you can leave any time.
            </p>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className={cn("relative overflow-hidden rounded-3xl border-2 border-dashed border-primary/25 bg-transparent p-6 sm:p-8", className)}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary"
        >
          <BellRing className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-lg font-semibold">Get compliance deadline alerts</h2>
          <p className="mt-1 max-w-[62ch] text-sm text-muted-foreground">
            A short email before the filings that matter — AOC-4, MGT-7, DIR-3 KYC, DPT-3 and the
            half-yearly returns — plus a note when a due date is extended by circular.
          </p>

          <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <div className="flex-1">
              <label htmlFor="alerts-email" className="sr-only">
                Email address
              </label>
              <Input
                id="alerts-email"
                type="email"
                name="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@firm.co.in"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (state.kind === "error") setState({ kind: "idle" });
                }}
                aria-invalid={state.kind === "error"}
                aria-describedby={messageId}
                disabled={state.kind === "sending"}
              />
            </div>

            {/* Honeypot — hidden from people, tempting to bots. */}
            <div aria-hidden className="hidden">
              <label htmlFor="alerts-website">Leave this field empty</label>
              <input
                id="alerts-website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            <Button type="submit" disabled={state.kind === "sending"} className="shrink-0">
              {state.kind === "sending" ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Signing up
                </>
              ) : (
                "Send me alerts"
              )}
            </Button>
          </form>

          <p
            id={messageId}
            role={state.kind === "error" ? "alert" : undefined}
            className={cn(
              "mt-2 text-xs",
              state.kind === "error" ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {state.kind === "error"
              ? state.message
              : "One email per cycle. No sharing, no selling, unsubscribe in one click."}
          </p>
        </div>
      </div>
    </aside>
  );
}
