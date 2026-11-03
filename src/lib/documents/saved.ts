import type { Values } from "@/lib/documents/types";

/**
 * Saved drafts, kept in this browser. A draft stores the values entered, not
 * the rendered text, so re-opening it regenerates the document with any
 * template improvements made since.
 */

export type SavedDocument = {
  id: string;
  templateId: string;
  title: string;
  companyId: string | null;
  companyName: string;
  values: Values;
  savedAt: string;
};

const KEY = "complykit.documents.v1";

export function readSaved(): SavedDocument[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter(
          (d): d is SavedDocument =>
            !!d && typeof d.id === "string" && typeof d.templateId === "string" && typeof d.values === "object",
        )
      : [];
  } catch {
    return [];
  }
}

function write(docs: SavedDocument[]): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(docs));
    return true;
  } catch {
    return false;
  }
}

/** Saves (or replaces, by id) a draft. Returns false if the browser refused. */
export function saveDocument(doc: SavedDocument): boolean {
  const others = readSaved().filter((d) => d.id !== doc.id);
  return write([doc, ...others].slice(0, 200));
}

export function deleteSaved(id: string): void {
  write(readSaved().filter((d) => d.id !== id));
}

/* The audit firm's own details, remembered for the next AOC-4 pack. */

const FIRM_KEY = "complykit.documents.firm.v1";

export function readFirm(): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(FIRM_KEY) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? Object.fromEntries(Object.entries(parsed).filter(([, v]) => typeof v === "string" && v.trim() !== ""))
      : {};
  } catch {
    return {};
  }
}

export function writeFirm(details: Record<string, string>): void {
  try {
    window.localStorage.setItem(FIRM_KEY, JSON.stringify(details));
  } catch {
    // Remembering the firm is a convenience; nothing is lost if the browser refuses.
  }
}
