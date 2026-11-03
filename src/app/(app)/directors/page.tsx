import type { Metadata } from "next";

import { DirectorMasterView } from "@/components/portfolio/director-master-view";

export const metadata: Metadata = { title: "Director Master" };

export default function Page() {
  return <DirectorMasterView />;
}
