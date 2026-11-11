const pad = (n) => String(n).padStart(2, "0");

function cellText(cell) {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) {
    return Number.isNaN(cell.getTime())
      ? ""
      : `${pad(cell.getDate())}/${pad(cell.getMonth() + 1)}/${cell.getFullYear()}`;
  }
  return String(cell).replace(/\s+/g, " ").trim();
}

/** Every sheet's rows as lines, sheets one after another. */
export function sheetsToLines(sheets) {
  const lines = [];
  for (const sheet of sheets) {
    for (const row of sheet.data) {
      const cells = row.map(cellText).filter((c) => c !== "");
      if (cells.length > 0) lines.push(cells.join("    "));
    }
  }
  return lines;
}

/** Whether a file is an Excel workbook, by name or type. */
export function isExcelFile(file) {
  return (
    /\.xlsx?$/i.test(file.name) ||
    file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.type === "application/vnd.ms-excel"
  );
}

/** Reads an .xlsx in the browser as text lines. */
export async function readXlsxLines(file) {
  const { default: readXlsxFile } = await import("read-excel-file/browser");
  return sheetsToLines(await readXlsxFile(file));
}
