/**
 * Reads a PDF that has no text in it by recognising the printed letters (OCR),
 * entirely in the browser with tesseract.js. Needed for files saved with
 * "Microsoft Print to PDF", which turns every letter into a drawn shape, and
 * for scans. Nothing is uploaded: pages are drawn with pdf.js and read here.
 * (tesseract.js fetches its engine and English data from a public CDN the
 * first time; no account or key is involved.)
 *
 * The output matches src/lib/pdf-text.ts: one string per visual line, with
 * cells that sit far apart joined by a wide gap, which is what
 * src/lib/pdf-text-parser.ts reads as a column break.
 */

export type OcrWord = { text: string; x0: number; y0: number; x1: number; y1: number };

/** Groups recognised words into lines by height on the page, left to right, with column gaps kept. */
export function wordsToLines(words: OcrWord[]): string[] {
  return wordsToLayout(words).lines;
}

/** As wordsToLines, with each line's height down the page. */
export function wordsToLayout(words: OcrWord[]): { lines: string[]; ys: number[] } {
  const items = words
    .map((w) => ({ ...w, text: w.text.trim(), cy: (w.y0 + w.y1) / 2, h: Math.max(1, w.y1 - w.y0) }))
    .filter((w) => w.text !== "")
    .sort((a, b) => a.cy - b.cy || a.x0 - b.x0);
  const rows: (typeof items)[] = [];
  for (const w of items) {
    const row = rows[rows.length - 1];
    if (row) {
      const ref = row.reduce((s, r) => s + r.cy, 0) / row.length;
      const h = row.reduce((s, r) => s + r.h, 0) / row.length;
      if (Math.abs(w.cy - ref) <= Math.max(h, w.h) * 0.5) {
        row.push(w);
        continue;
      }
    }
    rows.push([w]);
  }
  const ys = rows.map((row) => row.reduce((s, r) => s + r.cy, 0) / row.length);
  const lines = rows.map((row) => {
    row.sort((a, b) => a.x0 - b.x0);
    const h = row.reduce((s, r) => s + r.h, 0) / row.length;
    let line = "";
    let end: number | null = null;
    for (const w of row) {
      if (end !== null) line += w.x0 - end > h * 1.5 ? "    " : " ";
      line += w.text;
      end = w.x1;
    }
    return line;
  });
  return { lines, ys };
}

/** Pages read by OCR at most: a master data printout or challan is one to three. */
const MAX_OCR_PAGES = 4;

type TesseractWord = { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } };
type TesseractBlock = { paragraphs?: { lines?: { words?: TesseractWord[] }[] }[] };

/** OCR of the first pages of a PDF, as text lines with positions. Browser only. */
export async function ocrPdfLayout(file: File): Promise<{ lines: string[]; ys: number[] }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const { createWorker } = await import("tesseract.js");

  const { pdfBytes } = await import("@/lib/pdf-text");
  const data = await pdfBytes(file);
  const task = pdfjs.getDocument({ data });
  const worker = await createWorker("eng");
  try {
    const doc = await task.promise;
    const lines: string[] = [];
    const ys: number[] = [];
    for (let p = 1; p <= Math.min(doc.numPages, MAX_OCR_PAGES); p++) {
      const page = await doc.getPage(p);
      // About 200 dpi: sharp enough for 9-10 pt print.
      const viewport = page.getViewport({ scale: 2.8 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      const result = await worker.recognize(canvas, {}, { blocks: true });
      const blocks = ((result.data as { blocks?: TesseractBlock[] | null }).blocks ?? []) as TesseractBlock[];
      const words: OcrWord[] = blocks.flatMap((b) =>
        (b.paragraphs ?? []).flatMap((para) =>
          (para.lines ?? []).flatMap((l) => (l.words ?? []).map((w) => ({ text: w.text, ...w.bbox }))),
        ),
      );
      const layout = wordsToLayout(words);
      lines.push(...layout.lines);
      ys.push(...layout.ys.map((y) => p * 100_000 + y));
      page.cleanup();
      canvas.width = canvas.height = 0;
    }
    return { lines, ys };
  } finally {
    await worker.terminate();
    await task.destroy();
  }
}
