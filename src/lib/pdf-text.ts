/**
 * Pulls the text layer out of a PDF, in the browser, with pdf.js.
 *
 * Import it dynamically from a client component so pdf.js stays out of the
 * server bundle and out of the first page load. Uses pdf.js's legacy build:
 * the modern one relies on Promise.try, which older Safari and Chrome lack.
 *
 * The output is one string per visual line. Text items on the same line that
 * sit visibly apart (table cells, label and value) are joined with a double
 * space, which is what src/lib/pdf-text-parser.ts reads as a column break.
 */

/** Generous: an MCA printout is 3-10 pages, a full annual report can be 100+. */
const MAX_PAGES = 60;

type Item = { str: string; x: number; y: number; w: number; h: number };

export type PdfLayout = {
  lines: string[];
  /** Each line's distance down the document (pages stacked), for telling table rows apart. */
  ys: number[];
  /** True when the PDF had no text and the lines came from OCR. */
  ocr?: boolean;
};

export async function extractPdfLines(file: File): Promise<string[]> {
  return (await extractPdfLayout(file)).lines;
}

/**
 * The text and where each line sits. A PDF with no text in it (Microsoft Print
 * to PDF draws the letters as shapes; scans are pictures) is read by OCR.
 */
export async function readPdfLayout(file: File): Promise<PdfLayout> {
  const layout = await extractPdfLayout(file);
  if (layout.lines.join("").replace(/\s/g, "").length >= 40) return layout;
  const { ocrPdfLayout } = await import("@/lib/pdf-ocr");
  return { ...(await ocrPdfLayout(file)), ocr: true };
}

export async function extractPdfLayout(file: File): Promise<PdfLayout> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Loading the worker module registers it on globalThis.pdfjsWorker, and
  // pdf.js then runs it on the main thread. No separate worker file to host.
  await import("pdfjs-dist/legacy/build/pdf.worker.mjs");

  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data });
  try {
    const doc = await task.promise;
    const lines: string[] = [];
    const ys: number[] = [];
    const pages = Math.min(doc.numPages, MAX_PAGES);
    for (let p = 1; p <= pages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const items: Item[] = [];
      for (const it of content.items) {
        if (!("str" in it) || it.str.trim() === "") continue;
        items.push({
          str: it.str,
          x: it.transform[4],
          y: it.transform[5],
          w: it.width,
          h: Math.abs(it.transform[3]) || it.height || 10,
        });
      }
      // pdf.js measures up from the bottom; stack pages and count downwards.
      for (const row of toLines(items)) {
        lines.push(row.text);
        ys.push(p * 100_000 - row.y);
      }
      page.cleanup();
    }
    return { lines, ys };
  } finally {
    await task.destroy();
  }
}

/** Groups items into rows by baseline, then orders each row left to right. */
function toLines(items: Item[]): { text: string; y: number }[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: Item[][] = [];
  for (const item of sorted) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(row[0].y - item.y) <= Math.max(2, row[0].h * 0.4)) row.push(item);
    else rows.push([item]);
  }
  return rows.map((row) => {
    row.sort((a, b) => a.x - b.x);
    let line = "";
    let end: number | null = null;
    for (const item of row) {
      if (end !== null) {
        const gap = item.x - end;
        // Wider than about a character: a new cell. Otherwise one word gap.
        line += gap > item.h * 0.9 ? "    " : gap > item.h * 0.15 ? " " : "";
      }
      line += item.str;
      end = item.x + item.w;
    }
    return { text: line.replace(/[ \t]+$/, ""), y: row[0].y };
  });
}
