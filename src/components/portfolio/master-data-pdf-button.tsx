"use client";

import * as React from "react";
import { toast } from "sonner";
import { FileUp, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ExtractedCompany } from "@/lib/pdf-extraction";

/**
 * Reads the MCA company master data printout ("Ministry Of Corporate Affairs -
 * MCA Services.pdf") in the browser and hands back what it found. No AI and
 * no server: pdf.js pulls the text, src/lib/pdf-text-parser.ts reads it.
 */
export function MasterDataPdfButton({ onRead }: { onRead: (data: ExtractedCompany) => void }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [reading, setReading] = React.useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      toast.error("Choose the MCA master data PDF.");
      return;
    }
    setReading(true);
    try {
      const [{ extractPdfLines }, { parseCompanyText }] = await Promise.all([
        import("@/lib/pdf-text"),
        import("@/lib/pdf-text-parser"),
      ]);
      const lines = await extractPdfLines(file);
      if (lines.join("").replace(/\s/g, "").length < 40) {
        toast.error("This PDF has no readable text.", {
          description: "Download the master data again from the MCA portal; a scan or photo cannot be read.",
        });
        return;
      }
      const data = parseCompanyText(lines);
      if (!data.cin && !data.companyName) {
        toast.error("No company details found.", {
          description: "Use the company master data printout from the MCA portal.",
        });
        return;
      }
      onRead(data);
    } catch {
      toast.error("Could not read that PDF.");
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={reading}>
        {reading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileUp className="size-4" aria-hidden />}
        Fill from MCA master data PDF
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
    </>
  );
}
