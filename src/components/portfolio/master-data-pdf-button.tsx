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
    const { isExcelFile, readXlsxLines } = await import("@/lib/xlsx-lines");
    const excel = isExcelFile(file);
    if (!excel && file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      toast.error("Choose the MCA master data PDF or Excel file.");
      return;
    }
    setReading(true);
    try {
      const [{ readPdfLayout }, { parseCompanyText }] = await Promise.all([
        import("@/lib/pdf-text"),
        import("@/lib/pdf-text-parser"),
      ]);
      // Excel: its rows. PDF: its text, or OCR when it has none (Microsoft Print to PDF, a scan).
      const data = excel
        ? parseCompanyText(await readXlsxLines(file))
        : await readPdfLayout(file).then(({ lines, ys }) => parseCompanyText(lines, ys));
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
        Fill from MCA master data (PDF or Excel)
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
    </>
  );
}
