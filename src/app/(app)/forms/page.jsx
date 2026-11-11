import Link from "next/link";

import { forms } from "@/data/forms";
import { MCA_URL } from "@/config/site";
import { PageHeader } from "@/components/page-header";
import { FormsExplorer } from "@/components/forms/forms-explorer";

export const metadata = {
  title: "Forms Library",
  description:
    "Searchable reference of MCA e-forms under the Companies Act, 2013 — purpose, applicable section, trigger, deadline and late-fee structure for each.",
};

export default function FormsPage() {
  return (
    <>
      <PageHeader
        eyebrow="MCA e-forms"
        title="Forms Library"
        lede="Every e-form a company or LLP actually files, with the provision behind it, the event that starts the clock, the deadline that follows and how the late fee accrues. Select any row for the full entry."
      />

      <FormsExplorer forms={forms} />

      <p className="mt-8 border-t pt-4 text-xs text-muted-foreground">
        Source: compiled from the Companies Act, 2013, the rules made under it, and the Ministry of Corporate Affairs,{" "}
        <Link
          href={MCA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4 hover:text-foreground"
        >
          mca.gov.in
        </Link>
        . Fee structures and deadlines are summarised, not reproduced. Verify against the current rules before filing.
      </p>
    </>
  );
}
