import { formatDate, isoDate, today } from "@/lib/dates";
import { site } from "@/config/site";
import { consultantOf } from "@/lib/portfolio/consultants";
import { dinAt, directorsForClient } from "@/lib/portfolio/directors";
import { formatMobile } from "@/lib/portfolio/mobile";
import type { Client, Consultant, Director } from "@/lib/portfolio/types";

/**
 * Company Master Data, one row per company: the contact details, the
 * consultant (reference) and the directors in office. The same rows feed the
 * table on the page and the Excel download, so the two always agree.
 */

export type MasterDataRow = {
  clientId: string;
  name: string;
  cin: string;
  /** Formatted "98765 43210", or "" when none is recorded. */
  mobile: string;
  email: string;
  consultantName: string;
  consultantMobile: string;
  /** Directors in office at this company, with the DIN they hold here. */
  directors: { name: string; din: string }[];
};

export function masterDataRows(
  clients: Client[],
  directors: Director[],
  consultants: Consultant[],
  asOf: Date = today(),
): MasterDataRow[] {
  return clients.map((c) => {
    const consultant = consultantOf(c, consultants);
    return {
      clientId: c.id,
      name: c.name,
      cin: c.cin,
      mobile: c.mobile ? formatMobile(c.mobile) : "",
      email: c.email ?? "",
      consultantName: consultant?.name ?? "",
      consultantMobile: consultant ? formatMobile(consultant.mobile) : "",
      directors: directorsForClient(directors, c.id, asOf).map((d) => ({ name: d.name, din: dinAt(d, c.id) })),
    };
  });
}

/** "Asha Rao (DIN 12345678)", one per line. */
export function directorsText(row: MasterDataRow, separator = "\n"): string {
  return row.directors.map((d) => `${d.name} (DIN ${d.din})`).join(separator);
}

const HEAD = { fontWeight: "bold" as const, backgroundColor: "#344054", textColor: "#FFFFFF" };
const GRID = { borderColor: "#D0D5DD", borderStyle: "thin" as const };

export type MasterColumn = { header: string; width: number; text: (r: MasterDataRow) => string };

/**
 * One column per director, as many as the company with the most directors
 * has: a company can have any number, so nothing is fixed in advance.
 */
export function directorColumnCount(rows: MasterDataRow[]): number {
  return Math.max(0, ...rows.map((r) => r.directors.length));
}

/** "Asha Rao (DIN 12345678)" for the nth director, or "" when there is none. */
export function directorAt(row: MasterDataRow, index: number): string {
  const d = row.directors[index];
  return d ? `${d.name} (DIN ${d.din})` : "";
}

/** The columns of the table and both downloads, with one column per director. */
export function masterColumns(rows: MasterDataRow[]): MasterColumn[] {
  const base: MasterColumn[] = [
    { header: "Company name", width: 38, text: (r) => r.name },
    { header: "CIN / LLPIN", width: 24, text: (r) => r.cin },
    { header: "Mobile", width: 15, text: (r) => r.mobile },
    { header: "Email", width: 30, text: (r) => r.email },
    { header: "Consultant (reference)", width: 26, text: (r) => r.consultantName },
    { header: "Consultant mobile", width: 17, text: (r) => r.consultantMobile },
  ];
  const directors: MasterColumn[] = Array.from({ length: directorColumnCount(rows) }, (_, i) => ({
    header: `Director ${i + 1}`,
    width: 30,
    text: (r: MasterDataRow) => directorAt(r, i),
  }));
  return [...base, ...directors];
}

/** Every company's master data as an .xlsx file (a Blob, so it can be checked). */
export async function createMasterDataXlsx(rows: MasterDataRow[], asOf: Date): Promise<Blob> {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const columns = masterColumns(rows);
  const header = columns.map((c) => ({ value: c.header, ...HEAD, ...GRID }));
  const body = rows.map((r) =>
    columns.map((c, i) => {
      const value = c.text(r);
      return {
        ...GRID,
        ...(value === "" ? {} : { value }),
        ...(i === 0 ? { fontWeight: "bold" as const } : {}),
        wrap: true,
      };
    }),
  );
  const about = [
    [{ value: `${site.name} — company master data`, fontWeight: "bold" as const, fontSize: 14 }],
    [`Generated ${formatDate(asOf)}`],
    [`Companies: ${rows.length}`],
    ["Directors are those in office on that date, each with the DIN they hold at that company."],
  ];
  return writeXlsxFile([
    {
      data: [header, ...body],
      sheet: "Company master data",
      columns: columns.map((c) => ({ width: c.width })),
      stickyRowsCount: 1,
    },
    { data: about, sheet: "About", columns: [{ width: 100 }] },
  ]).toBlob();
}

/** jsPDF's built-in fonts cover Windows-1252 only; swap the few characters outside it. */
function pdfSafe(text: string): string {
  return text.replace(/₹/g, "Rs.").replace(/[^\x00-\xFF–—‘’“”•…]/g, "?");
}

/** Every company's master data as an A4 landscape PDF (a Blob, so it can be checked). */
export async function createMasterDataPdf(rows: MasterDataRow[], asOf: Date): Promise<Blob> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 32;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(pdfSafe(`${site.name} — company master data`), margin, margin + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(
    pdfSafe(`Generated ${formatDate(asOf)} · ${rows.length} ${rows.length === 1 ? "company" : "companies"} · directors in office on that date`),
    margin,
    margin + 22,
  );

  const columns = masterColumns(rows);
  const total = columns.reduce((n, c) => n + c.width, 0);
  const usable = pageWidth - margin * 2;
  autoTable(doc, {
    startY: margin + 36,
    margin: { left: margin, right: margin, bottom: margin + 10 },
    head: [columns.map((c) => c.header)],
    body: rows.map((r) => columns.map((c) => pdfSafe(c.text(r)))),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 4, overflow: "linebreak", valign: "top" },
    headStyles: { fillColor: [52, 64, 84], textColor: 255, fontStyle: "bold" },
    columnStyles: Object.fromEntries(
      columns.map((c, i) => [i, { cellWidth: (c.width / total) * usable, fontStyle: i === 0 ? "bold" : "normal" }]),
    ),
    didDrawPage: () => {
      const page = doc.getCurrentPageInfo().pageNumber;
      doc.setFontSize(7.5);
      doc.setTextColor(120);
      doc.text(pdfSafe(`${site.name} · Company master data · Generated ${formatDate(asOf)}`), margin, pageHeight - 16);
      doc.text(`Page ${page}`, pageWidth - margin, pageHeight - 16, { align: "right" });
    },
  });
  return doc.output("blob");
}

/** Downloads every company's master data as Excel or PDF. */
export async function downloadMasterData(kind: "xlsx" | "pdf", rows: MasterDataRow[], asOf: Date): Promise<void> {
  const blob = kind === "xlsx" ? await createMasterDataXlsx(rows, asOf) : await createMasterDataPdf(rows, asOf);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `complykit-company-master-data-${isoDate(asOf)}.${kind}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
