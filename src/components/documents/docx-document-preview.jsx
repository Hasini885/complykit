"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

/**
 * The filled Word document, laid out as pages exactly as the download will
 * open in Word. Re-renders shortly after typing stops.
 */
export function DocxDocumentPreview({ url, data }) {
  const bodyRef = React.useRef(null);
  const stylesRef = React.useRef(null);
  const [state, setState] = React.useState("loading");

  React.useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const { fillFile, renderDocx } = await import("@/lib/documents/docx-runtime");
        const bytes = await fillFile(url, data);
        if (cancelled || !bodyRef.current || !stylesRef.current) return;
        // Render off-screen first so the page doesn't flash empty while typing.
        const body = document.createElement("div");
        const styles = document.createElement("div");
        await renderDocx(bytes, body, styles);
        if (cancelled || !bodyRef.current || !stylesRef.current) return;
        stylesRef.current.replaceChildren(...styles.childNodes);
        bodyRef.current.replaceChildren(...body.childNodes);
        fitToWidth(bodyRef.current);
        setState("ready");
      } catch (error) {
        console.error("Word preview failed", error);
        if (!cancelled) setState("error");
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [url, data]);

  // Pages are A4-wide; shrink them to the column rather than cutting them off.
  React.useEffect(() => {
    const host = bodyRef.current;
    if (!host || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => fitToWidth(host));
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative">
      {state === "loading" ? (
        <p className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Laying out the document…
        </p>
      ) : null}
      {state === "error" ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          The preview could not be shown. The Word download still works.
        </p>
      ) : null}
      {/* Plain (unlayered) CSS, so it outranks the stylesheet docx-preview injects. */}
      <style>{PREVIEW_CSS}</style>
      <div ref={stylesRef} hidden />
      <div ref={bodyRef} className="ck-docx overflow-hidden" />
    </div>
  );
}

const PREVIEW_CSS =
  ".ck-docx .docx-wrapper{background:transparent;padding:0}" +
  ".ck-docx .docx-wrapper>section.docx{margin-bottom:24px;box-shadow:0 0 0 1px rgb(0 0 0/.12)}";

function fitToWidth(host) {
  const wrapper = host.querySelector(".docx-wrapper");
  const page = wrapper?.querySelector("section.docx");
  if (!wrapper || !page) return;
  const pageWidth = page.offsetWidth;
  const scale = pageWidth > 0 ? Math.min(1, host.clientWidth / pageWidth) : 1;
  wrapper.style.zoom = String(scale);
}
