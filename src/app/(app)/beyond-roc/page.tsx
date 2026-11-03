import type { Metadata } from "next";

import { BeyondRocView } from "@/components/beyond-roc/beyond-roc-view";

export const metadata: Metadata = { title: "Beyond-ROC Calendar" };

export default function Page() {
  return <BeyondRocView />;
}
