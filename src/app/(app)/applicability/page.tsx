import type { Metadata } from "next";

import { ApplicabilityView } from "@/components/applicability/applicability-view";

export const metadata: Metadata = { title: "What Applies To Me?" };

export default function Page() {
  return <ApplicabilityView />;
}
