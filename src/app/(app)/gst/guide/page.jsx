import Link from "next/link";
import { CheckCircle2, Download, KeyRound, ListChecks, RefreshCw, ShieldCheck, Wrench } from "lucide-react";

import { site } from "@/config/site";

export const metadata = {
  title: "GST Helper Guide",
  description: "How to add the free GST Helper to Chrome, fill GST logins automatically and check every client's return status.",
};

/** Kept in step with extensions/gst-helper/manifest.json. */
const HELPER_VERSION = "1.3";

export default function GstGuidePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-10">
      <header>
        <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-[3.25rem] sm:leading-[1.05]">
          GST Helper Guide
        </h1>
        <p className="mt-3 text-muted-foreground">
          The GST Helper is a free Chrome extension for {site.name}. It does two things the website can&apos;t do on
          its own: it fills a client&apos;s user name and password on the GST login page, and it checks every
          client&apos;s GSTR-1 and GSTR-3B status for a month. You always type the captchas yourself.
        </p>
      </header>

      <Section icon={Download} title="1. Add the helper to Chrome (once)">
        <ol className="list-decimal space-y-2.5 pl-5">
          <li>
            <a href="/downloads/gst-helper.zip" download className="font-medium text-primary underline underline-offset-4">
              Download the GST Helper (.zip)
            </a>{" "}
            (version {HELPER_VERSION}).
          </li>
          <li>
            Right-click the downloaded file and choose <b>Extract All</b>. Keep the extracted <b>gst-helper</b> folder
            somewhere it will stay, such as Documents. Chrome keeps using that folder, so don&apos;t delete it.
          </li>
          <li>
            In Chrome, type <Code>chrome://extensions</Code> in the address bar and press Enter.
          </li>
          <li>
            Turn on <b>Developer mode</b> (the switch at the top right).
          </li>
          <li>
            Click <b>Load unpacked</b> and choose the <b>gst-helper</b> folder: the one that contains{" "}
            <Code>manifest.json</Code>.
          </li>
          <li>
            &quot;CA Compliance Tool - GST Helper&quot; now appears in the list. Click the puzzle icon in Chrome&apos;s
            toolbar and pin it if you like (not required).
          </li>
        </ol>
        <Tip>Works in Google Chrome and Microsoft Edge (in Edge, open edge://extensions instead).</Tip>
      </Section>

      <Section icon={CheckCircle2} title="2. Check it is connected">
        <p>
          Open{" "}
          <Link href="/gst" className="font-medium text-primary underline underline-offset-4">
            GST → Client Register
          </Link>{" "}
          and press <Kbd>Ctrl</Kbd> + <Kbd>Shift</Kbd> + <Kbd>R</Kbd>. Next to &quot;Show passwords&quot; you should
          see a green <b>GST Helper {HELPER_VERSION} connected</b>. If it still says &quot;add GST Helper&quot;, see
          Troubleshooting below.
        </p>
      </Section>

      <Section icon={KeyRound} title="3. Log in to the GST portal with one click">
        <ol className="list-decimal space-y-2.5 pl-5">
          <li>
            In the Client Register, enter each client&apos;s <b>User name</b> and <b>Password</b> (tick Show passwords
            to see what you typed).
          </li>
          <li>
            Click <b>Open Portal</b> on a client (or <b>Login</b> in Return Filing Status). The GST login page opens in
            a new tab with the user name and password filled in.
          </li>
          <li>
            Type the captcha and press <b>LOGIN</b>. A green note at the top right of the portal confirms the details
            were filled.
          </li>
        </ol>
        <Tip>
          Without the helper, Open Portal still opens the login page and copies the password so you can paste it.
        </Tip>
      </Section>

      <Section icon={ListChecks} title="4. Check every client's return status (free)">
        <ol className="list-decimal space-y-2.5 pl-5">
          <li>
            Open{" "}
            <Link href="/gst/returns" className="font-medium text-primary underline underline-offset-4">
              GST → Return Filing Status
            </Link>
            , pick the month and click <b>Check all (free)</b>.
          </li>
          <li>
            A new tab opens the portal&apos;s public <b>Search Taxpayer</b> page with the first client&apos;s GSTIN
            filled in. No login is needed.
          </li>
          <li>
            Type the captcha, click <b>Search</b>, then <b>Show Filing Table</b> (choose the financial year if asked).
          </li>
          <li>
            A panel at the bottom right shows the GSTR-1 and GSTR-3B status it read for that month. Check it, change it
            if needed, and click <b>Save &amp; Next</b>. The next client opens by itself.
          </li>
          <li>
            Results appear in Return Filing Status as you go. <b>Skip</b> passes a client; <b>Stop</b> ends the run.
          </li>
        </ol>
        <Tip>
          About 10 to 15 seconds per client, mostly the captcha. Clients without a valid 15-character GSTIN are skipped.
          Quarterly (QRMP) filers are counted for every month of the quarter.
        </Tip>
      </Section>

      <Section icon={RefreshCw} title="Updating the helper">
        <p>
          When a new version is out, the Client Register shows <b>reload it to autofill</b>. Download the zip again,
          extract it over your existing <b>gst-helper</b> folder (replace the files), then open{" "}
          <Code>chrome://extensions</Code> and click the reload button (↻) on the GST Helper card. Reload the{" "}
          {site.name} page afterwards.
        </p>
      </Section>

      <Section icon={Wrench} title="Troubleshooting">
        <dl className="space-y-4">
          <Problem q="The register still says “add GST Helper”.">
            Reload the {site.name} page with Ctrl + Shift + R. The page must be opened after the helper was added. Check
            that the helper is switched on in chrome://extensions.
          </Problem>
          <Problem q="The login page opens but nothing is filled in.">
            Look at the note at the top right of the GST page. &quot;No login details received&quot; means the page
            wasn&apos;t opened with Open Portal, or the helper needs a reload in chrome://extensions. Also check the
            client has a User name saved.
          </Problem>
          <Problem q="“Could not find the Username and Password boxes”.">
            The GST portal changed its page. Fill it in by hand for now and tell us, so the helper can be updated.
          </Problem>
          <Problem q="Check all: the status panel says the month was not found.">
            Choose the right financial year in the filing table, click Read table, or set Filed / Not Filed yourself
            before Save &amp; Next.
          </Problem>
          <Problem q="Chrome shows a warning about developer mode extensions.">
            That is normal for extensions added with Load unpacked. Close the warning; the helper keeps working.
          </Problem>
        </dl>
      </Section>

      <Section icon={ShieldCheck} title="Privacy">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            The helper only works on {site.name} and the GST portal pages it needs (login and Search Taxpayer). It
            doesn&apos;t read any other website.
          </li>
          <li>
            When you click Open Portal, the client&apos;s user name and password go to the helper in your own Chrome,
            are held in memory for at most 3 minutes, filled in once and then deleted. They are not sent anywhere else.
          </li>
          <li>The helper never solves captchas or logs in on its own: you do that.</li>
          <li>
            Passwords in the Client Register are saved privately with your {site.name} account and are never included
            in downloads.
          </li>
        </ul>
      </Section>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <section className="rounded-3xl border-2 border-dashed border-primary/25 p-6">
      <h2 className="flex items-center gap-2.5 font-heading text-xl font-semibold">
        <Icon className="size-5 text-primary" aria-hidden /> {title}
      </h2>
      <div className="mt-4 space-y-3 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function Tip({ children }) {
  return <p className="rounded-xl bg-primary/10 px-3.5 py-2.5 text-[13px] text-muted-foreground">{children}</p>;
}

function Problem({ q, children }) {
  return (
    <div>
      <dt className="font-semibold">{q}</dt>
      <dd className="mt-1 text-muted-foreground">{children}</dd>
    </div>
  );
}

function Code({ children }) {
  return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12.5px]">{children}</code>;
}

function Kbd({ children }) {
  return <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[12px]">{children}</kbd>;
}
