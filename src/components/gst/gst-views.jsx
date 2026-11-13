"use client";

import * as React from "react";
import { toast } from "sonner";
import { Copy, Download, ExternalLink, FolderOpen, Play, Plus, Search, Trash2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tip } from "@/components/shared/tip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useColumnFilters } from "@/components/shared/column-filter";
import { SHEET_INPUT, Sheet, SheetCell, SheetHead, pastedDate, pastedFiled } from "@/components/shared/sheet";
import { LegendDot, MiniCalendar } from "@/components/shared/mini-calendar";
import { useStoredJson } from "@/lib/stored-json";
import { newId } from "@/lib/portfolio/clients";
import { cn } from "@/lib/utils";
import { site } from "@/config/site";
import {
  EMPTY_GST,
  GST_DUE_DAYS,
  GST_KEY,
  GST_LOGIN_URL,
  GSTIN_RE,
  activeIn,
  currentMonth,
  fromBackup,
  monthLabel,
  monthSummary,
  newGstClient,
  normaliseGstin,
  shiftMonth,
  statusOf,
  withStatus,
} from "@/lib/gst/register";

const isoToday = () => new Date().toISOString().slice(0, 10);

/**
 * A real link to the GST login page that opens in a new tab. A link is never
 * stopped by Chrome's popup blocker (a script-opened window can be). `onOpen`
 * runs as it is clicked, before the tab opens.
 */
function PortalLink({ onOpen, children }) {
  return (
    <Button asChild size="sm" variant="outline">
      <a href={GST_LOGIN_URL} target="_blank" rel="noopener noreferrer" onClick={onOpen}>
        <ExternalLink className="size-3.5" aria-hidden /> {children}
      </a>
    </Button>
  );
}

/* ------------------------------------------------------------------ */
/* Shared top: title, month summary and the GST due-date calendar      */
/* ------------------------------------------------------------------ */

function GstTop({ title, data, month, onShift }) {
  const sum = monthSummary(data, month);
  const [y, m] = month.split("-").map(Number);
  const today = isoToday();
  const marks = {};
  for (const [key, day] of Object.entries(GST_DUE_DAYS)) {
    const iso = `${month}-${String(day).padStart(2, "0")}`;
    const list = data.clients.filter((c) => activeIn(c, month));
    const allFiled = list.length > 0 && list.every((c) => statusOf(data.status, month, c.id)[key] === "filed");
    const name = key === "g1" ? "GSTR-1" : "GSTR-3B";
    marks[iso] = {
      tone: allFiled ? "done" : iso < today ? "overdue" : "due",
      title: `${name} due${allFiled ? " · all filed" : ""}`,
    };
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-3">
        <h1 className="font-heading text-3xl font-bold tracking-tight">{title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">{monthLabel(month)}:</span>
          <Num value={sum.total} label="Clients" />
          <Num value={sum.notFiled} label="Not filed" className="text-destructive" />
          <Num value={sum.filed} label="Filed" className="text-emerald-500" />
        </div>
        <p className="text-xs text-muted-foreground">Filed means both GSTR-1 and GSTR-3B are filed for the month.</p>
      </div>
      <MiniCalendar
        compact
        heading="GST due dates"
        year={y}
        month={m - 1}
        marks={marks}
        today={today}
        onShift={onShift}
        note="GSTR-1 on the 11th · GSTR-3B on the 20th"
        legend={
          <>
            <LegendDot className="bg-primary">Due</LegendDot>
            <LegendDot className="bg-destructive">Past, not all filed</LegendDot>
            <LegendDot className="bg-emerald-600">All filed</LegendDot>
          </>
        }
      />
    </div>
  );
}

/** A small count: "3 Clients", "1 Not filed". */
function Num({ value, label, className }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded-full border-2 border-dashed border-primary/25 px-3 py-1">
      <b className={cn("font-heading text-lg", className)}>{value}</b>
      <small className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">{label}</small>
    </span>
  );
}

function SearchBox({ value, onChange }) {
  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onChange("")}
        placeholder="Search anything…"
        className="h-10 w-72 rounded-full border bg-background pr-3 pl-8 text-[15px] outline-none focus:ring-2 focus:ring-ring/40"
        aria-label="Search"
      />
    </div>
  );
}

/** Every word typed must appear somewhere in the row. */
function matches(words, text) {
  const hay = text.toLowerCase();
  return words.every((w) => hay.includes(w));
}

