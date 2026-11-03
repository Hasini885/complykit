import Link from "next/link";
import { Scale } from "lucide-react";

import { site } from "@/config/site";

/** Public pages for the Privacy Policy and Terms: simple, readable, no sign-in. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b bg-card/70">
        <div className="mx-auto flex max-w-3xl items-center gap-2.5 px-4 py-4">
          <span
            aria-hidden
            className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 via-violet-500 to-pink-400 text-white"
          >
            <Scale className="size-4" />
          </span>
          <Link href="/" className="font-heading text-lg font-bold">
            {site.name}
          </Link>
          <nav className="ml-auto flex gap-4 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <article className="space-y-4 text-[15px] leading-relaxed [&_h1]:font-heading [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:mt-8 [&_h2]:font-heading [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc">
          {children}
        </article>
      </main>
    </div>
  );
}
