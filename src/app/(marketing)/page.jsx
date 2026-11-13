import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  CalendarCheck2,
  CalendarDays,
  ClipboardPaste,
  Download,
  FileCheck2,
  HardDrive,
  KeyRound,
  Lock,
  MonitorDown,
  Puzzle,
  ShieldCheck,
  Sparkles,
  Table2,
  UserX,
  Users,
} from "lucide-react";

import { site, legal, MCA_URL } from "@/config/site";
import { allNavItems, hubTools, LAW_UPDATED } from "@/config/navigation";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { IconTile, tintFor } from "@/components/shared/icon-tile";
import { AlertsSignup } from "@/components/alerts-signup";
import { SiteFooter } from "@/components/site-footer";
import { LandingHeader } from "@/components/landing/landing-header";
import { ProductPreview } from "@/components/landing/product-preview";

export const metadata = {
  title: { absolute: `${site.name}: GST, MCA and practice tools for CAs` },
  description: site.description,
};

/**
 * Every tool and its pages, straight from the navigation, in dashboard order:
 * a tool or page added to TOOLS shows up here without touching this file.
 */
const TOOLS_ON_PAGE = hubTools();
const PAGE_COUNT = allNavItems.filter((i) => i.href !== "/dashboard").length;

/** What works the same across the tools. Add to this list when a cross-cutting feature ships. */
const HIGHLIGHTS = [
  {
    icon: Table2,
    tint: "violet",
    title: "Works like Excel",
    body: "Big, full-width sheets with gridlines, a frozen header and S.No, arrow-key and Enter navigation, and a filter on every column.",
  },
  {
    icon: ClipboardPaste,
    tint: "sky",
    title: "Paste straight from Excel",
    body: "Copy a block of rows from your existing sheet and paste it in; new rows are added for you. Delete a stray row from its S.No.",
  },
  {
    icon: Puzzle,
    tint: "pink",
    title: "Free GST Helper for Chrome",
    body: "Opens the GST portal with the client's login filled in (you type the captcha) and checks every client's GSTR-1 and 3B status for the month.",
  },
  {
    icon: CalendarCheck2,
    tint: "amber",
    title: "Deadlines on a calendar",
    body: "Post incorporation and annual MCA dues worked out from each company's own dates, plus GST return dates and task deadlines on a month view.",
  },
  {
    icon: Download,
    tint: "emerald",
    title: "Download to Excel and PDF",
    body: "Registers, filing status, task lists and consultant-wise reports (post incorporation and annual, separately) in one click.",
  },
  {
    icon: MonitorDown,
    tint: "indigo",
    title: "Install it, use it offline",
    body: "Add it to your laptop or phone home screen. It opens in its own window, keeps working without internet, and saves your changes when you're back online.",
  },
];

const STEPS = [
  {
    icon: Users,
    tint: "violet",
    title: "Add your clients once",
    body: "Companies with their CIN and dates, GST clients with GSTIN and portal login, consultants and directors. Or paste them straight from Excel.",
  },
  {
    icon: CalendarCheck2,
    tint: "sky",
    title: "See what's due",
    body: "MCA dues ranked by urgency, GSTR-1 and 3B filed or not for the month, and every open task with its deadline and assignee.",
  },
  {
    icon: FileCheck2,
    tint: "pink",
    title: "Get it done",
    body: "Generate the notices and resolutions, work out the late fee, convert the bank statement, mark returns filed and tick tasks finished.",
  },
];

const FAQ = [
  {
    q: "How much does it cost?",
    a: "Nothing at the moment: it is free to use, including the GST Helper. Create an account and start adding clients.",
  },
  {
    q: "Can I bring my existing Excel sheets?",
    a: "Yes. Copy the rows in Excel and paste them into the GST register, return status or task sheet; the columns fill in order. Everything downloads back to Excel too.",
  },
  {
    q: "Do I need to install anything?",
    a: "No, it runs in your browser. Two optional extras: the free GST Helper Chrome extension (portal autofill and bulk return status), and installing the site as an app on your laptop or phone.",
  },
  {
    q: "Where is my client data stored?",
    a: "Under your own login, in private encrypted storage, so the same account shows the same clients on any computer. Other users cannot see it. Files you upload (MCA master data, challans, bank statements) are read in your browser.",
  },
  {
    q: "Are GST portal passwords safe?",
    a: "They are saved only if you enter them, shown masked, never included in Excel downloads, and passed to the GST Helper only for the login you open (held in the extension's memory for at most 3 minutes).",
  },
  {
    q: "How current is the law?",
    a: `The MCA reference was last updated in ${LAW_UPDATED}. Thresholds, fees and due dates change by notification and circular, so always check the latest position on the MCA and GST portals before you file.`,
  },
  {
    q: "Is this legal advice?",
    a: legal.disclaimer,
  },
];