/* ------------------------------------------------------------------ */
/* Client register                                                     */
/* ------------------------------------------------------------------ */

const REGISTER_COLS = [
  { key: "name", label: "Business name", width: 280 },
  { key: "signatory", label: "Signatory / Proprietor", width: 230 },
  { key: "email", label: "Email ID", width: 260 },
  { key: "mobile", label: "Mobile Number", width: 160 },
  { key: "gstin", label: "GSTIN", width: 200, req: true },
  { key: "user", label: "User name", width: 190 },
  // Hidden until "Show passwords" is ticked; left out of search, filters and downloads.
  { key: "pass", label: "Password", width: 200, secret: true },
  { key: "reg", label: "Registration date", width: 175, date: true },
  { key: "deact", label: "Deactivate date", width: 175, date: true },
  { key: "folder", label: "Folder path", width: 260 },
];

const dmy = (iso) => (iso ? iso.split("-").reverse().join("-") : "");

export function GstRegisterView() {
  const [data, setData, ready] = useStoredJson(GST_KEY, EMPTY_GST);
  const [month, setMonth] = React.useState(currentMonth);
  const [query, setQuery] = React.useState("");
  const valueOf = React.useCallback((c, key) => {
    const col = REGISTER_COLS.find((x) => x.key === key);
    return col?.date ? dmy(c[key]) : String(c[key] ?? "");
  }, []);
  const table = useColumnFilters(valueOf);
  const fileRef = React.useRef(null);
  const [showPw, setShowPw] = React.useState(false);
  const plainCols = REGISTER_COLS.filter((col) => !col.secret);
  const helper = useGstHelper(setData);
  const [installOpen, setInstallOpen] = React.useState(false);

  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const numbered = data.clients.map((c, i) => ({ ...c, sno: i + 1 }));
  const rows = table.apply(
    numbered.filter((c) => matches(words, plainCols.map((col) => valueOf(c, col.key)).join(" "))),
  );

  async function copyPassword(c) {
    if (!c.pass) return false;
    try {
      await navigator.clipboard.writeText(c.pass);
      return true;
    } catch {
      return false;
    }
  }
  /**
   * As the GST login link is clicked: with the GST Helper extension, the
   * client's user name and password are passed to it to fill in on the page;
   * without it, the password is copied ready to paste.
   */
  function onPortalOpen(c) {
    portalOpen(helper, c, copyPassword);
  }

  function setField(id, field, value) {
    setData((d) => ({
      ...d,
      clients: d.clients.map((c) =>
        c.id === id ? { ...c, [field]: field === "gstin" ? normaliseGstin(value) : value } : c,
      ),
    }));
  }
  function addClient() {
    table.clear();
    setQuery("");
    setData((d) => ({ ...d, clients: [...d.clients, newGstClient(newId())] }));
  }
  /** A block pasted from Excel fills the cells from where it lands, adding clients as needed. */
  function pasteGrid(block, r, c) {
    const targetIds = rows.map((x) => x.id);
    setData((d) => {
      const clients = [...d.clients];
      block.forEach((cells, i) => {
        let id = targetIds[r + i];
        if (!id) {
          const fresh = newGstClient(newId());
          clients.push(fresh);
          id = fresh.id;
        }
        const at = clients.findIndex((x) => x.id === id);
        const next = { ...clients[at] };
        cells.forEach((v, j) => {
          const col = REGISTER_COLS[c + j];
          if (!col) return;
          next[col.key] = col.key === "gstin" ? normaliseGstin(v) : col.date ? pastedDate(v) : v;
        });
        clients[at] = next;
      });
      return { ...d, clients };
    });
    toast.success(`Pasted ${block.length} row${block.length === 1 ? "" : "s"}`);
  }
  function remove(c) {
    if (!window.confirm(`Delete ${c.name || "this client"}?`)) return;
    setData((d) => ({ ...d, clients: d.clients.filter((x) => x.id !== c.id) }));
  }
  function openFolder(c) {
    if (!c.folder) return toast.info("Enter a folder path first.");
    // Handled by the folder opener set up on this computer (from the GST Register extension).
    window.location.href = `gstfolder:${encodeURIComponent(c.folder)}`;
  }
  async function importFile(file) {
    try {
      const json = JSON.parse(await file.text());
      const incoming = fromBackup(json, newId);
      if (incoming.clients.length === 0) return toast.error("No GST clients found in that file.");
      const replace =
        data.clients.length === 0 ||
        window.confirm(
          `Replace your ${data.clients.length} GST clients with the ${incoming.clients.length} in this file? Cancel keeps yours and adds the new ones.`,
        );
      setData((d) =>
        replace
          ? incoming
          : {
              clients: [...d.clients, ...incoming.clients.filter((c) => !d.clients.some((x) => x.id === c.id))],
              status: { ...incoming.status, ...d.status },
            },
      );
      toast.success(`Imported ${incoming.clients.length} GST clients`);
    } catch {
      toast.error("That file could not be read. Choose a GST Register backup (.json).");
    }
  }
  async function exportExcel() {
    const { downloadTableXlsx } = await import("@/lib/simple-xlsx");
    await downloadTableXlsx({
      // Passwords are never written to the download.
      header: ["S.No", ...plainCols.map((c) => c.label)],
      rows: rows.map((c) => [c.sno, ...plainCols.map((col) => valueOf(c, col.key))]),
      sheet: "GST client register",
      fileName: `cacompliancetool-gst-clients-${isoToday()}.xlsx`,
      widths: [6, 30, 24, 28, 14, 18, 18, 14, 14, 30],
    });
  }

  if (!ready) return <div className="h-64 animate-pulse rounded-3xl border bg-muted/30" aria-hidden />;

  return (
    <div className="space-y-6">
      <GstTop
        title="GST Client Register"
        data={data}
        month={month}
        onShift={(n) => setMonth((m) => shiftMonth(m, n))}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={addClient}>
          <Plus className="size-4" aria-hidden /> Add client
        </Button>
        <Tip label="Import a GST Register backup (.json)">
          <Button variant="outline" size="icon" onClick={() => fileRef.current?.click()} aria-label="Import backup">
            <Upload className="size-4" aria-hidden />
          </Button>
        </Tip>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void importFile(f);
          }}
        />
        <Tip label="Download as Excel">
          <Button
            variant="outline"
            size="icon"
            onClick={() => void exportExcel()}
            disabled={rows.length === 0}
            aria-label="Download as Excel"
          >
            <Download className="size-4" aria-hidden />
          </Button>
        </Tip>
        <label className="ml-1 flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={showPw} onChange={(e) => setShowPw(e.target.checked)} /> Show passwords
        </label>
        <HelperStatus helper={helper} onSetUp={() => setInstallOpen(true)} />
        <span className="flex-1" />
        {table.any || query ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              table.clear();
              setQuery("");
            }}
          >
            <X className="size-3.5" aria-hidden /> Clear all filters
          </Button>
        ) : null}
        <SearchBox value={query} onChange={setQuery} />
      </div>

      <Sheet
        onPasteGrid={pasteGrid}
        onEnterPastEnd={addClient}
        minWidth={64 + 210 + REGISTER_COLS.reduce((n, c) => n + c.width, 0)}
      >
        <colgroup>
          <col style={{ width: 64 }} />
          {REGISTER_COLS.map((col) => (
            <col key={col.key} style={{ width: col.width }} />
          ))}
          <col style={{ width: 210 }} />
        </colgroup>
        <thead>
          <tr>
            <SheetHead sno>S.No</SheetHead>
            {REGISTER_COLS.map((col) => (
              <SheetHead
                key={col.key}
                req={col.req}
                filter={col.secret ? undefined : table.propsFor(col.key, col.label, numbered)}
              >
                {col.label}
              </SheetHead>
            ))}
            <SheetHead />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <SheetCell colSpan={REGISTER_COLS.length + 2} className="py-10 text-center text-muted-foreground">
                {data.clients.length === 0
                  ? "No clients yet. Click Add client, or paste rows copied from Excel into a cell."
                  : "No clients match these filters."}
              </SheetCell>
            </tr>
          ) : (
            rows.map((c, r) => {
              const dead = c.deact && c.deact <= isoToday();
              return (
                <tr key={c.id} className={dead ? "opacity-50" : undefined}>
                  <SheetCell sno>{c.sno}</SheetCell>
                  {REGISTER_COLS.map((col, ci) => (
                    <SheetCell key={col.key}>
                      {col.key === "folder" ? (
                        <span className="flex items-center pr-1">
                          <input
                            data-r={r}
                            data-c={ci}
                            value={c.folder}
                            onChange={(e) => setField(c.id, "folder", e.target.value)}
                            placeholder="e.g. D:\Clients\ABC"
                            className={SHEET_INPUT}
                            aria-label="Folder path"
                          />
                          <Tip label="Open in File Explorer (needs the folder opener on this computer)">
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => openFolder(c)}
                              aria-label="Open folder"
                            >
                              <FolderOpen className="size-4" aria-hidden />
                            </Button>
                          </Tip>
                        </span>
                      ) : col.secret ? (
                        <span className="flex items-center pr-1">
                          <input
                            data-r={r}
                            data-c={ci}
                            type={showPw ? "text" : "password"}
                            autoComplete="new-password"
                            value={c.pass ?? ""}
                            onChange={(e) => setField(c.id, "pass", e.target.value)}
                            className={cn(SHEET_INPUT, "font-mono")}
                            aria-label={`Password for ${c.name || "client"}`}
                          />
                          <Tip label="Copy password">
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              disabled={!c.pass}
                              onClick={async () => {
                                if (await copyPassword(c)) toast.success("Password copied");
                              }}
                              aria-label="Copy password"
                            >
                              <Copy className="size-4" aria-hidden />
                            </Button>
                          </Tip>
                        </span>
                      ) : (
                        <input
                          data-r={r}
                          data-c={ci}
                          type={col.date ? "date" : col.key === "mobile" ? "tel" : "text"}
                          inputMode={col.key === "email" ? "email" : undefined}
                          maxLength={col.key === "gstin" || col.key === "mobile" ? 15 : undefined}
                          value={c[col.key] ?? ""}
                          onChange={(e) => setField(c.id, col.key, e.target.value)}
                          className={cn(
                            SHEET_INPUT,
                            col.key === "name" && "font-medium",
                            col.key === "gstin" && "font-mono uppercase",
                            col.key === "gstin" && c.gstin && !GSTIN_RE.test(c.gstin) && "text-destructive",
                          )}
                          aria-label={col.label}
                        />
                      )}
                    </SheetCell>
                  ))}
                  <SheetCell className="px-2 whitespace-nowrap">
                    <PortalLink onOpen={() => onPortalOpen(c)}>Open Portal</PortalLink>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="ml-1 text-destructive hover:text-destructive"
                      onClick={() => remove(c)}
                      aria-label={`Delete ${c.name || "client"}`}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </SheetCell>
                </tr>
              );
            })
          )}
          <tr className="cursor-pointer text-muted-foreground" onClick={addClient}>
            <SheetCell sno>+</SheetCell>
            <SheetCell colSpan={REGISTER_COLS.length + 1} className="px-3">
              Click to add a client… (or press Enter on the last row)
            </SheetCell>
          </tr>
        </tbody>
      </Sheet>
      <p className="text-xs text-muted-foreground">
        Open Portal opens the GST login page with the client&apos;s user name and password filled in (with the GST
        Helper added to Chrome; without it, the password is copied ready to paste). Passwords are saved privately with
        your {site.name} account, stay hidden until you tick Show passwords, and are never included in downloads. After
        a client&apos;s deactivate date, later months no longer list it.
      </p>
      <InstallHelperDialog open={installOpen} onOpenChange={setInstallOpen} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Return filing status                                                */
