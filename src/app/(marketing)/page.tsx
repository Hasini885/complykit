import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  BookOpen,
  Building2,
  CalendarCheck2,
  CalendarDays,
  FileCheck2,
  HardDrive,
  Lock,
  ShieldCheck,
  Sparkles,
  UserX,
} from "lucide-react";

import { site, legal, MCA_URL } from "@/config/site";
import { allNavItems, LAW_UPDATED } from "@/config/navigation";
import { forms } from "@/data/forms";
import { sections } from "@/data/sections";
import { checklists } from "@/data/checklists";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { IconTile, tintFor } from "@/components/shared/icon-tile";
import { AlertsSignup } from "@/components/alerts-signup";
import { SiteFooter } from "@/components/site-footer";
import { LandingHeader } from "@/components/landing/landing-header";
import { ProductPreview } from "@/components/landing/product-preview";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: { absolute: `${site.name}: never miss an MCA deadline` },
  description: site.description,
};

/** Everything except the dashboard, which the hero CTA already opens. */
const FEATURES = allNavItems.filter((item) => item.href !== "/dashboard");

const STEPS = [
  {
    icon: Building2,
    tint: "violet" as const,
    title: "Add your companies",
    body: "Enter each client's CIN, type, incorporation date and last AGM. Directors and DINs go in the Director Master.",
  },
  {
    icon: CalendarCheck2,
    tint: "sky" as const,
    title: "See every due date",
    body: "Statutory dues are worked out from each company's own dates, ranked by urgency, and gathered in one dashboard.",
  },
  {
    icon: FileCheck2,
    tint: "pink" as const,
    title: "File on time",
    body: "Generate the notices and resolutions, tick off the checklist, estimate any late fee, and record the SRN when it's filed.",
  },
];

const FAQ = [
  {
    q: "Is it really free?",
    a: "Yes. There is no account, no trial and nothing to pay. Every form, section, calculator and due date is open to anyone.",
  },
  {
    q: "Where is my client data stored?",
    a: "In your own browser, and nowhere else. Companies and directors are never uploaded to a server. The one exception: when a PDF can't be read in the browser, that file is sent to an AI service to extract its text.",
  },
  {
    q: "How current is the law?",
    a: `The reference was last updated in ${LAW_UPDATED}. Thresholds, fees and due dates change by notification and circular, so always check the latest position on the MCA portal before you file.`,
  },
  {
    q: "Is this legal advice?",
    a: legal.disclaimer,
  },
];

