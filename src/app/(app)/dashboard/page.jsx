import { DashboardHero, DashboardOverview } from "@/components/dashboard/dashboard-overview";

export const metadata = {
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
