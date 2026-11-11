import Link from "next/link";

import { BrandLockup } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

/**
 * The CA Compliance Tool login card, with Clerk's form inside it: the brand at the
 * top, a Sign in / Create account switch, then the form. Shown to everyone
 * who opens the site signed out.
 */
export function AuthShell({ mode, children }: { mode: "sign-in" | "sign-up"; children: React.ReactNode }) {
  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="w-full max-w-md space-y-5 rounded-3xl border bg-card p-6 shadow-card sm:p-7">
        <div className="flex flex-col items-center gap-2 text-center">
          <BrandLockup size="md" />
          <p className="text-sm text-muted-foreground">
            {mode === "sign-in" ? "Sign in to your account" : "Create your free account"}
          </p>
        </div>

        <nav aria-label="Sign in or create an account" className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
          {(
            [
              ["sign-in", "/sign-in", "Sign in"],
              ["sign-up", "/sign-up", "Create account"],
            ] as const
          ).map(([value, href, label]) => (
            <Link
              key={value}
              href={href}
              aria-current={mode === value ? "page" : undefined}
              className={cn(
                "rounded-full py-2 text-center text-sm font-medium transition-colors",
                mode === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        {children}

        <p className="text-center text-[11px] text-muted-foreground">
          Your companies and directors are saved securely to your account.
        </p>
      </div>
    </main>
  );
}

/**
 * Clerk's form, restyled to sit inside the card: no box or heading of its
 * own (the card has them), CA Compliance Tool's colour, font and rounded fields.
 */
export const clerkAppearance = {
  // The site's own theme colours, so the form follows light and dark mode with the card.
  variables: {
    colorPrimary: "var(--primary)",
    colorPrimaryForeground: "var(--primary-foreground)",
    colorBackground: "var(--card)",
    colorForeground: "var(--foreground)",
    colorMuted: "var(--muted)",
    colorMutedForeground: "var(--muted-foreground)",
    colorInput: "var(--background)",
    colorInputForeground: "var(--foreground)",
    colorBorder: "var(--border)",
    colorRing: "var(--ring)",
    fontFamily: "var(--font-jakarta), ui-sans-serif, system-ui, sans-serif",
    borderRadius: "0.9rem",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full max-w-none border-0 shadow-none",
    card: "w-full border-0 bg-transparent p-0 shadow-none",
    header: "hidden",
    footerAction: "hidden",
    formButtonPrimary: "rounded-full",
    socialButtonsBlockButton: "rounded-full",
  },
};
