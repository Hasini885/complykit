import { site } from "@/config/site";

export const metadata = { title: "Privacy Policy" };

const UPDATED = "2 November 2026";

export default function PrivacyPage() {
  const email = site.contactEmail;
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">Last updated {UPDATED}</p>

      <p>
        {site.name} ({site.url}) is a compliance tool for Indian companies. This page explains what information is
        involved when you use it, where it is kept, and who can see it.
      </p>

      <h2>1. Your account</h2>
      <p>
        To create an account you give your name, mobile number and email address. Your email is verified with a one-time
        code sent to it. Accounts are handled by Clerk (clerk.com), an authentication service, which keeps these details
        so that you can sign in. Clerk&apos;s own privacy policy applies to that information.
      </p>
      <p>
        The operator of {site.name} can see the name, mobile number and email address of each account, and when it was
        created and last used, to run the service and to contact you about it. These details are not sold or shared with
        others.
      </p>

      <h2>2. Your company data</h2>
      <p>
        The companies, directors, consultants, filings, due dates, checklists and documents you enter are kept in your
        web browser and saved on our server under your account, so that signing in on another computer shows the same
        data.
      </p>
      <ul>
        <li>
          It is stored in private storage on our hosting provider (Vercel), in its Mumbai (India) region, encrypted at
          rest.
        </li>
        <li>Each account can reach only its own data; it is not shown to other users.</li>
        <li>
          It is used only to show your information back to you in {site.name}. It is not sold, shared with advertisers,
          or used to train AI models.
        </li>
      </ul>

      <h2>3. Technical information</h2>
      <p>
        Like any website, our hosting provider (Vercel) keeps standard technical logs of visits, such as the page
        requested, the time and an IP address, for security and to keep the service running. These logs do not contain
        the company data you enter.
      </p>

      <h2>4. Deleting your information</h2>
      <ul>
        <li>Company data on a device: clear this site&apos;s data in your browser settings.</li>
        <li>Your account and its saved data: ask us using the contact below and we will delete both.</li>
      </ul>

      <h2>5. Contact</h2>
      <p>
        Questions about this policy:{" "}
        {email ? (
          <a href={`mailto:${email}`} className="text-primary underline">
            {email}
          </a>
        ) : (
          "contact details to be added"
        )}
        .
      </p>
    </>
  );
}
