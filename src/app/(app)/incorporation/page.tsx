import type { Metadata } from "next";

import { IncorporationView } from "@/components/incorporation/incorporation-view";

export const metadata: Metadata = { title: "Incorporation Toolkit" };

export default function Page() {
  return <IncorporationView />;
}
