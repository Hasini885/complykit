"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, MailCheck, UserPlus } from "lucide-react";
import { useSignUp } from "@clerk/nextjs/legacy";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { emailInput, mobileInput, personNameInput } from "@/lib/input-filters";
import { normaliseMobile } from "@/lib/portfolio/mobile";
import { checkSignUp, otpInput } from "@/lib/auth-fields";

type SignUpLike = NonNullable<ReturnType<typeof useSignUp>["signUp"]>;

/**
 * Create an account: name, mobile (required), email and a password. No code
 * is needed; the account opens straight away. (If the Clerk settings still
 * require the email to be verified at sign-up, a code is emailed instead, so
 * the form works either way.)
 */
export function OtpSignUp() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();
  const [step, setStep] = React.useState<"details" | "code">("details");
  const [name, setName] = React.useState("");
  const [mobile, setMobile] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  /** Opens the account if Clerk has all it needs; fills the name in when Clerk asks for it. */
  async function finish(result: SignUpLike): Promise<boolean> {
    let r = result;
    const wantsName = r.missingFields.some((f) => f === "first_name" || f === "last_name");
    if (r.status === "missing_requirements" && wantsName) {
      const [first, ...rest] = name.trim().split(/\s+/);
      r = await r.update({ firstName: first, lastName: rest.join(" ") || first });
    }
    if (r.status === "complete" && r.createdSessionId && setActive) {
      await setActive({ session: r.createdSessionId });
      router.push("/dashboard");
      return true;
    }
    return false;
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const found = checkSignUp({ name, mobile, email, password, confirm });
    setErrors(found);
    if (Object.keys(found).length > 0 || !isLoaded) return;
    setBusy(true);
    try {
      const result = await signUp.create({
        emailAddress: email.trim(),
        password,
        unsafeMetadata: { name: name.trim(), mobile: normaliseMobile(mobile) },
      });
      if (await finish(result)) return;
      // Clerk is set to verify the email at sign-up: send the code after all.
      if (result.unverifiedFields.includes("email_address")) {
        await result.prepareEmailAddressVerification({ strategy: "email_code" });
        setStep("code");
        return;
      }
      setErrors({ form: missingMessage(result.missingFields) });
    } catch (error) {
      const message = messageOf(error);
      setErrors(/password/i.test(message) ? { password: message } : { form: message });
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded) return;
    if (code.length !== 6) {
      setErrors({ code: "Enter the 6-digit code from the email." });
      return;
    }
    setBusy(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (!(await finish(result))) setErrors({ form: missingMessage(result.missingFields) });
    } catch (error) {
      setErrors({ code: messageOf(error) });
    } finally {
      setBusy(false);
    }
  }

  if (step === "code") {
    return (
      <form onSubmit={verify} className="space-y-4">
        <p className="rounded-xl bg-muted/50 px-3 py-2 text-sm">
          We emailed a 6-digit code to <span className="font-semibold">{email.trim()}</span>. It may take a minute;
          check spam too.
        </p>
        <Field label="Code" error={errors.code}>
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
        {errors.form ? <p className="text-sm text-destructive">{errors.form}</p> : null}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <MailCheck className="size-4" aria-hidden />}
          Verify and create account
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={create} className="space-y-4" noValidate>
      <Field label="Full name" error={errors.name}>
        <Input value={name} onChange={(e) => setName(personNameInput(e.target.value))} autoComplete="name" autoFocus />
      </Field>
      <Field label="Mobile number" error={errors.mobile}>
        <Input
          type="tel"
          inputMode="tel"
          value={mobile}
          onChange={(e) => setMobile(mobileInput(e.target.value))}
          placeholder="98765 43210"
          autoComplete="tel-national"
          className="tabular"
        />
      </Field>
      <Field label="Email" error={errors.email}>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(emailInput(e.target.value))}
          placeholder="you@firm.in"
          autoComplete="email"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Password" error={errors.password}>
          <PasswordInput value={password} onChange={setPassword} show={show} onToggle={() => setShow((v) => !v)} autoComplete="new-password" />
        </Field>
        <Field label="Confirm password" error={errors.confirm}>
          <PasswordInput value={confirm} onChange={setConfirm} show={show} onToggle={() => setShow((v) => !v)} autoComplete="new-password" />
        </Field>
      </div>
      {errors.form ? <p className="text-sm text-destructive">{errors.form}</p> : null}
      {/* Clerk's bot protection shows here when it is needed. */}
      <div id="clerk-captcha" />
      <Button type="submit" className="w-full" disabled={busy || !isLoaded}>
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <UserPlus className="size-4" aria-hidden />}
        Create account
      </Button>
    </form>
  );
}

export function PasswordInput({
  value,
  onChange,
  show,
  onToggle,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  autoComplete: string;
}) {
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 128))}
        autoComplete={autoComplete}
        className="pr-10"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  );
}

export function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</span>
      {children}
      {error ? <span className="block text-xs text-destructive">{error}</span> : null}
    </label>
  );
}

/**
 * What Clerk still wants, and the setting to change in the Clerk dashboard
 * (Configure → User & authentication).
 */
export function missingMessage(missing: string[]): string {
  const labels: Record<string, string> = {
    phone_number: "a verified phone number (turn Phone number off)",
    username: "a username (turn Username off)",
    legal_accepted: "acceptance of legal terms (turn Legal consent off)",
  };
  const named = missing.map((f) => labels[f] ?? f.replace(/_/g, " "));
  return named.length > 0
    ? `The sign-up settings also ask for ${named.join(", ")}. Change that in the Clerk dashboard, then try again.`
    : "The account could not be completed. Try again.";
}

/** Clerk's own explanation of a failed step (e.g. "That email address is taken"). */
export function messageOf(error: unknown): string {
  if (isClerkAPIResponseError(error)) {
    const first = error.errors[0];
    return first?.longMessage ?? first?.message ?? "Something went wrong. Try again.";
  }
  return "Something went wrong. Check your connection and try again.";
}
