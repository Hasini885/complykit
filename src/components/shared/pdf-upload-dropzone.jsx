"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, FileText, Loader2, Sparkles, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { countExtractedFields, mergeExtractions, PDF_MAX_BYTES } from "@/lib/pdf-extraction";
import { parseCompanyText } from "@/lib/pdf-text-parser";
import { cn } from "@/lib/utils";

/**
 * The in-browser result is used on its own when it has at least this many
 * fields including the company's identity: enough that sending the PDF to a
 * third party for the rest is not worth it by default. The user can still ask
 * for the AI pass from the result.
 */
const GOOD_ENOUGH = 5;

/**
 * "Upload PDF to auto-fill" — a drop target used by the Add Company, the
 * Applicability profile, and the Add Director forms.
 *
 * Two readers, cheapest first:
 *  1. In the browser: pdf.js pulls out the text layer and a rules-based parser
 *     reads the fields. Free, instant, and the PDF never leaves the device.
 *     Works on MCA master data, incorporation certificates and exported
 *     financial statements.
 *  2. AI (Gemini or Claude), via /api/extract-company-pdf: for scanned PDFs
 *     (no text layer), or when the browser read too little. Needs
 *     GEMINI_API_KEY or ANTHROPIC_API_KEY. Whatever
 *     the AI misses, the browser result fills in.
 *
 * Purely a trigger: on success it calls `onExtracted` with the structured
 * result and lets the caller decide how to map it onto its own fields.
 * Nothing here stores the PDF.
 */
