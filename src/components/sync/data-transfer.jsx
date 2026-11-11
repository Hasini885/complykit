"use client";

import * as React from "react";
import { Download, Loader2, Upload } from "lucide-react";

import { exportAccountData, importAccountData } from "@/components/sync/account-sync";
import { isAccountData } from "@/lib/sync-plan";
import { isoDate } from "@/lib/dates";

/**
 * The "Data" page in the Account window: export everything (companies,
 * directors, consultants, filings, checklists, saved documents) as one JSON
 * file, or import such a file to replace what is here. Imported data is then
 * saved to the account by the automatic sync.
 *
 * Styled plainly, since it renders inside Clerk's window.
 */
export function DataTransferPage() {
  const inputRef = React.useRef(null);
  const [message, setMessage] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  function exportData() {
    const data = exportAccountData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cacompliancetool-data-${isoDate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    const p = data.portfolio;
    setMessage({
      ok: true,
      text: `Exported ${p.clients.length} companies, ${p.directors.length} directors and ${p.consultants?.length ?? 0} consultants.`,
    });
  }

  async function importData(file) {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      let data;
      try {
        data = JSON.parse(await file.text());
      } catch {
        setMessage({ ok: false, text: "That file is not valid JSON." });
        return;
      }
      if (!isAccountData(data)) {
        setMessage({
          ok: false,
          text: "That is not a CA Compliance Tool data file. Use a file made with Export data.",
        });
        return;
      }
      const p = data.portfolio;
      const sure = window.confirm(
        `Replace everything here with this file?\n\n${p.clients.length} companies, ${p.directors.length} directors, ${p.consultants?.length ?? 0} consultants.\n\nThe data you have now will be overwritten. Export it first if you may need it.`,
      );
      if (!sure) return;
      importAccountData(data);
      setMessage({ ok: true, text: "Imported. Reloading…" });
      window.setTimeout(() => window.location.reload(), 600);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const button =
    "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-black/5 disabled:opacity-60 dark:hover:bg-white/10";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div>
        <h1 style={{ fontSize: "1.0625rem", fontWeight: 700 }}>Data</h1>
        <p style={{ fontSize: "0.8125rem", opacity: 0.7, marginTop: "0.25rem" }}>
          Back up or move your companies, directors, consultants, filings, checklists and saved documents as a JSON
          file.
        </p>
      </div>

      <section style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <h2 style={{ fontSize: "0.875rem", fontWeight: 600 }}>Export data</h2>
        <p style={{ fontSize: "0.8125rem", opacity: 0.7 }}>Downloads everything in your account as one .json file.</p>
        <div>
          <button type="button" className={button} onClick={exportData}>
            <Download className="size-4" aria-hidden /> Export data (JSON)
          </button>
        </div>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <h2 style={{ fontSize: "0.875rem", fontWeight: 600 }}>Import data</h2>
        <p style={{ fontSize: "0.8125rem", opacity: 0.7 }}>
          Replaces your data with a file made by Export data. What you have now is overwritten.
        </p>
        <div>
          <button type="button" className={button} onClick={() => inputRef.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}{" "}
            Import data (JSON)
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => importData(e.target.files?.[0])}
          />
        </div>
      </section>

      {message ? (
        <p role="status" style={{ fontSize: "0.8125rem", color: message.ok ? "#059669" : "#dc2626" }}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
