"use client";

import * as React from "react";
import { Download, Loader2, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BANKS,
  MDY_BANKS,
  extractStatementPages,
  fmtAmt,
  fmtDate,
  linesToText,
  parseStatement,
  type StatementRow,
} from "@/lib/bank-statement";
import { cn } from "@/lib/utils";

type Row = StatementRow & { id: number; idx: number; ledger: string };
type Rule = { kw: string; ledger: string };

const DEFAULT_LEDGERS = ["Bank Charges", "Interest Received", "Cash", "Salary", "Rent", "Sales", "Purchases", "Utilities", "Travel", "Loan / EMI", "Tax / GST", "Suspense"];
const LEDGER_KEY = "complykit.bank-ledgers";
const RULE_KEY = "complykit.bank-rules";

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the choice just won't persist */
  }
}

const SORTS: { label: string; key: keyof Row | "amt"; dir: 1 | -1 }[] = [
  { label: "Statement order", key: "idx", dir: 1 },
  { label: "Date: oldest first", key: "date", dir: 1 },
  { label: "Date: newest first", key: "date", dir: -1 },
  { label: "Amount: highest first", key: "amt", dir: -1 },
  { label: "Amount: lowest first", key: "amt", dir: 1 },
  { label: "Description: A → Z", key: "desc", dir: 1 },
  { label: "Ledger: A → Z", key: "ledger", dir: 1 },
];

const field = "h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const NEW = "__new";

