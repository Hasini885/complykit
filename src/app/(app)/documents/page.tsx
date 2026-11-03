import type { Metadata } from "next";

import { DocumentGenerator } from "@/components/documents/document-generator";

export const metadata: Metadata = {
  title: "Document Generator",
  description:
    "Board and general meeting notices, Board resolutions, DIR-2, DIR-8, MBP-1 and director letters, pre-filled from your company and downloaded as Word or PDF.",
};

export default function Page() {
  return <DocumentGenerator />;
}
