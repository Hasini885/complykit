"use client";

import * as React from "react";
import { toast } from "sonner";

import { UploadHero } from "@/components/shared/upload-hero";
import { ClientFormDialog } from "@/components/portfolio/client-form-dialog";
import { usePortfolio } from "@/components/portfolio/portfolio-provider";
import { sameCin } from "@/lib/challan";
import type { ExtractedCompany } from "@/lib/pdf-extraction";

type Item = { name: string; data: ExtractedCompany };

/**
 * Upload one or more MCA company master data files, PDF or Excel. Each is read
 * in the browser (no AI, nothing sent anywhere) and opens the new-company form
 * filled in, with its directors on the board; several open one after another.
 * A company whose CIN is already saved is not added again.
 */
export function MasterDataUpload({ className }: { className?: string }) {
  const { clients } = usePortfolio();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [reading, setReading] = React.useState(false);
  const [queue, setQueue] = React.useState<Item[]>([]);
  const [total, setTotal] = React.useState(0);
  const current = queue[0] ?? null;

  function announce(item: Item | undefined, index: number, of: number) {
    if (!item) return;
    const name = item.data.companyName ?? item.name;
    toast.info(of > 1 ? `Master data ${index} of ${of}: ${name}` : name, {
      description: "Check the filled-in details, then continue to save.",
    });
  }

  async function onFiles(list: FileList | null | undefined) {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    setReading(true);
    const found: Item[] = [];
    const rejected: string[] = [];
    // Companies already in master data are not added a second time.
    const already: string[] = [];
    try {
      const [{ readPdfLayout }, { parseCompanyText }, { isExcelFile, readXlsxLines }] = await Promise.all([
        import("@/lib/pdf-text"),
        import("@/lib/pdf-text-parser"),
        import("@/lib/xlsx-lines"),
      ]);
      for (const file of files) {
        const excel = isExcelFile(file);
        if (!excel && file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
          rejected.push(file.name);
          continue;
        }
        try {
          // Excel: every sheet's rows as lines. PDF: its text, or OCR when it has none
          // (Microsoft Print to PDF, a scan). All read in the browser.
          const data = excel
            ? parseCompanyText(await readXlsxLines(file))
            : await readPdfLayout(file).then(({ lines, ys }) => parseCompanyText(lines, ys));
          if (!data.cin && !data.companyName) rejected.push(file.name);
          else if (data.cin && clients.some((c) => sameCin(c.cin, data.cin!))) {
            already.push(data.companyName ?? data.cin);
          } else if (!found.some((f) => f.data.cin && data.cin && sameCin(f.data.cin, data.cin))) {
            found.push({ name: file.name, data });
          }
        } catch {
          rejected.push(file.name);
        }
      }
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
    if (rejected.length > 0) {
      toast.error(
        files.length === 1
          ? "No company details found. Use the company master data PDF or Excel from the MCA portal."
          : `${rejected.length} of ${files.length} files could not be read as MCA master data and were skipped`,
        files.length === 1 ? undefined : { description: rejected.slice(0, 5).join(", ") + (rejected.length > 5 ? "…" : "") },
      );
    }
    if (already.length > 0) {
      toast.info(
        already.length === 1
          ? `You already uploaded ${already[0]}`
          : `You already uploaded ${already.length} of these companies`,
        {
          description:
            already.length === 1
              ? "It is already in master data, so it was not added again."
              : already.slice(0, 5).join(", ") + (already.length > 5 ? "…" : ""),
        },
      );
    }
    if (found.length > 0) {
      setQueue(found);
      setTotal(found.length);
      announce(found[0], 1, found.length);
    }
  }

  /** The form closed (saved or cancelled): on to the next file. */
  function next() {
    const rest = queue.slice(1);
    setQueue(rest);
    announce(rest[0], total - rest.length + 1, total);
  }

  return (
    <>
      <UploadHero
        title="Upload MCA master data"
        button="Select PDF or Excel files"
        busyLabel="Reading… printed or scanned PDFs take a little longer"
        dropHint="or drop master data PDFs or Excel files here"
        busy={reading}
        onPick={() => inputRef.current?.click()}
        onDropFiles={(files) => void onFiles(files)}
        className={className}
      />
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
      {current ? (
        <ClientFormDialog
          key={`${current.name}-${total - queue.length}`}
          open
          onOpenChange={(o) => !o && next()}
          client={null}
          extracted={current.data}
        />
      ) : null}
    </>
  );
}