export function PdfUploadDropzone({ onExtracted, className }) {
  const [status, setStatus] = React.useState({ kind: "idle" });
  const [dragActive, setDragActive] = React.useState(false);
  const inputRef = React.useRef(null);

  const [aiConfigured, setAiConfigured] = React.useState(null);
  const [aiName, setAiName] = React.useState("AI");
  const lastFile = React.useRef(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/extract-company-pdf")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        setAiConfigured(Boolean(j.configured));
        if (j.provider === "gemini") setAiName("Gemini (Google)");
        else if (j.provider === "claude") setAiName("Claude (Anthropic)");
      })
      .catch(() => {
        if (!cancelled) setAiConfigured(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function readInBrowser(file) {
    try {
      const { extractPdfLines } = await import("@/lib/pdf-text");
      const lines = await extractPdfLines(file);
      const hasText = lines.join("").replace(/\s/g, "").length >= 40;
      return { data: hasText ? parseCompanyText(lines) : null, hasText };
    } catch {
      // Encrypted or malformed as far as pdf.js is concerned: let the AI reader try.
      return { data: null, hasText: false };
    }
  }

  async function readWithAi(file) {
    let base64;
    try {
      base64 = await fileToBase64(file);
    } catch {
      return { ok: false, message: "Could not read that file.", configured: true };
    }
    try {
      const res = await fetch("/api/extract-company-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, fileBase64: base64 }),
      });
      const json = await res.json().catch(() => ({ error: "The server sent back something unreadable." }));
      if (res.ok && json.data) return { ok: true, data: json.data };
      return {
        ok: false,
        message: json.error ?? "Extraction failed.",
        configured: json.configured !== false,
      };
    } catch {
      return {
        ok: false,
        message: "Could not reach the server. Check your connection and try again.",
        configured: true,
      };
    }
  }

  function finish(file, data, source, note) {
    const { found, total } = countExtractedFields(data);
    setStatus({ kind: "done", filename: file.name, found, total, source, note });
    onExtracted(data);
  }

  async function handleFile(file) {
    if (!/\.pdf$/i.test(file.name)) {
      setStatus({ kind: "error", filename: file.name, message: "Only PDF files are accepted." });
      return;
    }
    if (file.size > PDF_MAX_BYTES) {
      setStatus({
        kind: "error",
        filename: file.name,
        message: `That file is larger than the ${PDF_MAX_BYTES / (1024 * 1024)}MB limit.`,
      });
      return;
    }

    setStatus({ kind: "reading", filename: file.name });
    const local = await readInBrowser(file);
    lastFile.current = { file, local: local.data };
    const localFound = local.data ? countExtractedFields(local.data).found : 0;
    const identified = Boolean(local.data?.companyName || local.data?.cin);

    if (local.data && identified && localFound >= GOOD_ENOUGH) {
      finish(file, local.data, "browser");
      return;
    }

    setStatus({ kind: "extracting", filename: file.name });
    const ai = await readWithAi(file);
    if (ai.ok) {
      finish(file, local.data ? mergeExtractions(ai.data, local.data) : ai.data, "ai");
      return;
    }

    if (local.data && localFound > 0) {
      const note = ai.configured
        ? `AI reading failed (${ai.message}), so only what could be read in the browser was filled.`
        : "Only part of this PDF could be read in the browser. Set GEMINI_API_KEY or ANTHROPIC_API_KEY to have AI read the rest.";
      finish(file, local.data, "browser", note);
      return;
    }

    let message;
    if (!local.hasText) {
      message = ai.configured
        ? `This looks like a scanned PDF, and AI reading failed: ${ai.message}`
        : "This looks like a scanned PDF (no text to read). Upload the MCA master data or an e-filed PDF instead, set GEMINI_API_KEY or ANTHROPIC_API_KEY so AI can read scans, or fill the form in manually.";
    } else {
      message = ai.configured
        ? ai.message
        : "No company details were found in this PDF. Try the MCA master data printout or the Certificate of Incorporation, or fill the form in manually.";
    }
    setStatus({ kind: "error", filename: file.name, message });
  }

  /** Second opinion from the AI reader after a browser-only read that missed fields. */
  async function retryWithAi() {
    const last = lastFile.current;
    if (!last) return;
    setStatus({ kind: "extracting", filename: last.file.name });
    const ai = await readWithAi(last.file);
    if (ai.ok) {
      finish(last.file, last.local ? mergeExtractions(ai.data, last.local) : ai.data, "ai");
    } else if (last.local) {
      finish(last.file, last.local, "browser", `AI reading failed: ${ai.message}`);
    } else {
      setStatus({ kind: "error", filename: last.file.name, message: ai.message });
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  function reset() {
    lastFile.current = null;
    setStatus({ kind: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  }

  const busy = status.kind === "reading" || status.kind === "extracting";

  return (
    <div className={cn("space-y-1.5", className)}>
      {status.kind === "done" ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Extracted from {status.filename} — review before saving</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {status.found} of {status.total} fields found
              {status.source === "browser" ? ", read in your browser" : `, read by ${aiName}`}. Fields the PDF
              didn&apos;t cover were left as they were.
            </p>
            {status.note ? <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{status.note}</p> : null}
            {status.source === "browser" && aiConfigured && status.found < status.total ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 h-7 px-2 text-xs"
                onClick={() => void retryWithAi()}
              >
                <Sparkles className="size-3.5" aria-hidden /> Read the rest with AI
              </Button>
            ) : null}
          </div>
          <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 px-2" onClick={reset}>
            <X className="size-3.5" aria-hidden /> Remove
          </Button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          className={cn(
            "flex items-center gap-3 rounded-lg border border-dashed p-3 transition-colors",
            dragActive ? "border-primary bg-primary/5" : "border-input",
            busy && "opacity-70",
          )}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : status.kind === "error" ? (
              <AlertTriangle className="size-4 text-destructive" aria-hidden />
            ) : (
              <FileText className="size-4" aria-hidden />
            )}
          </span>

          <div className="min-w-0 flex-1">
            {status.kind === "reading" || status.kind === "extracting" ? (
              <p className="text-sm">
                {status.kind === "reading" ? "Reading" : "Reading with AI:"} {status.filename}…
              </p>
            ) : status.kind === "error" ? (
              <>
                <p className="text-sm font-medium text-destructive">{status.message}</p>
                {status.filename ? <p className="text-xs text-muted-foreground">{status.filename}</p> : null}
              </>
            ) : (
              <>
                <p className="text-sm font-medium">Upload company PDF to auto-fill</p>
                <p className="text-xs text-muted-foreground">
                  Drag a PDF here, or click to browse. Incorporation certificate, MCA master data, or a recent financial
                  statement all work.
                </p>
              </>
            )}
          </div>

          <Button
            type="button"
            variant={status.kind === "error" ? "outline" : "secondary"}
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-3.5" aria-hidden />
            {status.kind === "error" ? "Try again" : "Browse"}
          </Button>

          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Text PDFs are read in your browser and never uploaded.
        {aiConfigured
          ? ` Scanned PDFs, or ones the browser can't fully read, are sent to ${aiName} to read. Nothing is stored here.`
          : null}
      </p>
    </div>
  );
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Unexpected file reader result"));
        return;
      }
      // reader.result is a data: URL — the API route strips the prefix too,
      // but do it here as well so callers never see it in transit.
      const commaIndex = result.indexOf(",");
      resolve(commaIndex === -1 ? result : result.slice(commaIndex + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}
