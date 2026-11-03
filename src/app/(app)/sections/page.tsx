import type { Metadata } from "next";
import Link from "next/link";

import { sections } from "@/data/sections";
import { allFormsForSection } from "@/lib/cross-links";
import { OFFICIAL_SOURCES } from "@/config/site";
import { PageHeader } from "@/components/page-header";
import {
  SectionsExplorer,
  type SectionWithForms,
} from "@/components/sections/sections-explorer";

export const metadata: Metadata = {
  title: "Section Reference",
  description:
    "Key sections of the Companies Act, 2013 in plain language — what each one requires, the penalty for getting it wrong, and the MCA forms it drives.",
};

export default function SectionsPage() {
  // Resolve cross-links on the server; the client component stays presentational.
  const entries: SectionWithForms[] = sections.map((section) => ({
    section,
    relatedForms: allFormsForSection(section).map(({ id, code, name }) => ({ id, code, name })),
  }));

  return (
    <>
      <PageHeader
        eyebrow="Companies Act, 2013"
        title="Section Reference"
        lede="The provisions practitioners reach for most, summarised in plain language and cross-linked to the forms they drive. Select any section for the key points, the penalty and the official source."
      />

      <SectionsExplorer entries={entries} />

      <p className="mt-8 border-t pt-4 text-xs text-muted-foreground">
        These are paraphrased working summaries, not the statutory text, and no part of the Act is
        reproduced here. Read the bare provision on{" "}
        <Link
          href={OFFICIAL_SOURCES.indiaCodeAct}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4 hover:text-foreground"
        >
          India Code
        </Link>{" "}
        before advising. Penalty amounts were substantially revised by the Companies (Amendment)
        Acts of 2019 and 2020 — verify every figure against the current Act.
      </p>
    </>
  );
}
