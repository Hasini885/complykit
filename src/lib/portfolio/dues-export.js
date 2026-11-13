import { formatDate } from "@/lib/dates";
import { legal, site } from "@/config/site";
import { cellText, columnTitle, dueLines, filedLines } from "@/lib/portfolio/filing-matrix";
import { asExcelDate, DUES_COLUMNS, duesFileName, STATUS_LABEL } from "@/lib/portfolio/dues-table";

/** The file name, with the tag (if any) after "cacompliancetool-". */
function tagged(name, meta) {
  const tag = meta.fileTag
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return tag ? name.replace(/^cacompliancetool-/, `cacompliancetool-${tag}-`) : name;
}

/**
 * Traffic-light colours for each due, used on the whole row and, stronger,
 * on the Status cell: red overdue, orange due within 30 days, green filed.
 * Upcoming dues (more than 30 days away) are on track, so a pale green.
 */
export const STATUS_COLOURS = {
  overdue: { row: "#FEE4E2", cell: "#D92D20", cellText: "#FFFFFF", name: "Red" },
  "due-soon": { row: "#FFEAD5", cell: "#F79009", cellText: "#FFFFFF", name: "Orange" },
  completed: { row: "#D1FADF", cell: "#039855", cellText: "#FFFFFF", name: "Green" },
  upcoming: { row: "#F6FEF9", cell: "#A6F4C5", cellText: "#054F31", name: "Pale green" },
};

/** What each colour means, for the About sheet and the PDF key. */
const COLOUR_KEY = [
  ["overdue", "Overdue — the due date has passed and no filing is recorded"],
  ["due-soon", "Due within 30 days, not yet filed"],
  ["completed", "Filed — a filing date (and SRN) is recorded"],
  ["upcoming", "Upcoming — more than 30 days away, on track"],
];

/** Thin light grid lines, so cell borders still show through the row fills. */
const GRID = { borderColor: "#D0D5DD", borderStyle: "thin" };

/* ------------------------------------------------------------------ */
/* Excel                                                               */
/* ------------------------------------------------------------------ */

/** The .xlsx file as a Blob (separate from downloading, so it can be checked). */
export async function createDuesXlsx(
  rows,
  meta,
  /**
   * When given, the first sheet is the company-by-form filing status. A list
   * of { title, matrix } gives one sheet per section instead (e.g. post
   * incorporation, then annual compliance).
   */
  matrix,
) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");

  const header = DUES_COLUMNS.map((c) => ({
    value: c.header,
    fontWeight: "bold",
    backgroundColor: "#344054",
    textColor: "#FFFFFF",
    ...GRID,
  }));

  const body = rows.map((r) => {
    const colour = STATUS_COLOURS[r.status];
    // Every cell, empty ones included, carries the row colour, so the whole
    // row reads red / orange / green across the sheet.
    const row = { backgroundColor: colour.row, ...GRID };
    return DUES_COLUMNS.map((c) => {
      switch (c.key) {
        case "due":
          return { ...row, value: asExcelDate(r.due), type: Date, format: "dd-mmm-yyyy" };
        case "filedOn":
          return r.filedOn ? { ...row, value: asExcelDate(r.filedOn), type: Date, format: "dd-mmm-yyyy" } : row;
        case "status":
          return {
            ...GRID,
            value: STATUS_LABEL[r.status],
            backgroundColor: colour.cell,
            textColor: colour.cellText,
            fontWeight: "bold",
          };
        case "srn":
          return r.srn ? { ...row, value: r.srn, fontFamily: "Consolas" } : row;
        default: {
          const text = c.text(r);
          return text === "" ? row : { ...row, value: text };
        }
      }
    });
  });

  const about = [
    [{ value: `${site.name} — all dues, all companies`, fontWeight: "bold", fontSize: 14 }],
    [`Generated ${formatDate(meta.asOf)}`],
    [`Rows: ${rows.length}`],
    [`Showing: ${meta.scope}`],
    [
      "Covers obligations due from 90 days ago to 12 months ahead, across financial years, computed from each company's own profile.",
    ],
    [
      'Status "Filed" means a filing date was recorded in CA Compliance Tool (with its SRN where given). Other rows are pending until filed.',
    ],
    [""],
    [{ value: "Colour key", fontWeight: "bold" }],
    ...COLOUR_KEY.map(([status, meaning]) => [
      {
        value: `${STATUS_COLOURS[status].name}: ${meaning}`,
        backgroundColor: STATUS_COLOURS[status].row,
        ...GRID,
      },
    ]),
    [""],
    [legal.disclaimer],
  ];

  const list = {
    data: [header, ...body],
    sheet: "All dues",
    columns: DUES_COLUMNS.map((c) => ({ width: c.width })),
    stickyRowsCount: 1,
  };
  const info = { data: about, sheet: "About", columns: [{ width: 120 }] };
  const sections = !matrix ? [] : Array.isArray(matrix) ? matrix : [{ title: "Filing status", matrix }];
  const sheets = sections.filter((x) => x.matrix.columns.length > 0).map((x) => matrixSheet(x.matrix, x.title));
  return writeXlsxFile([...sheets, list, info]).toBlob();
}

