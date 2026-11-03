import type { Metadata } from "next";

import { PortfolioReport } from "@/components/portfolio/portfolio-report";

export const metadata: Metadata = { title: "Compliance Report" };

export default function Page() {
  return <PortfolioReport />;
}
