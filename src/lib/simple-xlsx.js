/**
 * Downloads a plain table as an .xlsx file: a bold header row, then one row
 * per record. `rows` is an array of arrays of strings or numbers.
 */
export async function downloadTableXlsx({ header, rows, sheet, fileName, widths }) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const GRID = { borderColor: "#D0D5DD", borderStyle: "thin" };
  const data = [
    header.map((value) => ({ value, fontWeight: "bold", backgroundColor: "#344054", textColor: "#FFFFFF", ...GRID })),
    ...rows.map((r) =>
      r.map((value) =>
        value === "" || value === null || value === undefined ? GRID : { value, wrap: true, ...GRID },
      ),
    ),
  ];
  const blob = await writeXlsxFile([
    {
      data,
      sheet: sheet.slice(0, 31),
      columns: header.map((_, i) => ({ width: widths?.[i] ?? 18 })),
      stickyRowsCount: 1,
    },
  ]).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
