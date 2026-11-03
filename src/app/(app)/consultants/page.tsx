import type { Metadata } from "next";

import { ConsultantMasterView } from "@/components/portfolio/consultant-master-view";

export const metadata: Metadata = { title: "Consultant Master" };

export default function Page() {
  return <ConsultantMasterView />;
}