/**
 * Companies down the side, dues across the top, each cell saying whether it
 * is filed: red not filed and overdue, orange not filed and due within 30
 * days, green filed, pale green not yet due, grey not applicable.
 */
function matrixSheet(matrix, title = "Filing status") {
  const head = [
    { value: "Company", fontWeight: "bold", backgroundColor: "#344054", textColor: "#FFFFFF", ...GRID },
    { value: "CIN / LLPIN", fontWeight: "bold", backgroundColor: "#344054", textColor: "#FFFFFF", ...GRID },
    ...matrix.columns.map((c) => ({
      value: columnTitle(c),
      fontWeight: "bold",
      backgroundColor: "#344054",
      textColor: "#FFFFFF",
      wrap: true,
      ...GRID,
    })),
  ];
  const body = matrix.rows.map((row) => [
    { value: row.company, fontWeight: "bold", ...GRID },
    { value: row.cin, fontFamily: "Consolas", ...GRID },
    ...matrix.columns.map((c) => {
      const cell = row.cells[c.key];
      if (!cell) return { value: "—", align: "center", textColor: "#98A2B3", backgroundColor: "#F2F4F7", ...GRID };
      if (cell.notRequired) {
        return {
          value: cellText(cell, formatDate),
          textColor: "#475467",
          backgroundColor: "#F2F4F7",
          wrap: true,
          ...GRID,
        };
      }
      const colour = STATUS_COLOURS[cell.status];
      return {
        value: cellText(cell, formatDate),
        backgroundColor: cell.status === "upcoming" ? colour.row : colour.cell,
        textColor: cell.status === "upcoming" ? colour.cellText : "#FFFFFF",
        fontWeight: cell.status === "upcoming" ? undefined : "bold",
        wrap: true,
        ...GRID,
      };
    }),
  ]);
  return {
    data: [head, ...body],
    // Excel sheet names: at most 31 characters, none of : \ / ? * [ ]
    sheet: title.replace(/[:\/?*[\]]/g, " ").slice(0, 31),
    columns: [{ width: 36 }, { width: 24 }, ...matrix.columns.map(() => ({ width: 26 }))],
    stickyRowsCount: 1,
    stickyColumnsCount: 1,
  };
}

export async function downloadDuesXlsx(rows, meta, matrix) {
  saveBlob(await createDuesXlsx(rows, meta, matrix), tagged(duesFileName(meta.asOf, "xlsx"), meta));
}

/* ------------------------------------------------------------------ */
/* PDF                                                                 */
/* ------------------------------------------------------------------ */

/** Columns that fit an A4 landscape page; the Excel file carries the rest. */
const PDF_COLUMNS = ["company", "obligation", "form", "fy", "period", "due", "status", "days", "filedOn", "srn"];

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** jsPDF's built-in fonts cover Windows-1252 only; swap the few characters outside it. */
function pdfSafe(text) {
  return text
    .replace(/₹/g, "Rs.")
    .replace(/≤/g, "<=")
    .replace(/→/g, "->")
    .replace(/[^\x00-\xFF–—‘’“”•…]/g, "?");
}

/** The .pdf file as a Blob (separate from downloading, so it can be checked). */
export async function createDuesPdf(rows, meta) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const columns = DUES_COLUMNS.filter((c) => PDF_COLUMNS.includes(c.key));
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 32;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(pdfSafe(`${site.name} — all dues, all companies`), margin, margin + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(pdfSafe(`Generated ${formatDate(meta.asOf)} · ${rows.length} rows · ${meta.scope}`), margin, margin + 22);

  // Colour key, one swatch per status.
  let x = margin;
  const keyY = margin + 34;
  doc.setFontSize(8);
  for (const [status] of COLOUR_KEY) {
    const colour = STATUS_COLOURS[status];
    doc.setFillColor(...hex(colour.cell));
    doc.rect(x, keyY - 7, 9, 9, "F");
    doc.setTextColor(60);
    const label = `${colour.name} = ${STATUS_LABEL[status].toLowerCase()}`;
    doc.text(label, x + 13, keyY);
    x += 13 + doc.getTextWidth(label) + 16;
  }

  const totalWidth = columns.reduce((s, c) => s + c.width, 0);
  const usable = pageWidth - margin * 2;
  const statusIndex = columns.findIndex((c) => c.key === "status");

  autoTable(doc, {
    startY: margin + 46,
    margin: { left: margin, right: margin, bottom: margin + 10 },
    head: [columns.map((c) => c.header)],
    body: rows.map((r) => columns.map((c) => pdfSafe(c.text(r)))),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: 3, overflow: "linebreak", valign: "middle" },
    headStyles: { fillColor: [52, 64, 84], textColor: 255, fontStyle: "bold" },
    columnStyles: Object.fromEntries(columns.map((c, i) => [i, { cellWidth: (c.width / totalWidth) * usable }])),
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const colour = STATUS_COLOURS[rows[data.row.index].status];
      if (data.column.index === statusIndex) {
        data.cell.styles.fillColor = hex(colour.cell);
        data.cell.styles.textColor = hex(colour.cellText);
        data.cell.styles.fontStyle = "bold";
      } else {
        data.cell.styles.fillColor = hex(colour.row);
      }
    },
    didDrawPage: () => {
      const page = doc.getCurrentPageInfo().pageNumber;
      doc.setFontSize(7.5);
      doc.setTextColor(120);
      doc.text(
        pdfSafe(
          `${site.name} · Generated ${formatDate(meta.asOf)} · Verify against the MCA portal before relying on a date.`,
        ),
        margin,
        pageHeight - 16,
      );
      doc.text(`Page ${page}`, pageWidth - margin, pageHeight - 16, { align: "right" });
    },
  });

  return doc.output("blob");
}

