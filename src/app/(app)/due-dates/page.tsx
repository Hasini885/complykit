import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { DueDatesTracker } from "@/components/due-dates/due-dates-tracker";
import { IncorporationCalculator } from "@/components/due-dates/incorporation-calculator";
import { AlertsSignup } from "@/components/alerts-signup";

export const metadata: Metadata = {
  title: "Due Date Tracker",
  description:
    "Recurring statutory due dates under the Companies Act, 2013 by entity type, plus a calculator that turns a date of incorporation into every deadline that follows from it.",
};

export default function DueDatesPage() {
  // The year list and every date are worked out in the browser from today's
  // date, never here: this page is prerendered at build time, and a year
  // computed now would freeze until the next deploy.
  return (
    <>
      <PageHeader
        eyebrow="Statutory calendar"
        title="Due Date Tracker"
        lede="Dates computed from each company's own profile rather than copied from a list: its incorporation date, the AGM held for each year, its auditor's term and its directors' DINs. The calendar rolls into the next year by itself."
      />

      <DueDatesTracker />

      <section className="mt-12 border-t pt-8">
        <h2 className="font-heading text-2xl font-semibold">From a date of incorporation</h2>
        <p className="mt-2 max-w-[66ch] text-sm text-muted-foreground">
          The first year is the one people get wrong, because a company incorporated between
          January and March gets a first financial year of up to fifteen months, which moves every
          deadline that follows. Enter the date and the whole sequence falls out of it.
        </p>
        <div className="mt-5">
          <IncorporationCalculator />
        </div>
      </section>

      <AlertsSignup className="mt-12" />

      <p className="mt-8 border-t pt-4 text-xs text-muted-foreground">
        Due dates are extended by MCA circular more often than any other item in this toolkit, and
        the dates here are computed from the statute rather than from any announcement. Check the
        current position on the MCA portal before relying on a date, and note that a deadline
        falling on a holiday is not automatically extended.
      </p>
    </>
  );
}
