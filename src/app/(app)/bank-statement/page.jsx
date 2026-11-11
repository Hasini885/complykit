import { Landmark } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { BankStatementConverter } from "@/components/tools/bank-statement-converter";

export const metadata = {
  title: "Bank Statement to Excel",
  description:
    "Convert a bank statement PDF into a clean Excel workbook, tag every transaction to a ledger and download. Read entirely in your browser.",
};

export default function BankStatementPage() {
  return (
    <>
      <PageHeader
        icon={Landmark}
        eyebrow="Bank Statement to Excel"
        badge="NEW"
        title="Your bank statement, clear in Excel"
        lede="Drop in a PDF, tag every transaction to a ledger, and download a clean workbook. Nothing leaves your browser."
      />
      <BankStatementConverter />
    </>
  );
}
