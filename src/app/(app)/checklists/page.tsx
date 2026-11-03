import type { Metadata } from "next";

import { ChecklistsView } from "@/components/checklists/checklists-view";

export const metadata: Metadata = { title: "Compliance Checklists" };

export default function Page() {
  return <ChecklistsView />;
}
