"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, Loader2, LogIn, MailCheck } from "lucide-react";
import { useSignIn } from "@clerk/nextjs/legacy";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, PasswordInput, messageOf } from "@/components/auth/otp-sign-up";
import { emailInput } from "@/lib/input-filters";
import { checkEmail, otpInput } from "@/lib/auth-fields";

/**
 * Sign in with email and password (no email is sent). "Forgot password?"
 * switches to a one-time code emailed to the account instead.
 */
export function OtpSignIn() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = React.useState<"password" | "email" | "code">("password");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  /** Back to the page the user was opening, but only a page on this site. */
  function destination(): string {
    const back = params.get("redirect_url");
    try {
      const url = back ? new URL(back, window.location.origin) : null;
      if (url && url.origin === window.location.origin && !url.pathname.startsWith("/sign-")) {
        return url.pathname + url.search;
      }
    } catch {
      /* fall through */
    }
    return "/dashboard";
  }

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    const problem = checkEmail(email) ?? (password ? null : "Enter your password.");
    setError(problem);
    if (problem || !isLoaded) return;
    setBusy(true);
    try {
      const result = await signIn.create({ identifier: email.trim(), password });
      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        router.push(destination());
      } else {
        setError("Sign-in could not be completed. Try \"Email me a code\" below.");
      }
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    const problem = checkEmail(email);
    setError(problem);
    if (problem || !isLoaded) return;
    setBusy(true);
    try {
      const attempt = await signIn.create({ identifier: email.trim() });
      const factor = attempt.supportedFirstFactors?.find((f) => f.strategy === "email_code");
      if (!factor || !("emailAddressId" in factor)) {
        setError("Sign-in by email code is not switched on for this site.");
        return;
      }
      await signIn.prepareFirstFactor({ strategy: "email_code", emailAddressId: factor.emailAddressId });
      setStep("code");
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded) return;
    if (code.length !== 6) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    setBusy(true);
    try {
      const result = await signIn.attemptFirstFactor({ strategy: "email_code", code });
      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        router.push(destination());
      } else {
        setError("Sign-in could not be completed. Try again.");
      }
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  if (step === "code") {
    return (
      <form onSubmit={verify} className="space-y-4">
        <p className="rounded-xl bg-muted/50 px-3 py-2 text-sm">
          We emailed a 6-digit code to <span className="font-semibold">{email.trim()}</span>. Check spam if it
          doesn&apos;t arrive.
        </p>
        <Field label="Code" error={error ?? undefined}>
          <Input
            value={code}
            onChange={(e) => setCode(otpInput(e.target.value))}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="6 digits"
            className="text-center text-lg tracking-[0.4em] tabular"
          />
        </Field>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <MailCheck className="size-4" aria-hidden />}
          Verify and sign in
        </Button>
        <button
          type="button"
          onClick={() => {
            setStep("email");
            setCode("");
            setError(null);
          }}
          className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          Use a different email
        </button>
      </form>
    );
  }

  if (step === "password") {
    return (
      <form onSubmit={signInWithPassword} className="space-y-4" noValidate>
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(emailInput(e.target.value))}
            placeholder="you@firm.in"
            autoComplete="email"
            autoFocus
          />
        </Field>
        <Field label="Password">
          <PasswordInput value={password} onChange={setPassword} show={show} onToggle={() => setShow((v) => !v)} autoComplete="current-password" />
        </Field>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div id="clerk-captcha" />
        <Button type="submit" className="w-full" disabled={busy || !isLoaded}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LogIn className="size-4" aria-hidden />}
          Sign in
        </Button>
        <button
          type="button"
          onClick={() => {
            setStep("email");
            setError(null);
          }}
          className="flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <KeyRound className="size-3.5" aria-hidden /> Forgot password? Email me a code instead
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={sendCode} className="space-y-4" noValidate>
      <Field label="Email" error={error ?? undefined}>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(emailInput(e.target.value))}
          placeholder="you@firm.in"
          autoComplete="email"
          autoFocus
        />
      </Field>
      <div id="clerk-captcha" />
      <Button type="submit" className="w-full" disabled={busy || !isLoaded}>
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <MailCheck className="size-4" aria-hidden />}
        Email me a code
      </Button>
      <button
        type="button"
        onClick={() => {
          setStep("password");
          setError(null);
        }}
        className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
      >
        Sign in with password instead
      </button>
    </form>
  );
}