/* ------------------------------------------------------------------ */

/** `client`: kept on the client (shared with the register); otherwise kept per month. */
const RETURN_COLS = [
  { key: "name", label: "Business name", width: 290, client: true },
  { key: "signatory", label: "Signatory / Proprietor", width: 230, client: true },
  { key: "assigned", label: "Assigned To", width: 190 },
  { key: "gstin", label: "GSTIN", width: 200, client: true },
  { key: "user", label: "User name", width: 190, client: true },
  { key: "g1", label: "GSTR-1", width: 160, status: true },
  { key: "g3b", label: "GSTR-3B", width: 160, status: true },
  { key: "remarks", label: "Remarks", width: 300 },
];
const filedLabel = (v) => (v === "filed" ? "Filed" : "Not Filed");

export function GstReturnsView() {
  const [data, setData, ready] = useStoredJson(GST_KEY, EMPTY_GST);
  const [month, setMonth] = React.useState(currentMonth);
  const [query, setQuery] = React.useState("");
  const valueOf = React.useCallback(
    (c, key) => {
      const s = statusOf(data.status, month, c.id);
      if (key === "g1" || key === "g3b") return filedLabel(s[key]);
      if (key === "assigned" || key === "remarks") return s[key];
      return String(c[key] ?? "");
    },
    [data.status, month],
  );
  const table = useColumnFilters(valueOf);
  const helper = useGstHelper(setData);
  const [installOpen, setInstallOpen] = React.useState(false);

  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const listed = data.clients.filter((c) => activeIn(c, month)).map((c, i) => ({ ...c, sno: i + 1 }));

  /** Starts the free check: the GST Helper extension walks through every client on Search Taxpayer. */
  function checkAll() {
    if (!helper.present) return setInstallOpen(true);
    const clients = listed
      .filter((c) => GSTIN_RE.test(c.gstin))
      .map((c) => ({ id: c.id, gstin: c.gstin, name: c.name }));
    const skipped = listed.length - clients.length;
    if (clients.length === 0) return toast.error("No client this month has a valid GSTIN to check.");
    helper.start(month, clients);
    toast.success(
      `Checking ${clients.length} clients for ${monthLabel(month)} in a new tab${skipped ? ` (${skipped} without a valid GSTIN skipped)` : ""}. Type each captcha there.`,
    );
  }
  const rows = table.apply(
    listed.filter((c) => matches(words, RETURN_COLS.map((col) => valueOf(c, col.key)).join(" "))),
  );

  const set = (id, field, value) => setData((d) => withStatus(d, month, id, field, value));
  /** A client detail typed here changes it in the Client Register too. */
  const setClient = (id, field, value) =>
    setData((d) => ({
      ...d,
      clients: d.clients.map((x) =>
        x.id === id ? { ...x, [field]: field === "gstin" ? normaliseGstin(value) : value } : x,
      ),
    }));
  /** A block pasted from Excel fills the cells from where it lands (rows already listed only). */
  function pasteGrid(block, r, c) {
    const targetIds = rows.map((x) => x.id);
    let filled = 0;
    setData((d) => {
      let next = d;
      block.forEach((cells, i) => {
        const id = targetIds[r + i];
        if (!id) return;
        filled++;
        cells.forEach((v, j) => {
          const col = RETURN_COLS[c + j];
          if (!col) return;
          if (col.client) {
            next = {
              ...next,
              clients: next.clients.map((x) =>
                x.id === id ? { ...x, [col.key]: col.key === "gstin" ? normaliseGstin(v) : v } : x,
              ),
            };
          } else next = withStatus(next, month, id, col.key, col.status ? pastedFiled(v) : v);
        });
      });
      return next;
    });
    toast.success(`Pasted into ${Math.min(block.length, targetIds.length - r)} row(s)`);
  }

  function clearMonth() {
    if (!window.confirm(`Set every client back to Not Filed for ${monthLabel(month)}?`)) return;
    setData((d) => {
      const status = { ...d.status };
      delete status[month];
      return { ...d, status };
    });
  }
  async function exportExcel() {
    const { downloadTableXlsx } = await import("@/lib/simple-xlsx");
    await downloadTableXlsx({
      header: ["S.No", "Business name", "Signatory", "GSTIN", "Month", "GSTR-1", "GSTR-3B", "Assigned To", "Remarks"],
      rows: rows.map((c) => [
        c.sno,
        c.name,
        c.signatory,
        c.gstin,
        monthLabel(month),
        valueOf(c, "g1"),
        valueOf(c, "g3b"),
        valueOf(c, "assigned"),
        valueOf(c, "remarks"),
      ]),
      sheet: `GST status ${month}`,
      fileName: `cacompliancetool-gst-status-${month}.xlsx`,
      widths: [6, 30, 24, 18, 14, 11, 11, 18, 30],
    });
  }

  if (!ready) return <div className="h-64 animate-pulse rounded-3xl border bg-muted/30" aria-hidden />;

  return (
    <div className="space-y-6">
      <GstTop
        title="Return Filing Status"
        data={data}
        month={month}
        onShift={(n) => setMonth((m) => shiftMonth(m, n))}
      />

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          Month
          <input
            type="month"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            className="h-9 rounded-full border bg-background px-3 text-sm"
          />
        </label>
        <Button size="sm" onClick={checkAll} disabled={listed.length === 0}>
          <Play className="size-3.5" aria-hidden /> Check all (free)
        </Button>
        <Button variant="outline" size="sm" onClick={clearMonth}>
          Clear month
        </Button>
        <Tip label="Download as Excel">
          <Button
            variant="outline"
            size="icon"
            onClick={() => void exportExcel()}
            disabled={rows.length === 0}
            aria-label="Download as Excel"
          >
            <Download className="size-4" aria-hidden />
          </Button>
        </Tip>
        <span className="flex-1" />
        {table.any || query ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              table.clear();
              setQuery("");
            }}
          >
            <X className="size-3.5" aria-hidden /> Clear all filters
          </Button>
        ) : null}
        <SearchBox value={query} onChange={setQuery} />
      </div>

      <Sheet onPasteGrid={pasteGrid} minWidth={64 + 150 + RETURN_COLS.reduce((n, c) => n + c.width, 0)}>
        <colgroup>
          <col style={{ width: 64 }} />
          {RETURN_COLS.map((col) => (
            <col key={col.key} style={{ width: col.width }} />
          ))}
          <col style={{ width: 150 }} />
        </colgroup>
        <thead>
          <tr>
            <SheetHead sno>S.No</SheetHead>
            {RETURN_COLS.map((col) => (
              <SheetHead key={col.key} filter={table.propsFor(col.key, col.label, listed)}>
                {col.label}
              </SheetHead>
            ))}
            <SheetHead />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <SheetCell colSpan={RETURN_COLS.length + 2} className="py-10 text-center text-muted-foreground">
                {listed.length === 0 ? "No active clients for this month." : "No clients match these filters."}
              </SheetCell>
            </tr>
          ) : (
            rows.map((c, r) => {
              const s = statusOf(data.status, month, c.id);
              return (
                <tr key={c.id}>
                  <SheetCell sno>{c.sno}</SheetCell>
                  {RETURN_COLS.map((col, ci) => (
                    <SheetCell key={col.key}>
                      {col.status ? (
                        <select
                          data-r={r}
                          data-c={ci}
                          value={s[col.key]}
                          onChange={(e) => set(c.id, col.key, e.target.value)}
                          aria-label={col.label}
                          className={cn(
                            SHEET_INPUT,
                            "cursor-pointer font-semibold",
                            s[col.key] === "filed"
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              : "bg-destructive/15 text-destructive",
                          )}
                        >
                          <option value="filed">Filed</option>
                          <option value="notfiled">Not Filed</option>
                        </select>
                      ) : (
                        <input
                          data-r={r}
                          data-c={ci}
                          value={col.client ? (c[col.key] ?? "") : s[col.key]}
                          onChange={(e) =>
                            col.client ? setClient(c.id, col.key, e.target.value) : set(c.id, col.key, e.target.value)
                          }
                          className={cn(
                            SHEET_INPUT,
                            col.key === "name" && "font-medium",
                            col.key === "gstin" && "font-mono uppercase",
                          )}
                          aria-label={col.label}
                        />
                      )}
                    </SheetCell>
                  ))}
                  <SheetCell className="px-2">
                    <PortalLink onOpen={() => portalOpen(helper, c)}>Login</PortalLink>
                  </SheetCell>
                </tr>
              );
            })
          )}
        </tbody>
      </Sheet>
      <InstallHelperDialog open={installOpen} onOpenChange={setInstallOpen} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The GST Helper extension (free status check on Search Taxpayer)     */
