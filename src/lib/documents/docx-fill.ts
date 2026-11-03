import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";

/**
 * Fills a Word template that carries {{tokens}} in its text, keeping every
 * bit of the original formatting: only the text inside <w:t> changes.
 *
 *   {{company}}        the value, XML-escaped
 *   {{company|upper}}  the value in capitals
 *   {{meeting.date}}   a repeating table row or paragraph: the row (or
 *                      paragraph) holding it is copied once per item in
 *                      data.repeats.meeting
 *
 * A blank value prints as a fill-in line, as on a hand-filled form.
 */

export type DocxData = {
  values: Record<string, string>;
  repeats?: Record<string, Record<string, string>[]>;
};

export const BLANK = "__________";

const TOKEN = /\{\{([A-Za-z0-9_.]+)(?:\|(upper))?\}\}/g;
/** The parts of a .docx whose text can carry tokens. */
const TEXT_PART = /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/;

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function substitute(xml: string, lookup: (name: string) => string | undefined): string {
  return xml.replace(TOKEN, (whole, name: string, filter?: string) => {
    const raw = lookup(name);
    if (raw === undefined) return whole;
    const text = raw.trim() === "" ? BLANK : filter === "upper" ? raw.toUpperCase() : raw;
    return escapeXml(text);
  });
}

/** The smallest enclosing <w:tr> (or else <w:p>) around position i. */
function enclosing(xml: string, i: number): [number, number] | null {
  for (const tag of ["w:tr", "w:p"]) {
    const open = Math.max(xml.lastIndexOf(`<${tag}>`, i), xml.lastIndexOf(`<${tag} `, i));
    const close = xml.indexOf(`</${tag}>`, i);
    if (open !== -1 && close !== -1) {
      // Make sure the element we found is still open at i.
      const closedBetween = xml.lastIndexOf(`</${tag}>`, i);
      if (closedBetween < open) return [open, close + tag.length + 3];
    }
  }
  return null;
}

function expandRepeats(xml: string, repeats: Record<string, Record<string, string>[]>): string {
  for (const [group, items] of Object.entries(repeats)) {
    let at = xml.indexOf(`{{${group}.`);
    while (at !== -1) {
      const span = enclosing(xml, at);
      if (!span) break;
      const [start, end] = span;
      const unit = xml.slice(start, end);
      // An empty list keeps one row of fill-in lines rather than losing the row.
      const rows = (items.length ? items : [{}]).map((item) =>
        substitute(unit, (name) => (name.startsWith(`${group}.`) ? (item[name.slice(group.length + 1)] ?? "") : undefined)),
      );
      const joined = rows.join("");
      xml = xml.slice(0, start) + joined + xml.slice(end);
      at = xml.indexOf(`{{${group}.`, start + joined.length);
    }
  }
  return xml;
}

export function fillDocx(template: Uint8Array, data: DocxData): Uint8Array {
  const files = unzipSync(template);
  const out: Zippable = {};
  for (const [name, bytes] of Object.entries(files)) {
    if (!TEXT_PART.test(name)) {
      out[name] = bytes;
      continue;
    }
    let xml = strFromU8(bytes);
    if (data.repeats) xml = expandRepeats(xml, data.repeats);
    xml = substitute(xml, (n) => data.values[n] ?? "");
    out[name] = strToU8(xml);
  }
  return zipSync(out, { level: 6 });
}

/** Every token name a template uses, filters stripped: for checks and tests. */
export function tokensIn(template: Uint8Array): string[] {
  const files = unzipSync(template);
  const found = new Set<string>();
  for (const [name, bytes] of Object.entries(files)) {
    if (!TEXT_PART.test(name)) continue;
    for (const m of strFromU8(bytes).matchAll(TOKEN)) found.add(m[1]);
  }
  return [...found].sort();
}

/** Bundles several finished files into one .zip. */
export function zipFiles(files: Record<string, Uint8Array>): Uint8Array {
  return zipSync(files, { level: 0 });
}
