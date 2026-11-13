import { PageHeader } from "@/components/page-header";
import { LateFeeTool } from "@/components/tools/late-fee-tool";

export const metadata = {
  title: "Late Fee Calculator",
  description: "Late fee for every ROC form (AOC-4, MGT-7/7A, ADT-1, DIR-12, PAS-3, CHG-1 and more) and ITR, from the dates or the days late.",
};

export default function LateFeePage() {
  return (
    <>
      <PageHeader title="Late Fee Calculator" />
      <LateFeeTool />
    </>
  );
}
