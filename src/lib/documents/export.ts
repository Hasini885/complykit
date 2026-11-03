import type { Block } from "@/lib/documents/types";

/**
 * Turns a generated document into plain text, a Word file or a PDF. All three
 * read the same block list as the on-screen preview. The Word and PDF
 * libraries load only when a download is asked for.
 */

const FONT = "Bookman Old Style";

/* ------------------------------------------------------------------ */
/* Plain text (copy to clipboard)                                      */
/* ------------------------------------------------------------------ */

export function toPlainText(blocks: Block[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    switch (b.kind) {
      case "letterhead":
        out.push(b.name, ...b.lines, "");
        break;
      case "title":
        out.push(b.text.toUpperCase(), "");
        break;
      case "subtitle":
      case "heading":
        out.push(b.text, "");
        break;
      case "para":
      case "resolution":
        out.push(b.text, "");
        break;
      case "list":
        b.items.forEach((item, i) => out.push(`${b.ordered ? `${i + 1}.` : "•"} ${item}`));
        out.push("");
        break;
      case "details":
        b.rows.forEach(([k, v]) => out.push(`${k}: ${v}`));
        out.push("");
        break;
      case "signature":
        out.push(...b.lines, "");
        break;
      case "gap":
        out.push("");
        break;
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

/* ------------------------------------------------------------------ */
/* Word (.docx)                                                        */
/* ------------------------------------------------------------------ */

export async function toDocx(blocks: Block[], title: string): Promise<Blob> {
  const { AlignmentType, BorderStyle, Document, Packer, Paragraph, TextRun } = await import("docx");
  type Para = InstanceType<typeof Paragraph>;
  const align = {
    left: AlignmentType.LEFT,
    center: AlignmentType.CENTER,
    right: AlignmentType.RIGHT,
    justify: AlignmentType.JUSTIFIED,
  } as const;
  const run = (text: string, opts: { bold?: boolean; size?: number; allCaps?: boolean } = {}) =>
    new TextRun({ text, font: FONT, size: opts.size ?? 24, bold: opts.bold, allCaps: opts.allCaps });

  const children: Para[] = [];
  for (const b of blocks) {
    switch (b.kind) {
      case "letterhead":
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [run(b.name, { bold: true, size: 30 })] }));
        b.lines.forEach((line, i) =>
          children.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [run(line, { size: 20 })],
              border:
                i === b.lines.length - 1
                  ? { bottom: { style: BorderStyle.SINGLE, size: 6, color: "444444", space: 6 } }
                  : undefined,
              spacing: { after: i === b.lines.length - 1 ? 240 : 0 },
            }),
          ),
        );
        break;
      case "title":
        children.push(
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 120 }, children: [run(b.text, { bold: true, size: 26, allCaps: true })] }),
        );
        break;
      case "subtitle":
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [run(b.text, { bold: true })] }));
        break;
      case "heading":
        children.push(new Paragraph({ spacing: { before: 200, after: 100 }, children: [run(b.text, { bold: true })] }));
        break;
      case "para":
        children.push(
          new Paragraph({ alignment: align[b.align ?? "left"], spacing: { after: 120 }, children: [run(b.text, { bold: b.bold })] }),
        );
        break;
      case "resolution":
        children.push(
          new Paragraph({ alignment: AlignmentType.JUSTIFIED, indent: { left: 360 }, spacing: { after: 160 }, children: [run(b.text)] }),
        );
        break;
      case "list":
        b.items.forEach((item, i) =>
          children.push(
            new Paragraph({
              alignment: AlignmentType.JUSTIFIED,
              indent: { left: 720, hanging: 360 },
              spacing: { after: 80 },
              children: [run(`${b.ordered ? `${i + 1}.` : "•"}\t${item}`)],
              tabStops: [{ type: "left", position: 720 }],
            }),
          ),
        );
        children.push(new Paragraph({ children: [] }));
        break;
      case "details":
        b.rows.forEach(([k, v]) =>
          children.push(
            new Paragraph({
              tabStops: [{ type: "left", position: 3600 }],
              spacing: { after: 60 },
              children: [run(`${k}`, { bold: true }), run(`\t${v}`)],
            }),
          ),
        );
        children.push(new Paragraph({ children: [] }));
        break;
      case "signature":
        b.lines.forEach((line) =>
          children.push(new Paragraph({ alignment: b.align === "right" ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [run(line)] })),
        );
        break;
      case "gap":
        children.push(new Paragraph({ children: [] }));
        break;
    }
  }

  const doc = new Document({
    title,
    creator: "ComplyKit",
    sections: [{ properties: { page: { margin: { top: 709, bottom: 1134, left: 1304, right: 1134 } } }, children }],
  });
  return Packer.toBlob(doc);
}