/* ------------------------------------------------------------------ */

/**
 * Talks to the GST Helper extension through window messages: whether it is
 * installed, starting a check, and taking in the results it reads (each one
 * acknowledged, so it is applied once).
 */
function useGstHelper(setData) {
  // The extension's version once it answers; null while it has not (not added, or this page loaded before it).
  const [version, setVersion] = React.useState(null);

  React.useEffect(() => {
    const origin = window.location.origin;
    function onMessage(e) {
      if (e.source !== window || e.origin !== origin || !e.data || typeof e.data !== "object") return;
      if (e.data.type === "cact-gst-pong") setVersion(typeof e.data.version === "string" ? e.data.version : "1.0");
      if (e.data.type === "cact-gst-results" && Array.isArray(e.data.results)) {
        const results = e.data.results.filter(
          (r) =>
            typeof r?.key === "string" &&
            typeof r.clientId === "string" &&
            /^\d{4}-\d{2}$/.test(r.month) &&
            ["filed", "notfiled"].includes(r.g1) &&
            ["filed", "notfiled"].includes(r.g3b),
        );
        if (results.length === 0) return;
        setData((d) =>
          results.reduce(
            (acc, r) =>
              acc.clients.some((c) => c.id === r.clientId)
                ? withStatus(withStatus(acc, r.month, r.clientId, "g1", r.g1), r.month, r.clientId, "g3b", r.g3b)
                : acc,
            d,
          ),
        );
        window.postMessage({ type: "cact-gst-ack", keys: results.map((r) => r.key) }, origin);
        toast.success(`GST Helper updated ${results.length} client${results.length === 1 ? "" : "s"}`);
      }
    }
    window.addEventListener("message", onMessage);
    window.postMessage({ type: "cact-gst-ping" }, origin);
    window.postMessage({ type: "cact-gst-ready" }, origin);
    return () => window.removeEventListener("message", onMessage);
  }, [setData]);

  const start = React.useCallback((month, clients) => {
    window.postMessage({ type: "cact-gst-start", month, clients }, window.location.origin);
  }, []);
  /** Opens the GST login page with this user name and password filled in by the extension. */
  const login = React.useCallback((user, pass) => {
    window.postMessage({ type: "cact-gst-login", user, pass }, window.location.origin);
  }, []);

  const present = version !== null;
  // Autofill needs 1.2 or later.
  const outdated = present && Number(version.split(".")[1] ?? 0) < 2 && version.startsWith("1.");
  return { present, version, outdated, start, login };
}

