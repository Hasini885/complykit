import type { Metadata } from "next";
import { AlertTriangle, Calculator, Calendar, Clock, IndianRupee, Scale, User } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilingFeeCalculator } from "@/components/tools/filing-fee-calculator";
import { LateFeeCalculator } from "@/components/tools/late-fee-calculator";
import { Dir3KycFeeCalculator } from "@/components/tools/dir3-kyc-fee-calculator";
import { PenaltyEstimator } from "@/components/tools/penalty-estimator";
import { DeadlineCalculator } from "@/components/tools/deadline-calculator";
import { BoardMeetingChecker } from "@/components/tools/board-meeting-checker";

export const metadata: Metadata = {
  title: "Fee & Penalty Calculators",
  description:
    "Compute MCA filing fees, late and additional fees, DIR-3 KYC's flat fee and statutory penalties in seconds. Figures are indicative — the MCA portal computes the authoritative amount at filing.",
};

const TABS = [
  { id: "filing-fee", label: "Filing fee", icon: IndianRupee, component: <FilingFeeCalculator /> },
  { id: "late-fee", label: "Late / additional fee", icon: Clock, component: <LateFeeCalculator /> },
  { id: "dir3-kyc", label: "DIR-3 KYC", icon: User, component: <Dir3KycFeeCalculator /> },
  { id: "penalty", label: "Penalty estimator", icon: Scale, component: <PenaltyEstimator /> },
  { id: "deadline", label: "Deadline from an event", icon: Calendar, component: <DeadlineCalculator /> },
  { id: "board-meetings", label: "Board meeting gap", icon: AlertTriangle, component: <BoardMeetingChecker /> },
];

export default function ToolsPage() {
  return (
    <>
      <PageHeader
        icon={Calculator}
        eyebrow="Fee & Penalty Calculators"
        title="Instant ROC Fee & Penalty Engine"
        lede="Compute MCA filing fees, late and additional fees, and statutory penalties in seconds. Figures are indicative — the MCA portal computes the authoritative amount at filing. Stamp duty (state-specific) is not included."
      />

      <Tabs defaultValue="filing-fee">
        <TabsList className="flex-wrap">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="gap-1.5">
              <t.icon className="size-3.5" aria-hidden />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((t) => (
          <TabsContent key={t.id} value={t.id} className="mt-6">
            {t.component}
          </TabsContent>
        ))}
      </Tabs>

      <p className="mt-10 border-t pt-4 text-xs text-muted-foreground">
        Fee tables and penalty figures are amended by notification and by the Companies (Amendment)
        Acts. Charge forms under Section 77 follow a separate ad valorem schedule that is
        deliberately not modelled here. These calculators are an estimate for planning, not a
        quotation — confirm against the current Companies (Registration Offices and Fees) Rules and
        the MCA portal before you bill, file or advise.
      </p>
    </>
  );
}
