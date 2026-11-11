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
 * Upload one or more MCA company master data PDFs. Each is read in the
 * browser (no AI, nothing sent anywhere) and opens the company form filled
 * in: the company with that CIN if it is already saved, otherwise a new one,
 * with its directors on the board. Several files open one after another.
 */
export function MasterDataUpload({ className }: { className?: string }) {
  const { clients } = usePortfolio();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [reading, setReading] = React.useState(false);
  const [queue, setQueue] = React.useState<Item[]>([]);
  const [total, setTotal] = React.useState(0);
  const current = queue[0] ?? null;
  const existing = current?.data.cin ? (clients.find((c) => sameCin(c.cin, current.data.cin!)) ?? null) : null;

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
    try {
      const [{ extractPdfLines }, { parseCompanyText }] = await Promise.all([
        import("@/lib/pdf-text"),
        import("@/lib/pdf-text-parser"),
      ]);
      for (const file of files) {
        if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
          rejected.push(file.name);
          continue;
        }
        try {
          const lines = await extractPdfLines(file);
          const data = parseCompanyText(lines);
          if (!data.cin && !data.companyName) rejected.push(file.name);
          else if (!found.some((f) => f.data.cin && data.cin && sameCin(f.data.cin, data.cin))) {
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
          ? "No company details found. Use the master data PDF downloaded from the MCA portal (not a scan)."
          : `${rejected.length} of ${files.length} files could not be read as MCA master data and were skipped`,
        files.length === 1 ? undefined : { description: rejected.slice(0, 5).join(", ") + (rejected.length > 5 ? "…" : "") },
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
        description="Add or update companies and their directors from the MCA master data PDF."
        button="Select master data PDFs"
        busyLabel="Reading PDFs…"
        dropHint="or drop one or more master data PDFs here"
        busy={reading}
        onPick={() => inputRef.current?.click()}
        onDropFiles={(files) => void onFiles(files)}
        className={className}
      />
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
      {current ? (
        <ClientFormDialog
          key={`${current.name}-${total - queue.length}`}
          open
          onOpenChange={(o) => !o && next()}
          client={existing}
          extracted={current.data}
        />
      ) : null}
    </>
  );
}
