"use client";

import * as React from "react";
import { Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * A large upload area: a title, a line of explanation, one big button, and
 * the whole area takes dropped files. Used for MCA challans and MCA master
 * data PDFs on the dashboard.
 */
export function UploadHero({
  title,
  description,
  button,
  busyLabel,
  dropHint,
  busy,
  onPick,
  onDropFiles,
  className = "",
}: {
  title: string;
  description: string;
  button: string;
  busyLabel: string;
  dropHint: string;
  busy: boolean;
  onPick: () => void;
  onDropFiles: (files: FileList) => void;
  className?: string;
}) {
  const [dragging, setDragging] = React.useState(false);
  return (
    <section
      aria-label={title}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files?.length) onDropFiles(e.dataTransfer.files);
      }}
      className={`flex flex-col items-center rounded-3xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
        dragging ? "border-primary bg-primary/10" : "border-primary/25 bg-card/60"
      } ${className}`}
    >
      <h2 className="font-heading text-2xl font-bold tracking-tight">{title}</h2>
      <p className="mt-1.5 max-w-[52ch] text-sm text-muted-foreground">{description}</p>
      <Button
        type="button"
        onClick={onPick}
        disabled={busy}
        className="mt-4 h-12 w-full max-w-xs rounded-2xl text-base font-semibold shadow-md shadow-primary/25"
      >
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
        {busy ? busyLabel : button}
      </Button>
      <p className="mt-2 text-xs text-muted-foreground">{dropHint}</p>
    </section>
  );
}
