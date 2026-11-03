import type { Metadata } from "next";

import { ClientPortfolioView } from "@/components/portfolio/client-portfolio-view";

export const metadata: Metadata = { title: "Company Master Data" };

export default function Page() {
  return <ClientPortfolioView />;
}
