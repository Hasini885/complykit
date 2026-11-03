import type { Metadata } from "next";

import { legal, site } from "@/config/site";

export const metadata: Metadata = { title: "Terms of Use" };

const UPDATED = "2 November 2026";

export default function TermsPage() {
  const email = site.contactEmail;
  return (
    <>
      <h1>Terms of Use</h1>
      <p className="text-sm text-muted-foreground">Last updated {UPDATED}</p>

      <p>By creating an account or using {site.name} ({site.url}), you agree to these terms.</p>

      <h2>1. What {site.name} is</h2>
      <p>{legal.disclaimer}</p>

      <h2>2. Your data and your responsibility</h2>
      <ul>
        <li>You are responsible for the information you enter and for checking it before you rely on it.</li>
        <li>
          Your data is kept in your browser and saved on our server under your account (see the Privacy Policy). Keep your
          own copies of anything important.
        </li>
        <li>Keep your sign-in details private. You are responsible for activity under your account.</li>
      </ul>

      <h2>3. Acceptable use</h2>
      <p>Do not misuse the service, try to break its security, or use it for anything unlawful.</p>

      <h2>4. No warranty</h2>
      <p>
        {site.name} is provided &quot;as is&quot;, without warranties of any kind. Due dates, fees and forms are
        worked out from published rules and may be wrong or out of date. To the extent the law allows, we are not
        liable for losses arising from its use, including late fees or penalties.
      </p>

      <h2>5. Changes</h2>
      <p>We may update these terms; the date above shows the latest version.</p>

      <h2>6. Contact</h2>
      <p>
        {email ? <a href={`mailto:${email}`} className="text-primary underline">{email}</a> : "Contact details to be added"}.
      </p>
    </>
  );
}
