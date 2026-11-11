"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, Loader2, LogIn, MailCheck } from "lucide-react";
import { useSignIn } from "@clerk/nextjs/legacy";

import { Button } from "@/components/ui/button";
import { LiquidMetalButton } from "@/components/ui/liquid-metal-button";
import { Input } from "@/components/ui/input";
import { Field, PasswordInput, messageOf } from "@/components/auth/otp-sign-up";
import { emailInput } from "@/lib/input-filters";
import { checkEmail, otpInput } from "@/lib/auth-fields";

/**
 * Sign in with email and password (no email is sent). "Forgot password?"
 * resets it: a 6-digit code is emailed, then the user chooses a new password
 * and is signed in. A one-time sign-in code by email is offered as well.
 */
export function OtpSignIn() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const router = useRouter();
  const params = useSearchParams();
  // /sign-in?reset=1 opens straight on "reset your password", for sharing as a link.
  const [step, setStep] = React.useState<"password" | "email" | "code" | "reset-email" | "reset-code">(() =>
    params.get("reset") ? "reset-email" : "password",
  );
  const [newPassword, setNewPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
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

  /** Emails a password-reset code to the account. */
  async function sendResetCode(e: React.FormEvent) {
    e.preventDefault();
    const problem = checkEmail(email);
    setError(problem);
    if (problem || !isLoaded) return;
    setBusy(true);
    try {
      await signIn.create({ strategy: "reset_password_email_code", identifier: email.trim() });
      setCode("");
      setNewPassword("");
      setConfirm("");
      setStep("reset-code");
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  /** Checks the code, sets the new password, and signs in. */
  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded) return;
    const problem =
      code.length !== 6
        ? "Enter the 6-digit code from the email."
        : !newPassword
          ? "Choose a new password."
          : confirm !== newPassword
            ? "The two passwords do not match."
            : null;
    setError(problem);
    if (problem) return;
    setBusy(true);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code,
        password: newPassword,
      });
      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        router.push(destination());
      } else {
        setError("Your password was changed, but sign-in needs another step. Sign in with the new password.");
        setPassword("");
        setStep("password");
      }
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  if (step === "reset-email") {
    return (
      <form onSubmit={sendResetCode} className="space-y-4" noValidate>
        <p className="text-sm text-muted-foreground">
          Enter the email you signed up with. We&apos;ll email a 6-digit code to reset your password.
        </p>
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
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <KeyRound className="size-4" aria-hidden />}
          Send reset code
        </Button>
        <button
          type="button"
          onClick={() => {
            setStep("password");
            setError(null);
          }}
          className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          Back to sign in
        </button>
      </form>
    );
  }

  if (step === "reset-code") {
    return (
      <form onSubmit={resetPassword} className="space-y-4" noValidate>
        <p className="rounded-xl bg-muted/50 px-3 py-2 text-sm">
          We emailed a 6-digit code to <span className="font-semibold">{email.trim()}</span>. Check spam if it
          doesn&apos;t arrive.
        </p>
        <Field label="Code">
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
        <Field label="New password">
          <PasswordInput value={newPassword} onChange={setNewPassword} show={show} onToggle={() => setShow((v) => !v)} autoComplete="new-password" />
        </Field>
        <Field label="Confirm new password">
          <PasswordInput value={confirm} onChange={setConfirm} show={show} onToggle={() => setShow((v) => !v)} autoComplete="new-password" />
        </Field>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <KeyRound className="size-4" aria-hidden />}
          Reset password and sign in
        </Button>
        <button
          type="button"
          onClick={() => {
            setStep("reset-email");
            setError(null);
          }}
          className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          Didn&apos;t get it? Send the code again
        </button>
      </form>
    );
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
        <LiquidMetalButton
          type="submit"
          label="Sign in"
          icon={<LogIn className="size-4" aria-hidden />}
          busy={busy}
          disabled={!isLoaded}
          fullWidth
        />
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setStep("reset-email");
              setError(null);
            }}
            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <KeyRound className="size-3.5" aria-hidden /> Forgot password? Reset it
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setError(null);
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Or sign in with a code sent to your email
          </button>
        </div>
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