export default function LandingPage() {
  return (
    <div className="relative isolate min-h-full overflow-x-clip">
      <div aria-hidden className="pastel-wash pointer-events-none absolute inset-x-0 top-0 -z-10 h-[820px]" />

      <LandingHeader />

      <main>
        {/* ------------------------------------------------------------ hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pt-16 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-24 lg:pb-28">
          <div>
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card/70 px-3.5 py-1.5 text-xs font-semibold text-muted-foreground shadow-card backdrop-blur">
              <Sparkles className="size-3.5 text-pink-500" aria-hidden />
              Free forever · No sign-up · Companies Act, 2013
            </p>
            <h1 className="font-heading text-5xl leading-[1.02] font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
              Never miss an{" "}
              <span className="bg-gradient-to-r from-sky-500 via-violet-500 to-pink-500 bg-clip-text text-transparent">
                MCA deadline
              </span>{" "}
              again.
            </h1>
            <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-muted-foreground">
              {site.name} is a friendly compliance workspace for CA, CS and finance teams. It tracks
              every client&apos;s ROC filings, explains each form and section in plain language, and
              drafts the paperwork for you.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/dashboard">
                  Open your dashboard <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/forms">
                  <BookOpen className="size-4" aria-hidden /> Browse the forms library
                </Link>
              </Button>
            </div>
            <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="size-4 text-emerald-500" aria-hidden />
              Your client data stays in your browser.
            </p>
          </div>

          <ProductPreview className="mx-auto w-full max-w-xl lg:max-w-none" />
        </section>

        {/* ----------------------------------------------------------- stats */}
        <section aria-label={`${site.name} at a glance`} className="mx-auto max-w-6xl px-4 sm:px-6">
          <dl className="grid grid-cols-2 gap-3 rounded-[2rem] border bg-card/80 p-3 shadow-card backdrop-blur sm:gap-4 lg:grid-cols-4">
            <Stat value={forms.length} label="MCA e-forms explained" />
            <Stat value={sections.length} label="Companies Act sections in plain language" />
            <Stat value={checklists.length} label="ready-made compliance checklists" />
            <Stat value="₹0" label="to use, forever" />
          </dl>
        </section>

        {/* -------------------------------------------------------- features */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-24 sm:px-6">
          <SectionHeading
            eyebrow="Everything in one place"
            title="All the tools your compliance desk reaches for"
            lede="From the first SPICe+ to the annual return, every tool works off the same list of companies."
          />
          {/* Bento: the first two tools get double-width tiles, so the rest fill whole rows of four. */}
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((item, i) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group rounded-3xl border bg-card p-6 shadow-card transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lift",
                  i < 2 && "lg:col-span-2 lg:p-8",
                )}
              >
                <IconTile
                  icon={item.icon}
                  tint={tintFor(item.href)}
                  size="lg"
                  className="transition-transform duration-200 group-hover:scale-105 group-hover:-rotate-3"
                />
                <h3 className="mt-5 flex items-center gap-2 text-lg font-bold">
                  {item.title}
                  <ArrowRight
                    className="size-4 -translate-x-1 text-primary opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                    aria-hidden
                  />
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------- how it works */}
        <section id="how-it-works" className="scroll-mt-24 bg-gradient-to-b from-transparent via-accent/50 to-transparent py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="How it works"
              title="From a list of clients to on-time filings in three steps"
            />
            <ol className="mt-12 grid gap-4 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="relative rounded-3xl border bg-card p-6 shadow-card">
                  <span className="absolute top-6 right-6 font-mono text-5xl font-bold text-muted/90 dark:text-muted" aria-hidden>
                    {i + 1}
                  </span>
                  <IconTile icon={step.icon} tint={step.tint} size="lg" />
                  <h3 className="mt-5 text-lg font-bold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* --------------------------------------------------------- privacy */}
        <section id="privacy" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-24 sm:px-6">
          <div className="grid items-center gap-10 overflow-hidden rounded-[2.5rem] border bg-gradient-to-br from-sky-50 via-violet-50 to-pink-50 p-8 shadow-card sm:p-12 lg:grid-cols-2 dark:from-sky-500/10 dark:via-violet-500/10 dark:to-pink-500/10">
            <div>
              <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                <ShieldCheck className="size-3.5" aria-hidden /> Private by design
              </p>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Your clients&apos; data never leaves your browser.</h2>
              <p className="mt-4 max-w-[52ch] leading-relaxed text-muted-foreground">
                There&apos;s no account and no server-side database. The portfolio lives in this
                browser&apos;s storage, so nobody else, including us, can see who your clients are.
              </p>
            </div>
            <ul className="grid gap-3">
              <PrivacyPoint icon={HardDrive} tint="sky" title="Stored locally" body="Companies, directors and checklists are saved in your browser only." />
              <PrivacyPoint icon={UserX} tint="violet" title="No sign-up, no account" body="Open it and start working. There's nothing to register and no password to forget." />
              <PrivacyPoint icon={BellRing} tint="pink" title="Alerts are opt-in" body="Deadline emails are a separate list, and nothing on the site requires them." />
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------------------- FAQ */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-24 px-4 pb-24 sm:px-6">
          <SectionHeading eyebrow="FAQ" title="Questions, answered" />
          <Accordion type="single" collapsible className="mt-10 space-y-3">
            {FAQ.map((f, i) => (
              <AccordionItem key={f.q} value={`faq-${i}`} className="rounded-3xl border bg-card px-6 shadow-card">
                <AccordionTrigger className="py-5 text-base font-semibold hover:no-underline">{f.q}</AccordionTrigger>
                <AccordionContent className="pb-5 leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* ------------------------------------------------------- final CTA */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-sky-500 via-violet-600 to-pink-500 px-8 py-16 text-center text-white shadow-lift sm:px-16">
            <div aria-hidden className="absolute -top-24 -left-16 size-72 rounded-full bg-white/15 blur-3xl" />
            <div aria-hidden className="absolute -right-10 -bottom-28 size-80 rounded-full bg-pink-300/30 blur-3xl" />
            <h2 className="relative mx-auto max-w-[22ch] text-3xl font-extrabold tracking-tight sm:text-5xl">
              Make this filing season the calm one.
            </h2>
            <p className="relative mx-auto mt-4 max-w-[50ch] text-white/85 sm:text-lg">
              Add your first company in under a minute. No sign-up, no card, no catch.
            </p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="bg-white text-violet-700 shadow-lg shadow-black/10 hover:bg-white/90">
                <Link href="/portfolio">
                  Add your first company <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="text-white hover:bg-white/15 hover:text-white">
                <Link href="/due-dates">
                  <CalendarDays className="size-4" aria-hidden /> See the compliance calendar
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pt-16 sm:px-6">
          <AlertsSignup />
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Compiled from the{" "}
            <a href={MCA_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">
              Ministry of Corporate Affairs
            </a>{" "}
            and the Companies Act, 2013. Law updated {LAW_UPDATED}.
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function SectionHeading({ eyebrow, title, lede }: { eyebrow: string; title: string; lede?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="mb-4 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{eyebrow}</p>
      <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      {lede ? <p className="mt-4 text-lg text-muted-foreground">{lede}</p> : null}
    </div>
  );
}

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col rounded-3xl bg-background/70 px-5 py-6 text-center">
      <dt className="order-2 mt-2 text-sm text-muted-foreground">{label}</dt>
      <dd className="tabular order-1 bg-gradient-to-r from-sky-500 via-violet-500 to-pink-500 bg-clip-text text-4xl font-extrabold text-transparent">
        {value}
      </dd>
    </div>
  );
}

function PrivacyPoint({
  icon,
  tint,
  title,
  body,
}: {
  icon: React.ComponentProps<typeof IconTile>["icon"];
  tint: React.ComponentProps<typeof IconTile>["tint"];
  title: string;
  body: string;
}) {
  return (
    <li className="flex items-start gap-4 rounded-3xl bg-card/80 p-4 shadow-card backdrop-blur">
      <IconTile icon={icon} tint={tint} />
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{body}</span>
      </span>
    </li>
  );
}