export function BankStatementConverter() {
  const [bank, setBank] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [layout, setLayout] = React.useState("");
  const [rawText, setRawText] = React.useState("");
  const [ledgers, setLedgers] = React.useState<string[]>(() => load(LEDGER_KEY, DEFAULT_LEDGERS));
  const [rules, setRules] = React.useState<Rule[]>(() => load(RULE_KEY, []));
  const [sel, setSel] = React.useState<Set<number>>(new Set());
  const [q, setQ] = React.useState("");
  const [type, setType] = React.useState<"all" | "debit" | "credit">("all");
  const [ledgerFilter, setLedgerFilter] = React.useState("__all");
  const [sortIdx, setSortIdx] = React.useState(0);
  const [bulkLedger, setBulkLedger] = React.useState("");
  const [remember, setRemember] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function addLedger(): string | null {
    const name = window.prompt("New ledger name")?.trim().replace(/\s+/g, " ");
    if (!name) return null;
    const existing = ledgers.find((l) => l.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    const next = [...ledgers, name].sort((a, b) => a.localeCompare(b));
    setLedgers(next);
    save(LEDGER_KEY, next);
    return name;
  }

  async function handleFile(f: File, pw = password) {
    if (!bank) return toast.error("Select the bank first.");
    setFile(f);
    setBusy(true);
    try {
      const pages = await extractStatementPages(f, pw);
      setRawText(linesToText(pages));
      if (!pages.some((p) => p.length)) {
        toast.error("No selectable text found. This looks like a scanned PDF, which needs OCR.");
        return;
      }
      const res = parseStatement(pages, MDY_BANKS.has(bank) ? "mdy" : "dmy");
      if (!res.rows.length) {
        toast.error("Couldn't find transactions. Check the extracted text below to see the layout.");
        return;
      }
      const next = res.rows.map<Row>((r, i) => {
        const hay = `${r.desc} ${r.ref}`.toLowerCase();
        const rule = rules.find((x) => hay.includes(x.kw));
        return { ...r, id: i + 1, idx: i, ledger: rule?.ledger ?? "" };
      });
      setRows(next);
      setLayout(res.layout);
      setSel(new Set());
      setQ("");
      setType("all");
      setLedgerFilter("__all");
      setSortIdx(0);
      toast.success(`Imported ${next.length} transactions.`);
    } catch (err) {
      if (err instanceof Error && err.name === "PasswordException") {
        toast.error("This PDF is password-protected. Enter the password and press Enter.");
      } else {
        console.error(err);
        toast.error("Could not read this PDF.");
      }
    } finally {
      setBusy(false);
    }
  }

  const view = React.useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean).map((w) => w.replace(/,/g, ""));
    const s = SORTS[sortIdx];
    const val = (r: Row) =>
      s.key === "amt" ? r.debit || r.credit : (r[s.key as keyof Row] as string | number | null);
    return rows
      .filter((r) => {
        if (type === "debit" && !r.debit) return false;
        if (type === "credit" && !r.credit) return false;
        if (ledgerFilter === "__none" && r.ledger) return false;
        if (ledgerFilter !== "__all" && ledgerFilter !== "__none" && r.ledger !== ledgerFilter) return false;
        if (words.length) {
          const h = `${fmtDate(r.date)} ${r.date} ${r.desc} ${r.ref} ${r.debit || ""} ${fmtAmt(r.debit)} ${r.credit || ""} ${fmtAmt(r.credit)} ${r.ledger}`.toLowerCase();
          const h2 = h.replace(/,/g, "");
          if (!words.every((w) => h.includes(w) || h2.includes(w))) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const x = val(a);
        const y = val(b);
        if (x === y || x == null || y == null) return a.idx - b.idx;
        return (x < y ? -1 : 1) * s.dir;
      });
  }, [rows, q, type, ledgerFilter, sortIdx]);

  const patch = (id: number, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const sum = (list: Row[], k: "debit" | "credit") => list.reduce((a, r) => a + r[k], 0);
  const unassigned = rows.filter((r) => !r.ledger).length;
  const allShownSelected = view.length > 0 && view.every((r) => sel.has(r.id));

  function applyBulk() {
    if (!bulkLedger) return toast.error("Choose a ledger first.");
    if (!sel.size) return toast.error("Tick the transactions to post, or use Select all shown.");
    setRows((rs) => rs.map((r) => (sel.has(r.id) ? { ...r, ledger: bulkLedger } : r)));
    const kw = q.trim().toLowerCase();
    if (remember && kw) {
      const next = [...rules.filter((r) => r.kw !== kw), { kw, ledger: bulkLedger }];
      setRules(next);
      save(RULE_KEY, next);
      toast.success(`Posted ${sel.size} to “${bulkLedger}”. Rule saved.`);
    } else toast.success(`Posted ${sel.size} transaction(s) to “${bulkLedger}”.`);
    setSel(new Set());
    setRemember(false);
  }

  async function exportXlsx(list: Row[], suffix: string) {
    if (!list.length) return toast.error("Nothing to export.");
    try {
      const { default: writeXlsxFile } = await import("write-excel-file/browser");
      const head = ["Date", "Description", "Ref / Chq No.", "Debit", "Credit", "Balance", "Ledger"].map((value) => ({
        value, fontWeight: "bold" as const, backgroundColor: "#344054", textColor: "#FFFFFF",
      }));
      const num = (v: number | null) => (v ? { value: v, type: Number, format: "#,##0.00" } : null);
      const body = list.map((r) => {
        const [y, m, d] = r.date.split("-").map(Number);
        return [
          { value: new Date(Date.UTC(y, m - 1, d)), type: Date, format: "dd-mmm-yyyy" },
          { value: r.desc },
          { value: r.ref },
          num(r.debit),
          num(r.credit),
          r.balance === null ? null : { value: r.balance, type: Number, format: "#,##0.00" },
          { value: r.ledger },
        ];
      });
      const groups = new Map<string, { n: number; d: number; c: number }>();
      for (const r of list) {
        const k = r.ledger || "(Unassigned)";
        const o = groups.get(k) ?? { n: 0, d: 0, c: 0 };
        o.n++; o.d += r.debit; o.c += r.credit;
        groups.set(k, o);
      }
      const bold = (value: string) => ({ value, fontWeight: "bold" as const, backgroundColor: "#344054", textColor: "#FFFFFF" });
      const money = (v: number) => ({ value: Math.round(v * 100) / 100, type: Number, format: "#,##0.00" });
      const summary: unknown[][] = [["Ledger", "Transactions", "Total debit", "Total credit", "Net (credit − debit)"].map(bold)];
      [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([k, o]) =>
        summary.push([{ value: k }, { value: o.n, type: Number }, money(o.d), money(o.c), money(o.c - o.d)]),
      );
      const td = sum(list, "debit"), tc = sum(list, "credit");
      summary.push([{ value: "TOTAL", fontWeight: "bold" }, { value: list.length, type: Number }, money(td), money(tc), money(tc - td)]);

      const blob = await writeXlsxFile([
        { data: [head, ...body], sheet: "Transactions", columns: [{ width: 13 }, { width: 60 }, { width: 18 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 24 }], stickyRowsCount: 1 },
        { data: summary, sheet: "Ledger Summary", columns: [{ width: 28 }, { width: 14 }, { width: 16 }, { width: 16 }, { width: 20 }] },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(file?.name ?? "statement").replace(/\.pdf$/i, "")}${suffix}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.success(`Downloaded ${list.length} transactions`);
    } catch (e) {
      console.error(e);
      toast.error("The Excel file could not be created. Try again.");
    }
  }

  const ledgerSelect = (value: string, onChange: (v: string) => void, className?: string) => (
    <select
      className={cn(field, className)}
      value={value}
      onChange={(e) => {
        if (e.target.value === NEW) {
          const n = addLedger();
          if (n) onChange(n);
        } else onChange(e.target.value);
      }}
    >
      <option value="">— Select ledger —</option>
      {ledgers.map((l) => <option key={l} value={l}>{l}</option>)}
      <option value={NEW}>＋ Create new ledger…</option>
    </select>
  );

  return (
    <div className="space-y-6">
      <p className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        Private: the PDF is read in your browser and never uploaded. Scanned (image-only) statements are not supported.
      </p>

      {/* Step 1 */}
      <section className="space-y-4 rounded-2xl border bg-card p-5">
        <h2 className="font-heading text-lg font-semibold">1. Choose bank &amp; upload PDF</h2>
        <div className="grid gap-4 md:grid-cols-[minmax(220px,320px)_minmax(180px,240px)_1fr] md:items-end">
          <label className="space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Bank
            <select className={cn(field, "w-full text-foreground normal-case")} value={bank} onChange={(e) => setBank(e.target.value)}>
              <option value="">— Select your bank —</option>
              {BANKS.map(([g, list]) => (
                <optgroup key={g} label={g}>{list.map((b) => <option key={b}>{b}</option>)}</optgroup>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            PDF password (if protected)
            <Input
              type="password"
              autoComplete="off"
              placeholder="optional"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && file && handleFile(file, e.currentTarget.value)}
            />
          </label>
          <div
            role="button"
            tabIndex={0}
            onClick={() => (bank ? inputRef.current?.click() : toast.error("Select the bank first."))}
            onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
            className={cn(
              "flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed p-4 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/50",
              dragging && "bg-muted/60 border-primary",
              !bank && "cursor-not-allowed opacity-60",
            )}
          >
            {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Upload className="size-5" aria-hidden />}
            {busy ? "Reading…" : file ? <span>Loaded <b className="text-foreground">{file.name}</b>. Drop another to replace.</span> : bank ? "Drop the PDF here or click to browse" : "Select a bank first"}
            <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
          </div>
        </div>
        {rawText ? (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">Extracted text (for troubleshooting)</summary>
            <pre className="mt-2 max-h-60 overflow-auto rounded-lg bg-muted p-3 text-xs">{rawText}</pre>
          </details>
        ) : null}
      </section>

      {rows.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-2 text-sm">
            {[
              ["Transactions", String(rows.length)],
              ["Total debit", fmtAmt(sum(rows, "debit")) || "0.00"],
              ["Total credit", fmtAmt(sum(rows, "credit")) || "0.00"],
              ["Unassigned", String(unassigned)],
              ["Columns", layout],
            ].map(([k, v]) => (
              <span key={k} className="rounded-full border bg-card px-3 py-1 text-muted-foreground">
                {k}: <b className="text-foreground">{v}</b>
              </span>
            ))}
          </div>

          {/* Step 2 */}
          <section className="space-y-4 rounded-2xl border bg-card p-5">
            <h2 className="font-heading text-lg font-semibold">2. Search, filter &amp; sort</h2>
            <div className="flex flex-wrap items-end gap-3">
              <label className="relative min-w-64 flex-1 basis-80 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Search
                <Search className="pointer-events-none absolute bottom-2.5 left-3 size-4" aria-hidden />
                <Input className="mt-1.5 pl-9" placeholder="description, ref, amount, date, ledger" value={q} onChange={(e) => setQ(e.target.value)} />
              </label>
              <label className="space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sort
                <select className={cn(field, "block text-foreground normal-case")} value={sortIdx} onChange={(e) => setSortIdx(+e.target.value)}>
                  {SORTS.map((s, i) => <option key={s.label} value={i}>{s.label}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type
                <select className={cn(field, "block text-foreground normal-case")} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
                  <option value="all">All</option><option value="debit">Debits only</option><option value="credit">Credits only</option>
                </select>
              </label>
              <label className="space-y-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ledger
                <select className={cn(field, "block text-foreground normal-case")} value={ledgerFilter} onChange={(e) => setLedgerFilter(e.target.value)}>
                  <option value="__all">All ledgers</option><option value="__none">Unassigned only</option>
                  {ledgers.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </label>
              <Button variant="outline" onClick={() => { setQ(""); setType("all"); setLedgerFilter("__all"); }}>Clear filters</Button>
            </div>
          </section>

          {/* Step 3 */}
          <section className="space-y-4 rounded-2xl border bg-card p-5">
            <h2 className="font-heading text-lg font-semibold">3. Post to ledgers</h2>
            <p className="text-sm text-muted-foreground">
              Pick a ledger per row, or tick rows (or Select all shown after searching) and post them to one ledger. Click a description, ref or amount to correct it.
            </p>
            <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/40 p-3">
              <Button variant="outline" size="sm" onClick={() => setSel(new Set(view.map((r) => r.id)))}>Select all shown</Button>
              <Button variant="outline" size="sm" onClick={() => setSel(new Set())}>Clear selection</Button>
              <span className="text-sm"><b>{sel.size}</b> selected</span>
              {ledgerSelect(bulkLedger, setBulkLedger)}
              <Button size="sm" onClick={applyBulk}>Post selected to ledger</Button>
              {q.trim() ? (
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  remember “{q.trim()}” → this ledger
                </label>
              ) : null}
              {rules.length ? (
                <details className="ml-auto text-xs">
                  <summary className="cursor-pointer text-muted-foreground">{rules.length} saved rule(s)</summary>
                  <ul className="mt-1 space-y-1">
                    {rules.map((r) => (
                      <li key={r.kw} className="flex items-center gap-2">
                        “{r.kw}” → <b>{r.ledger}</b>
                        <button aria-label="Remove rule" onClick={() => { const n = rules.filter((x) => x !== r); setRules(n); save(RULE_KEY, n); }}>
                          <X className="size-3" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>

            <div className="max-h-[66vh] overflow-auto rounded-xl border">
              <table className="w-full min-w-[1000px] text-sm">
                <thead className="sticky top-0 z-10 bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="p-2.5"><input type="checkbox" aria-label="Select all shown" checked={allShownSelected}
                      onChange={(e) => setSel(e.target.checked ? new Set(view.map((r) => r.id)) : new Set())} /></th>
                    {["#", "Date", "Description", "Ref / Chq"].map((h) => <th key={h} className="p-2.5 text-left">{h}</th>)}
                    {["Debit", "Credit", "Balance"].map((h) => <th key={h} className="p-2.5 text-right">{h}</th>)}
                    <th className="p-2.5 text-left">Ledger</th><th />
                  </tr>
                </thead>
                <tbody>
                  {view.map((r) => (
                    <tr key={r.id} className={cn("border-t align-top hover:bg-muted/40", sel.has(r.id) && "bg-primary/10")}>
                      <td className="p-2.5">
                        <input type="checkbox" aria-label={`Select row ${r.idx + 1}`} checked={sel.has(r.id)}
                          onChange={(e) => setSel((s) => { const n = new Set(s); if (e.target.checked) n.add(r.id); else n.delete(r.id); return n; })} />
                      </td>
                      <td className="p-2.5 text-muted-foreground">{r.idx + 1}</td>
                      <td className="whitespace-nowrap p-2.5 text-muted-foreground">{fmtDate(r.date)}</td>
                      <Editable className="min-w-80" value={r.desc} onCommit={(v) => patch(r.id, { desc: v })} />
                      <Editable value={r.ref} onCommit={(v) => patch(r.id, { ref: v })} />
                      <Editable num className="text-red-600 dark:text-red-400" value={fmtAmt(r.debit)} onCommit={(v) => patch(r.id, { debit: amount(v) })} />
                      <Editable num className="text-emerald-600 dark:text-emerald-400" value={fmtAmt(r.credit)} onCommit={(v) => patch(r.id, { credit: amount(v) })} />
                      <Editable num value={r.balance === null ? "" : fmtAmt(Math.abs(r.balance)) + (r.balance < 0 ? " Dr" : "")}
                        onCommit={(v) => patch(r.id, { balance: v.trim() === "" ? null : (/dr$/i.test(v.trim()) ? -1 : 1) * amount(v.replace(/\s*Dr$/i, "")) })} />
                      <td className="p-2">{ledgerSelect(r.ledger, (v) => patch(r.id, { ledger: v }), "w-full min-w-44")}</td>
                      <td className="p-2">
                        <Button variant="ghost" size="icon-sm" aria-label="Delete row"
                          onClick={() => { setRows((rs) => rs.filter((x) => x.id !== r.id)); setSel((s) => { const n = new Set(s); n.delete(r.id); return n; }); }}>
                          <Trash2 aria-hidden />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {view.length === 0 ? <p className="p-10 text-center text-muted-foreground">No transactions match your search / filters.</p> : null}
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full border px-3 py-1 text-muted-foreground">Showing <b className="text-foreground">{view.length}</b> of {rows.length}</span>
              <span className="rounded-full border px-3 py-1 text-muted-foreground">Debit: <b className="text-foreground">{fmtAmt(sum(view, "debit")) || "0.00"}</b></span>
              <span className="rounded-full border px-3 py-1 text-muted-foreground">Credit: <b className="text-foreground">{fmtAmt(sum(view, "credit")) || "0.00"}</b></span>
            </div>
          </section>

          {/* Step 4 */}
          <section className="space-y-3 rounded-2xl border bg-card p-5">
            <h2 className="font-heading text-lg font-semibold">4. Download</h2>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => exportXlsx([...rows].sort((a, b) => a.idx - b.idx), "")}><Download aria-hidden /> Excel: all transactions</Button>
              <Button variant="outline" onClick={() => exportXlsx(view, "_filtered")}><Download aria-hidden /> Excel: only what’s shown</Button>
              <Button variant="ghost" onClick={() => { setRows([]); setFile(null); setSel(new Set()); setRawText(""); }}><Plus aria-hidden /> Import another statement</Button>
            </div>
            <p className="text-sm text-muted-foreground">The workbook has a Transactions sheet (with a Ledger column) and a Ledger Summary sheet.</p>
          </section>
        </>
      ) : null}
    </div>
  );
}

function amount(s: string): number {
  const t = s.trim();
  if (!t) return 0;
  return Math.abs(parseFloat(t.replace(/[^\d.]/g, "")) || 0);
}

/** A table cell that edits in place and commits on blur or Enter. */
function Editable({ value, onCommit, num, className }: { value: string; onCommit: (v: string) => void; num?: boolean; className?: string }) {
  const ref = React.useRef<HTMLTableCellElement>(null);
  React.useEffect(() => {
    if (ref.current && ref.current.textContent !== value) ref.current.textContent = value;
  }, [value]);
  return (
    <td
      ref={ref}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck={false}
      className={cn("cursor-text p-2.5 outline-none focus:bg-background focus:ring-2 focus:ring-ring/50", num && "whitespace-nowrap text-right font-mono text-[13px]", className)}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
      onBlur={(e) => onCommit(e.currentTarget.textContent ?? "")}
    >
      {value}
    </td>
  );
}
