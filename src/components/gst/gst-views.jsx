"use client";

import * as React from "react";
import { toast } from "sonner";
import { Download, ExternalLink, FolderOpen, Plus, Search, Trash2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tip } from "@/components/shared/tip";
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

function openPortal() {
  window.open(GST_LOGIN_URL, "_blank", "noopener,noreferrer");
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

  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const numbered = data.clients.map((c, i) => ({ ...c, sno: i + 1 }));
  const rows = table.apply(
    numbered.filter((c) => matches(words, REGISTER_COLS.map((col) => valueOf(c, col.key)).join(" "))),
  );

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
      toast.success(`Imported ${incoming.clients.length} GST clients (passwords are not imported)`);
    } catch {
      toast.error("That file could not be read. Choose a GST Register backup (.json).");
    }
  }
  async function exportExcel() {
    const { downloadTableXlsx } = await import("@/lib/simple-xlsx");
    await downloadTableXlsx({
      header: ["S.No", ...REGISTER_COLS.map((c) => c.label)],
      rows: rows.map((c) => [c.sno, ...REGISTER_COLS.map((col) => valueOf(c, col.key))]),
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
                  filter={table.propsFor(col.key, col.label, numbered)}
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
                      <Button size="sm" variant="outline" onClick={openPortal}>
                        <ExternalLink className="size-3.5" aria-hidden /> Open Portal
                      </Button>
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
        Open Portal opens the GST login page; sign in with the client&apos;s user name and password there. Portal
        passwords are not saved in {site.name}. After a client&apos;s deactivate date, later months no longer
        list it.
      </p>
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

  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const listed = data.clients.filter((c) => activeIn(c, month)).map((c, i) => ({ ...c, sno: i + 1 }));
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
                      <Button size="sm" variant="outline" onClick={openPortal}>
                        <ExternalLink className="size-3.5" aria-hidden /> Login
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