export default function LandingPage() {
  return (
    <div className="relative isolate min-h-full overflow-x-clip">
      <LandingHeader />

      <main>
        {/* ------------------------------------------------------------ hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pt-16 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-24 lg:pb-28">
          <div>
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card/70 px-3.5 py-1.5 text-xs font-semibold text-muted-foreground shadow-card backdrop-blur">
              <Sparkles className="size-3.5 text-pink-500" aria-hidden />
              Free to use · Built for CA practices
            </p>
            <h1 className="font-heading text-5xl leading-[1.02] font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
              Your whole practice,{" "}
              <span className="brand-satin-text bg-clip-text text-transparent">one workspace.</span>
            </h1>
            <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-muted-foreground">
              GST return status for every client, MCA compliance for every company, late fees, bank statements,
              documents and your team&apos;s tasks. {site.name} keeps it all in one place, in sheets that work like
              Excel.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/dashboard">
                  Open your dashboard <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#tools">See the tools</a>
              </Button>
            </div>
            <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="size-4 text-emerald-500" aria-hidden />
              Your client data is private to your account.
            </p>
          </div>

          <ProductPreview className="mx-auto w-full max-w-xl lg:max-w-none" />
        </section>

        {/* ----------------------------------------------------------- stats */}
        <section aria-label={`${site.name} at a glance`} className="mx-auto max-w-6xl px-4 sm:px-6">
          <dl className="grid grid-cols-2 gap-3 rounded-[2rem] border bg-card/80 p-3 shadow-card backdrop-blur sm:gap-4 lg:grid-cols-4">
            <Stat value={TOOLS_ON_PAGE.length} label="tools in one workspace" />
            <Stat value={PAGE_COUNT} label="registers, trackers and generators" />
            <Stat value={1} label="login, the same data on every device" />
            <Stat value="₹0" label="to use, forever" />
          </dl>
        </section>

        {/* ----------------------------------------------------------- tools */}
        <section id="tools" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-24 sm:px-6">
          <SectionHeading
            eyebrow="The tools"
            title="Everything your practice reaches for"
            lede="Each tool opens with its own pages. Your clients, companies and tasks are shared between them."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS_ON_PAGE.map((tool) => (
              <div
                key={tool.id}
                className="group flex flex-col rounded-3xl border bg-card p-6 shadow-card transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lift"
              >
                <Link href={tool.href} className="block">
                  <IconTile
                    icon={tool.icon}
                    tint={tintFor(tool.href)}
                    size="lg"
                    className="transition-transform duration-200 group-hover:scale-105 group-hover:-rotate-3"
                  />
                  <h3 className="mt-5 flex items-center gap-2 text-lg font-bold">
                    {tool.title}
                    <ArrowRight
                      className="size-4 -translate-x-1 text-primary opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                      aria-hidden
                    />
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{tool.description}</p>
                </Link>
                {tool.items.length > 1 ? (
                  <ul className="mt-4 space-y-1.5 border-t border-dashed pt-4">
                    {tool.items.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          title={item.description}
                          className="flex items-start gap-2 text-sm hover:text-primary"
                        >
                          <item.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                          {item.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------ highlights */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-24 sm:px-6">
          <SectionHeading
            eyebrow="Built for daily work"
            title="Made for how a CA office actually works"
            lede="The small things that save an hour every day, in every tool."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {HIGHLIGHTS.map((h) => (
              <div key={h.title} className="rounded-3xl border-2 border-dashed border-primary/25 p-6">
                <IconTile icon={h.icon} tint={h.tint} size="lg" />
                <h3 className="mt-5 text-lg font-bold">{h.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{h.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------- how it works */}
        <section id="how-it-works" className="scroll-mt-24 py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading eyebrow="How it works" title="From a list of clients to on-time filings in three steps" />
            <ol className="mt-12 grid gap-4 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="relative rounded-3xl border bg-card p-6 shadow-card">
                  <span
                    className="absolute top-6 right-6 font-mono text-5xl font-bold text-muted/90 dark:text-muted"
                    aria-hidden
                  >
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
          <div className="grid items-center gap-10 overflow-hidden rounded-[2.5rem] border-2 border-dashed border-primary/25 bg-transparent p-8 sm:p-12 lg:grid-cols-2">
            <div>
              <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                <ShieldCheck className="size-3.5" aria-hidden /> Private by design
              </p>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Your clients&apos; data stays private.</h2>
              <p className="mt-4 max-w-[52ch] leading-relaxed text-muted-foreground">
                It&apos;s saved under your own login in encrypted storage, so you see the same clients on any computer,
                and no other user can see who your clients are.
              </p>
            </div>
            <ul className="grid gap-3">
              <PrivacyPoint
                icon={HardDrive}
                tint="sky"
                title="Saved to your account"
                body="Companies, GST clients, tasks and checklists are saved under your login and kept in step on every device."
              />
              <PrivacyPoint
                icon={KeyRound}
                tint="amber"
                title="Portal passwords stay masked"
                body="Optional, shown masked, never in downloads, and handed to the GST Helper only for the login you open."
              />
              <PrivacyPoint
                icon={UserX}
                tint="violet"
                title="Only you can open it"
                body="Your account's data is yours alone; other users never see your clients."
              />
              <PrivacyPoint
                icon={BellRing}
                tint="pink"
                title="Alerts are opt-in"
                body="Deadline emails are a separate list, and nothing on the site requires them."
              />
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
          <div className="relative overflow-hidden rounded-[2.5rem] border-2 border-dashed border-primary/25 bg-transparent px-8 py-16 text-center sm:px-16">
            <h2 className="relative mx-auto max-w-[22ch] text-3xl font-extrabold tracking-tight sm:text-5xl">
              Make this filing season the calm one.
            </h2>
            <p className="relative mx-auto mt-4 max-w-[50ch] text-muted-foreground sm:text-lg">
              Paste in your client list and see what&apos;s due in under a minute. Free to use.
            </p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/dashboard">
                  Open your dashboard <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
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
            MCA reference compiled from the{" "}
            <a
              href={MCA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-foreground"
            >
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

function SectionHeading({ eyebrow, title, lede }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="mb-4 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
        {eyebrow}
      </p>
      <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      {lede ? <p className="mt-4 text-lg text-muted-foreground">{lede}</p> : null}
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div className="flex flex-col rounded-3xl bg-background/70 px-5 py-6 text-center">
      <dt className="order-2 mt-2 text-sm text-muted-foreground">{label}</dt>
      <dd className="tabular brand-satin-text order-1 bg-clip-text text-4xl font-extrabold text-transparent">
        {value}
      </dd>
    </div>
  );
}

function PrivacyPoint({ icon, tint, title, body }) {
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
