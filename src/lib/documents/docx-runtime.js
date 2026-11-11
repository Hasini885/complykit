import { fillDocx, zipFiles } from "@/lib/documents/docx-fill";
/** Word templates fetched once per page visit. */
const cache = new Map();

export function loadTemplateFile(url) {
  let hit = cache.get(url);
  if (!hit) {
    hit = fetch(url).then(async (res) => {
      if (!res.ok) throw new Error(`Template ${url} could not be loaded (${res.status})`);
      return new Uint8Array(await res.arrayBuffer());
    });
    hit.catch(() => cache.delete(url));
    cache.set(url, hit);
  }
  return hit;
}

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function fillFile(url, data) {
  return fillDocx(await loadTemplateFile(url), data);
}

/** The download: one .docx, or a .zip holding every document of a pack. */
export async function buildDownload(template, data, fileBase) {
  if (template.files.length === 1) {
    const bytes = await fillFile(template.files[0].url, data);
    return { blob: new Blob([bytes], { type: DOCX_MIME }), fileName: `${fileBase}.docx` };
  }
  const entries = {};
  await Promise.all(
    template.files.map(async (f, i) => {
      const name = `${String(i + 1).padStart(2, "0")} ${f.name
        .replace(/[\\/:*?"<>|]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()}.docx`;
      entries[name] = await fillFile(f.url, data);
    }),
  );
  return { blob: new Blob([zipFiles(entries)], { type: "application/zip" }), fileName: `${fileBase}.zip` };
}

/** Lays a filled document out as pages, the way Word shows it. */
export async function renderDocx(bytes, body, styles) {
  const { renderAsync } = await import("docx-preview");
  await renderAsync(new Blob([bytes], { type: DOCX_MIME }), body, styles, {
    inWrapper: true,
    breakPages: true,
    ignoreLastRenderedPageBreak: true,
    renderHeaders: true,
    renderFooters: true,
    hideWrapperOnPrint: true,
    className: "docx",
  });
}

/** Prints filled documents (one after another) from a hidden frame. */
export async function printDocx(files) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(
    "<!doctype html><html><head><meta charset='utf-8'><title>Print</title>" +
      "<style>@page{margin:0}body{margin:0}.docx-wrapper{background:none!important;padding:0!important}" +
      ".docx-wrapper>section.docx{box-shadow:none!important;margin:0!important;break-after:page}</style>" +
      "</head><body></body></html>",
  );
  doc.close();
  for (const bytes of files) {
    const holder = doc.createElement("div");
    doc.body.appendChild(holder);
    await renderDocx(bytes, holder, doc.head);
  }
  const win = frame.contentWindow;
  const cleanup = () => setTimeout(() => frame.remove(), 1000);
  win.addEventListener("afterprint", cleanup, { once: true });
  win.focus();
  win.print();
  // Some browsers never fire afterprint; don't leave the frame behind for long.
  setTimeout(() => frame.isConnected && frame.remove(), 60_000);
}
