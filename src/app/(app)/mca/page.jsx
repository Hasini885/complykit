import { DashboardHero, DashboardOverview } from "@/components/dashboard/dashboard-overview";

export const metadata = {
  title: "MCA",
};

export default function McaPage() {
  return (
    <>
      <DashboardHero />

      <DashboardOverview />
    </>
  );
}