/* ------------------------------------------------------------------ */
/* PDF                                                                 */
/* ------------------------------------------------------------------ */

/** jsPDF's built-in fonts cover Windows-1252; swap the few characters outside it. */
function pdfSafe(text: string): string {
  return text.replace(/₹/g, "Rs. ").replace(/[^\x00-\xFF–—‘’“”•…]/g, "?");
}

export async function toPdf(blocks: Block[]): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const left = 66;
  const right = pageW - 56;
  const width = right - left;
  let y = 40;

  const ensure = (h: number) => {
    if (y + h > pageH - 56) {
      doc.addPage();
      y = 40;
    }
  };
  const write = (
    text: string,
    opts: { bold?: boolean; size?: number; align?: "left" | "center" | "right" | "justify"; indent?: number; after?: number } = {},
  ) => {
    const size = opts.size ?? 11;
    doc.setFont("times", opts.bold ? "bold" : "normal");
    doc.setFontSize(size);
    const x = left + (opts.indent ?? 0);
    const w = width - (opts.indent ?? 0);
    const lines: string[] = doc.splitTextToSize(pdfSafe(text), w);
    const lh = size * 1.35;
    for (const line of lines) {
      ensure(lh);
      if (opts.align === "center") doc.text(line, pageW / 2, y, { align: "center" });
      else if (opts.align === "right") doc.text(line, right, y, { align: "right" });
      else doc.text(line, x, y);
      y += lh;
    }
    y += opts.after ?? 4;
  };

  for (const b of blocks) {
    switch (b.kind) {
      case "letterhead":
        write(b.name, { bold: true, size: 14, align: "center", after: 2 });
        b.lines.forEach((l) => write(l, { size: 9, align: "center", after: 0 }));
        y += 4;
        doc.setDrawColor(80);
        doc.line(left, y, right, y);
        y += 18;
        break;
      case "title":
        write(b.text.toUpperCase(), { bold: true, size: 12, align: "center", after: 8 });
        break;
      case "subtitle":
        write(b.text, { bold: true, align: "center", after: 6 });
        break;
      case "heading":
        y += 6;
        write(b.text, { bold: true, after: 4 });
        break;
      case "para":
        write(b.text, { bold: b.bold, align: b.align === "justify" ? "left" : b.align, after: 6 });
        break;
      case "resolution":
        write(b.text, { indent: 18, after: 8 });
        break;
      case "list":
        b.items.forEach((item, i) => {
          doc.setFont("times", "normal");
          doc.setFontSize(11);
          ensure(15);
          doc.text(b.ordered ? `${i + 1}.` : "•", left + 18, y);
          write(item, { indent: 36, after: 3 });
        });
        y += 4;
        break;
      case "details":
        b.rows.forEach(([k, v]) => {
          doc.setFont("times", "bold");
          doc.setFontSize(11);
          ensure(15);
          doc.text(pdfSafe(k), left, y);
          write(v, { indent: 170, after: 2 });
        });
        y += 6;
        break;
      case "signature":
        b.lines.forEach((l) => write(l, { align: b.align === "right" ? "right" : "left", after: 0 }));
        y += 6;
        break;
      case "gap":
        y += 10;
        break;
    }
  }
  return doc.output("blob");
}

/** Hands a file to the browser's download. */
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** "board-meeting-notice-meridian-analytics-2026-10-28" */
export function documentFileName(templateId: string, company: string, isoDay: string): string {
  const slug = company.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return [templateId, slug, isoDay].filter(Boolean).join("-");
}
