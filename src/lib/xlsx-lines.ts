/**
 * Reads an Excel workbook (for example MCA's "AllMDSData.xlsx" master data
 * download) into text lines for src/lib/pdf-text-parser.ts: one line per row,
 * cells joined by a wide gap, which the parser reads as a column break. So the
 * same reader handles the master data whether it came as a PDF or as Excel.
 */

type Cell = string | number | boolean | Date | null | undefined | object;

const pad = (n: number) => String(n).padStart(2, "0");

function cellText(cell: Cell): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) {
    return Number.isNaN(cell.getTime()) ? "" : `${pad(cell.getDate())}/${pad(cell.getMonth() + 1)}/${cell.getFullYear()}`;
  }
  return String(cell).replace(/\s+/g, " ").trim();
}

/** Every sheet's rows as lines, sheets one after another. */
export function sheetsToLines(sheets: { data: Cell[][] }[]): string[] {
  const lines: string[] = [];
  for (const sheet of sheets) {
    for (const row of sheet.data) {
      const cells = row.map(cellText).filter((c) => c !== "");
      if (cells.length > 0) lines.push(cells.join("    "));
    }
  }
  return lines;
}

/** Whether a file is an Excel workbook, by name or type. */
export function isExcelFile(file: { name: string; type: string }): boolean {
  return (
    /\.xlsx?$/i.test(file.name) ||
    file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.type === "application/vnd.ms-excel"
  );
}

/** Reads an .xlsx in the browser as text lines. */
export async function readXlsxLines(file: File): Promise<string[]> {
  const { default: readXlsxFile } = await import("read-excel-file/browser");
  return sheetsToLines(await readXlsxFile(file));
}
