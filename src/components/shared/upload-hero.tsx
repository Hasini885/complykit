"use client";

import * as React from "react";
import { Upload } from "lucide-react";

import { LiquidMetalButton } from "@/components/ui/liquid-metal-button";

/**
 * A large upload area: a title, a line of explanation, one big button, and
 * the whole area takes dropped files. Used for MCA challans and MCA master
 * data PDFs on the dashboard.
 */
export function UploadHero({
  title,
  button,
  busyLabel,
  dropHint,
  busy,
  onPick,
  onDropFiles,
  className = "",
}: {
  title: string;
  /** Kept for callers; not shown (the site keeps its text to what is needed). */
  description?: string;
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
      <div className="mt-4 w-full max-w-xs">
        <LiquidMetalButton
          label={button}
          busy={busy}
          busyLabel={busyLabel}
          icon={<Upload className="size-4" aria-hidden />}
          onClick={onPick}
          fullWidth
          height={48}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{dropHint}</p>
    </section>
  );
}
