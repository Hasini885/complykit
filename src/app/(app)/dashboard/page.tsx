import type { Metadata } from "next";

import { DashboardHero, DashboardOverview } from "@/components/dashboard/dashboard-overview";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <>
      <DashboardHero />

      <DashboardOverview />
    </>
  );
}
