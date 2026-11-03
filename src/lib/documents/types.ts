/**
 * The document generator's building blocks.
 *
 * A template turns the values the user entered (plus the selected company)
 * into a list of blocks. The on-screen preview, the Word file, the PDF and
 * the copy-to-clipboard text are all rendered from that one list, so they can
 * never disagree.
 */

export type Block =
  | { kind: "letterhead"; name: string; lines: string[] }
  | { kind: "title"; text: string }
  | { kind: "subtitle"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "para"; text: string; align?: "left" | "center" | "right" | "justify"; bold?: boolean }
  /** A "RESOLVED THAT ..." paragraph, set off from the body. */
  | { kind: "resolution"; text: string }
  | { kind: "list"; items: string[]; ordered?: boolean }
  /** Two-column label/value lines, e.g. Date / Time / Venue. */
  | { kind: "details"; rows: [string, string][] }
  /** Signed off on the left unless `align` says right. */
  | { kind: "signature"; lines: string[]; align?: "left" | "right" }
  | { kind: "gap" };

export type FieldType = "text" | "textarea" | "date" | "time" | "number" | "select" | "director" | "list";

export type Field = {
  id: string;
  label: string;
  type: FieldType;
  /** Shown under the input. */
  hint?: string;
  placeholder?: string;
  required?: boolean;
  /** For "select". */
  options?: { value: string; label: string }[];
  /** Initial value; a function can read the selected company. */
  initial?: string | string[] | ((ctx: DocContext) => string | string[]);
  /** Lays the field across both columns of the form. */
  wide?: boolean;
};

export type DirectorRef = { name: string; din: string };

/** What a template knows about the selected company. */
export type DocContext = {
  companyName: string;
  cin: string;
  registeredOffice: string;
  entityLabel: string;
  directors: DirectorRef[];
  today: Date;
  /** ISO date, when the company profile has it. */
  incorporatedOn?: string;
  /** Contact details printed on every letterhead, from the company master data. */
  mobile?: string;
  email?: string;
};

export type Values = Record<string, string | string[]>;

export type DocTemplate = {
  id: string;
  title: string;
  category: DocCategory;
  /** Statutory basis, shown on the card. */
  reference: string;
  description: string;
  /** Words the "Find" box matches on. */
  keywords: string[];
  /** The form that must follow, if any, e.g. "DIR-12 within 30 days". */
  followUp?: string;
  fields: Field[];
  render: (v: Values, ctx: DocContext) => Block[];
};

/**
 * A template kept as a real Word file with {{tokens}} in it, so the download
 * keeps the original layout exactly. With several files it is a pack: the
 * same answers fill every file and the download is a .zip.
 */
export type DocxTemplate = Omit<DocTemplate, "render"> & {
  files: { name: string; url: string }[];
  data: (v: Values, ctx: DocContext) => import("@/lib/documents/docx-fill").DocxData;
};

export type AnyTemplate = DocTemplate | DocxTemplate;

export const isDocxTemplate = (t: AnyTemplate): t is DocxTemplate => "files" in t;

export const DOC_CATEGORIES = [
  "Board Meetings",
  "Board Resolutions",
  "General Meetings",
  "Director Compliance",
  "Appointments & Resignations",
  "AOC-4 Attachments",
] as const;

export type DocCategory = (typeof DOC_CATEGORIES)[number];