/**
 * As a GST login link is clicked: passes the client's user name and password
 * to the GST Helper to fill in, or says why it cannot (and copies the
 * password, when `copy` is given, so it can be pasted).
 */
function portalOpen(helper, c, copy) {
  const who = c.name || c.user || "this client";
  const fallback = (why) =>
    copy
      ? void copy(c).then((copied) =>
          toast.info(`${why}${copied ? " The password is copied: paste it on the login page." : ""}`),
        )
      : toast.info(why);
  if (!c.user) return fallback(`Add ${who}'s User name in the Client Register to fill the login automatically.`);
  if (!helper.present) return fallback("The GST Helper is not connected, so the login can't be filled in.");
  if (helper.outdated)
    return fallback(`Your GST Helper (${helper.version}) is out of date. Reload it in chrome://extensions.`);
  helper.login(c.user, c.pass ?? "");
  toast.success(`Opening the GST login for ${who}. Type the captcha there.`);
}

/** Whether the GST Helper is connected, beside the register's buttons. */
function HelperStatus({ helper, onSetUp }) {
  if (!helper.present) {
    return (
      <Button variant="ghost" size="sm" onClick={onSetUp}>
        Autofill the GST login: add GST Helper
      </Button>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        helper.outdated ? "border-amber-500/50 text-amber-500" : "border-emerald-500/40 text-emerald-500",
      )}
    >
      <span className={cn("size-1.5 rounded-full", helper.outdated ? "bg-amber-500" : "bg-emerald-500")} aria-hidden />
      {helper.outdated
        ? `GST Helper ${helper.version}: reload it to autofill`
        : `GST Helper ${helper.version} connected`}
    </span>
  );
}

function InstallHelperDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">Add the free GST Helper to Chrome</DialogTitle>
          <DialogDescription>
            It fills each client&apos;s user name and password on the GST login page when you click Open Portal or
            Login, and for Check all it opens the public Search Taxpayer page for each client and fills the GSTIN. You
            type the captchas; it reads GSTR-1 and GSTR-3B from the filing table and brings them back here.
          </DialogDescription>
        </DialogHeader>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>
            <a
              href="/downloads/gst-helper.zip"
              download
              className="font-medium text-primary underline underline-offset-4"
            >
              Download the GST Helper (.zip)
            </a>{" "}
            and unzip it.
          </li>
          <li>
            In Chrome, open <code className="rounded bg-muted px-1">chrome://extensions</code> and turn on{" "}
            <b>Developer mode</b> (top right).
          </li>
          <li>
            Click <b>Load unpacked</b> and choose the unzipped <b>gst-helper</b> folder.
          </li>
          <li>Reload this page. Already added an older copy? Click its reload button in chrome://extensions.</li>
        </ol>
        <p className="text-sm text-muted-foreground">
          Step-by-step help, updates and troubleshooting:{" "}
          <a href="/gst/guide" className="font-medium text-primary underline underline-offset-4">
            GST Helper Guide
          </a>
          .
        </p>
      </DialogContent>
    </Dialog>
  );
}