export async function downloadDuesPdf(rows, meta) {
  saveBlob(await createDuesPdf(rows, meta), tagged(duesFileName(meta.asOf, "pdf"), meta));
}

/** The filing-status matrix as an A4 landscape PDF, with the same colours. */
export async function createMatrixPdf(
  matrix,
  meta,
  /** Instead of one matrix: [{ title, matrix }], each section from a new page. */
  sections,
) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const parts = (sections ?? [{ title: "filing status by company", matrix }]).filter((x) => x.matrix.columns.length > 0);
  if (parts.length === 0) parts.push({ title: "filing status by company", matrix });
  parts.forEach((part, i) => {
    if (i > 0) doc.addPage();
    drawMatrix(doc, autoTable, part.matrix, part.title, meta);
  });
  return doc.output("blob");
}

function drawMatrix(doc, autoTable, matrix, title, meta) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 28;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(0);
  doc.text(pdfSafe(`${site.name} — ${title}`), margin, margin + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(
    pdfSafe(
      `Generated ${formatDate(meta.asOf)} · ${matrix.rows.length} companies · ${matrix.columns.length} dues · ${meta.scope}`,
    ),
    margin,
    margin + 22,
  );

  const short = (c) => {
    if (!c) return "—";
    if (c.notRequired)
      return `NA
${c.notRequired}`;
    const of = c.parts > 1 ? ` ${c.filedParts}/${c.parts}` : "";
    if (c.status === "completed")
      return [`Filed${of}`, ...dueLines(c, formatDate), ...filedLines(c, formatDate)].join("\n");
    const dates = dueLines(c, formatDate).join("\n");
    if (c.status === "upcoming") return `Not yet due${of}\n${dates}`;
    return `Not filed${of}\n${dates}${c.days < 0 ? `\n${-c.days}d overdue` : ""}`;
  };

  autoTable(doc, {
    startY: margin + 32,
    margin: { left: margin, right: margin, bottom: margin + 10 },
    head: [["Company", ...matrix.columns.map((c) => pdfSafe(columnTitle(c)))]],
    body: matrix.rows.map((r) => [pdfSafe(r.company), ...matrix.columns.map((c) => pdfSafe(short(r.cells[c.key])))]),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 7, cellPadding: 3, overflow: "linebreak", valign: "middle" },
    headStyles: { fillColor: [52, 64, 84], textColor: 255, fontStyle: "bold", fontSize: 6.5 },
    columnStyles: { 0: { cellWidth: 120, fontStyle: "bold" } },
    horizontalPageBreak: true,
    horizontalPageBreakRepeat: 0,
    didParseCell: (data) => {
      if (data.section !== "body" || data.column.index === 0) return;
      const row = matrix.rows[data.row.index];
      const cell = row.cells[matrix.columns[data.column.index - 1].key];
      if (!cell) {
        data.cell.styles.fillColor = hex("#F2F4F7");
        data.cell.styles.textColor = hex("#98A2B3");
        data.cell.styles.halign = "center";
        return;
      }
      if (cell.notRequired) {
        data.cell.styles.fillColor = hex("#F2F4F7");
        data.cell.styles.textColor = hex("#475467");
        return;
      }
      const colour = STATUS_COLOURS[cell.status];
      const upcoming = cell.status === "upcoming";
      data.cell.styles.fillColor = hex(upcoming ? colour.row : colour.cell);
      data.cell.styles.textColor = hex(upcoming ? colour.cellText : "#FFFFFF");
      if (!upcoming) data.cell.styles.fontStyle = "bold";
    },
    didDrawPage: () => {
      const page = doc.getCurrentPageInfo().pageNumber;
      doc.setFontSize(7.5);
      doc.setTextColor(120);
      doc.text(
        pdfSafe(
          `${site.name} · Red: not filed, overdue · Orange: not filed, due within 30 days · Green: filed · Pale: not yet due · Grey: not required this year · —: does not apply`,
        ),
        margin,
        pageHeight - 14,
      );
      doc.text(`Page ${page}`, pageWidth - margin, pageHeight - 14, { align: "right" });
    },
  });
}

export async function downloadMatrixPdf(matrix, meta, sections) {
  saveBlob(
    await createMatrixPdf(matrix, meta, sections),
    tagged(duesFileName(meta.asOf, "pdf").replace("all-dues", "filing-status"), meta),
  );
}

/** Hands a file to the browser's download. */
function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the download a moment to start before releasing the data.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
