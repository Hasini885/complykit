"use client";

import * as React from "react";
import { toast } from "sonner";
import { Copy, Download, ExternalLink, FolderOpen, Play, Plus, Search, Trash2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tip } from "@/components/shared/tip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ColumnFilter, useColumnFilters } from "@/components/shared/column-filter";
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

const CELL_INPUT =
  "h-8 w-full min-w-0 rounded-md bg-transparent px-2 text-sm outline-none focus:bg-background focus:ring-2 focus:ring-ring/40";
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
    <div className="space-y-6">
      <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-[3.25rem] sm:leading-[1.05]">{title}</h1>
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-primary/25 p-6 text-center">
          <h2 className="font-heading text-lg font-semibold">Return summary — {monthLabel(month)}</h2>
          <div className="mt-4 flex gap-10">
            <Num value={sum.total} label="Clients" />
            <Num value={sum.notFiled} label="Not filed" className="text-destructive" />
            <Num value={sum.filed} label="Filed" className="text-emerald-500" />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Filed means both GSTR-1 and GSTR-3B are filed for the month.</p>
        </div>
        <MiniCalendar
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
    </div>
  );
}

function Num({ value, label, className }) {
  return (
    <div>
      <b className={cn("block font-heading text-3xl", className)}>{value}</b>
      <small className="text-[10.5px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{label}</small>
    </div>
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
        className="h-9 w-64 rounded-full border bg-background pr-3 pl-8 text-sm outline-none focus:ring-2 focus:ring-ring/40"
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

function Head({ children, filter, req, className }) {
  return (
    <TableHead className={cn("whitespace-nowrap", className)}>
      <span className="flex items-center justify-between gap-1">
        <span>
          {children}
          {req ? <span className="text-destructive"> *</span> : null}
        </span>
        {filter ? <ColumnFilter {...filter} /> : null}
      </span>
    </TableHead>
  );
}

/* ------------------------------------------------------------------ */
/* Client register                                                     */
/* ------------------------------------------------------------------ */

const REGISTER_COLS = [
  { key: "name", label: "Business name", width: "min-w-48" },
  { key: "signatory", label: "Signatory / Proprietor", width: "min-w-44" },
  { key: "email", label: "Email ID", width: "min-w-48" },
  { key: "mobile", label: "Mobile Number", width: "min-w-32" },
  { key: "gstin", label: "GSTIN", width: "min-w-44", req: true },
  { key: "user", label: "User name", width: "min-w-36" },
  // Hidden until "Show passwords" is ticked; left out of search, filters and downloads.
  { key: "pass", label: "Password", width: "min-w-40", secret: true },
  { key: "reg", label: "Registration date", width: "min-w-36", date: true },
  { key: "deact", label: "Deactivate date", width: "min-w-36", date: true },
  { key: "folder", label: "Folder path", width: "min-w-56" },
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
      clients: d.clients.map((c) => (c.id === id ? { ...c, [field]: field === "gstin" ? normaliseGstin(value) : value } : c)),
    }));
  }
  function addClient() {
    table.clear();
    setQuery("");
    setData((d) => ({ ...d, clients: [...d.clients, newGstClient(newId())] }));
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
      <GstTop title="GST Client Register" data={data} month={month} onShift={(n) => setMonth((m) => shiftMonth(m, n))} />

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

      <div className="overflow-x-auto rounded-3xl border-2 border-dashed border-primary/25">
        <Table>
          <TableHeader>
            <TableRow>
              <Head className="w-14">S.No</Head>
              {REGISTER_COLS.map((col) => (
                <Head
                  key={col.key}
                  req={col.req}
                  className={col.width}
                  filter={col.secret ? undefined : table.propsFor(col.key, col.label, numbered)}
                >
                  {col.label}
                </Head>
              ))}
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={REGISTER_COLS.length + 2} className="py-10 text-center text-muted-foreground">
                  {data.clients.length === 0 ? "No clients yet. Click Add client." : "No clients match these filters."}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((c) => {
                const dead = c.deact && c.deact <= isoToday();
                return (
                  <TableRow key={c.id} className={dead ? "opacity-50" : undefined}>
                    <TableCell className="tabular text-muted-foreground">{c.sno}</TableCell>
                    {REGISTER_COLS.map((col) => (
                      <TableCell key={col.key} className="p-1">
                        {col.key === "folder" ? (
                          <span className="flex items-center gap-1">
                            <input
                              value={c.folder}
                              onChange={(e) => setField(c.id, "folder", e.target.value)}
                              placeholder="e.g. D:\Clients\ABC"
                              className={CELL_INPUT}
                            />
                            <Tip label="Open in File Explorer (needs the folder opener on this computer)">
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => openFolder(c)}
                                aria-label="Open folder"
                              >
                                <FolderOpen className="size-3.5" aria-hidden />
                              </Button>
                            </Tip>
                          </span>
                        ) : col.secret ? (
                          <span className="flex items-center gap-1">
                            <input
                              type={showPw ? "text" : "password"}
                              autoComplete="new-password"
                              value={c.pass ?? ""}
                              onChange={(e) => setField(c.id, "pass", e.target.value)}
                              className={cn(CELL_INPUT, "font-mono")}
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
                                <Copy className="size-3.5" aria-hidden />
                              </Button>
                            </Tip>
                          </span>
                        ) : (
                          <input
                            type={col.date ? "date" : col.key === "mobile" ? "tel" : "text"}
                            inputMode={col.key === "email" ? "email" : undefined}
                            maxLength={col.key === "gstin" || col.key === "mobile" ? 15 : undefined}
                            value={c[col.key] ?? ""}
                            onChange={(e) => setField(c.id, col.key, e.target.value)}
                            className={cn(
                              CELL_INPUT,
                              col.key === "gstin" && "font-mono uppercase",
                              col.key === "gstin" && c.gstin && !GSTIN_RE.test(c.gstin) && "text-destructive",
                            )}
                            aria-label={col.label}
                          />
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="p-1 whitespace-nowrap">
                      <PortalLink onOpen={() => onPortalOpen(c)}>Open Portal</PortalLink>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="ml-1 text-destructive hover:text-destructive"
                        onClick={() => remove(c)}
                        aria-label={`Delete ${c.name || "client"}`}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Open Portal opens the GST login page with the client&apos;s user name and password filled in (with the GST
        Helper added to Chrome; without it, the password is copied ready to paste). Passwords are saved
        privately with your {site.name} account, stay hidden until you tick Show passwords, and are never included
        in downloads. After a client&apos;s deactivate date, later months no longer list it.
      </p>
      <InstallHelperDialog open={installOpen} onOpenChange={setInstallOpen} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Return filing status                                                */
/* ------------------------------------------------------------------ */

const RETURN_COLS = [
  { key: "name", label: "Business name" },
  { key: "signatory", label: "Signatory / Proprietor" },
  { key: "assigned", label: "Assigned To" },
  { key: "gstin", label: "GSTIN" },
  { key: "user", label: "User name" },
  { key: "g1", label: "GSTR-1" },
  { key: "g3b", label: "GSTR-3B" },
  { key: "remarks", label: "Remarks" },
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
  const rows = table.apply(listed.filter((c) => matches(words, RETURN_COLS.map((col) => valueOf(c, col.key)).join(" "))));

  const set = (id, field, value) => setData((d) => withStatus(d, month, id, field, value));

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

      <div className="overflow-x-auto rounded-3xl border-2 border-dashed border-primary/25">
        <Table>
          <TableHeader>
            <TableRow>
              <Head className="w-14">S.No</Head>
              {RETURN_COLS.map((col) => (
                <Head key={col.key} filter={table.propsFor(col.key, col.label, listed)}>
                  {col.label}
                </Head>
              ))}
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={RETURN_COLS.length + 2} className="py-10 text-center text-muted-foreground">
                  {listed.length === 0 ? "No active clients for this month." : "No clients match these filters."}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((c) => {
                const s = statusOf(data.status, month, c.id);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="tabular text-muted-foreground">{c.sno}</TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.signatory}</TableCell>
                    <TableCell className="min-w-36 p-1">
                      <input
                        value={s.assigned}
                        onChange={(e) => set(c.id, "assigned", e.target.value)}
                        className={CELL_INPUT}
                        aria-label="Assigned to"
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{c.gstin}</TableCell>
                    <TableCell>{c.user}</TableCell>
                    {["g1", "g3b"].map((r) => (
                      <TableCell key={r} className="p-1">
                        <select
                          value={s[r]}
                          onChange={(e) => set(c.id, r, e.target.value)}
                          aria-label={r === "g1" ? "GSTR-1" : "GSTR-3B"}
                          className={cn(
                            "h-8 rounded-md px-2 text-sm font-semibold",
                            s[r] === "filed"
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              : "bg-destructive/15 text-destructive",
                          )}
                        >
                          <option value="filed">Filed</option>
                          <option value="notfiled">Not Filed</option>
                        </select>
                      </TableCell>
                    ))}
                    <TableCell className="min-w-48 p-1">
                      <input
                        value={s.remarks}
                        onChange={(e) => set(c.id, "remarks", e.target.value)}
                        className={CELL_INPUT}
                        aria-label="Remarks"
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <PortalLink onOpen={() => portalOpen(helper, c)}>Login</PortalLink>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
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
      ? void copy(c).then((copied) => toast.info(`${why}${copied ? " The password is copied: paste it on the login page." : ""}`))
      : toast.info(why);
  if (!c.user) return fallback(`Add ${who}'s User name in the Client Register to fill the login automatically.`);
  if (!helper.present) return fallback("The GST Helper is not connected, so the login can't be filled in.");
  if (helper.outdated) return fallback(`Your GST Helper (${helper.version}) is out of date. Reload it in chrome://extensions.`);
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
      {helper.outdated ? `GST Helper ${helper.version}: reload it to autofill` : `GST Helper ${helper.version} connected`}
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
            <a href="/downloads/gst-helper.zip" download className="font-medium text-primary underline underline-offset-4">
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
      </DialogContent>
    </Dialog>
  );
}
