"use client";

import * as React from "react";
import { toast } from "sonner";
import { GripVertical, LayoutGrid, Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tip } from "@/components/shared/tip";
import { ExcelIcon, PdfIcon } from "@/components/shared/file-type-icon";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { usePortfolio, useScopedClients } from "@/components/portfolio/portfolio-provider";
import { ScopeNote } from "@/components/portfolio/scope-note";
import { ClientFormDialog } from "@/components/portfolio/client-form-dialog";
import { today } from "@/lib/dates";
import { moveClientId } from "@/lib/portfolio/clients";
import { directorColumnCount, masterDataRows } from "@/lib/portfolio/master-data";
export function ClientPortfolioView() {
  const { ready, directors, consultants, activeClientId, reorderClients } = usePortfolio();
  // Only the active company when one is selected; every company otherwise.
  const { clients } = useScopedClients();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [exporting, setExporting] = React.useState(null);

  const reference = React.useMemo(() => today(), []);
  // Every company, one row each: the same rows as the downloads.
  const rows = React.useMemo(
    () => masterDataRows(clients, directors, consultants, reference),
    [clients, directors, consultants, reference],
  );

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(client) {
    setEditing(client);
    setFormOpen(true);
  }

  /** Every company's master data, as PDF or Excel. */
  async function exportMasterData(kind) {
    if (clients.length === 0) {
      toast.info("No companies to export");
      return;
    }
    const label = kind === "pdf" ? "PDF" : "Excel";
    setExporting(kind);
    try {
      const { downloadMasterData } = await import("@/lib/portfolio/master-data");
      await downloadMasterData(kind, masterDataRows(clients, directors, consultants, reference), reference);
      toast.success(
        `Downloaded the master data of ${clients.length} ${clients.length === 1 ? "company" : "companies"} as ${label}`,
      );
    } catch (error) {
      console.error(`${label} export failed`, error);
      toast.error(`The ${label} file could not be created. Try again.`);
    } finally {
      setExporting(null);
    }
  }

  if (!ready) {
    return <div className="h-64 animate-pulse rounded-lg border bg-muted/30" aria-hidden />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LayoutGrid}
        eyebrow="Company Master Data"
        badge="NEW"
        title="All Your Companies, One Cockpit"
        lede="Manage unlimited companies and clients — each with its own personalised due dates, tracking and compliance health. Built for practising CAs and CSs."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Tip label="Add company">
              <Button size="icon" onClick={openAdd} aria-label="Add company">
                <Plus className="size-4" aria-hidden />
              </Button>
            </Tip>
          </div>
        }
      />

      <ScopeNote />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">
            {clients.length} {clients.length === 1 ? "company" : "companies"}
          </p>

          <div className="flex flex-wrap gap-1.5">
            <Tip label="Download company master data (PDF)">
              <Button
                size="icon-sm"
                variant="outline"
                className="size-9"
                onClick={() => exportMasterData("pdf")}
                disabled={clients.length === 0 || exporting !== null}
                aria-label="Download company master data as PDF"
              >
                {exporting === "pdf" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <PdfIcon />}
              </Button>
            </Tip>
            <Tip label="Download company master data (Excel)">
              <Button
                size="icon-sm"
                variant="outline"
                className="size-9"
                onClick={() => exportMasterData("xlsx")}
                disabled={clients.length === 0 || exporting !== null}
                aria-label="Download company master data as Excel"
              >
                {exporting === "xlsx" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ExcelIcon />}
              </Button>
            </Tip>
          </div>
        </div>

        <ClientTable
          rows={rows}
          clients={clients}
          activeClientId={activeClientId}
          onEdit={openEdit}
          onAdd={openAdd}
          onReorder={reorderClients}
        />
      </div>

      <ClientFormDialog open={formOpen} onOpenChange={setFormOpen} client={editing} />
    </div>
  );
}

/**
 * One row per company, numbered. Drag a row by its handle and drop it between
 * any two others to set your own order; the dashboard and downloads follow it.
 */
function ClientTable({ rows, clients, activeClientId, onEdit, onAdd, onReorder }) {
  // The company being dragged, and the gap it would drop into (0 = above the first row).
  const [dragId, setDragId] = React.useState(null);
  const [dropAt, setDropAt] = React.useState(null);

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-16 text-center">
        <p className="font-heading text-lg">No companies here yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Nothing in this view.{" "}
          <button type="button" onClick={onAdd} className="underline underline-offset-4">
            Add a company
          </button>{" "}
          to get started.
        </p>
      </div>
    );
  }

  const byId = new Map(clients.map((c) => [c.id, c]));
  // Director 1, Director 2 (and more columns if any company has more directors).
  const directorSlots = Array.from({ length: directorColumnCount(rows) }, (_, i) => i);
  const none = <span className="text-muted-foreground">—</span>;
  const canDrag = rows.length > 1;

  function overRow(e, index) {
    if (dragId === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    // Upper half of a row: drop above it; lower half: below it.
    const box = e.currentTarget.getBoundingClientRect();
    setDropAt(e.clientY < box.top + box.height / 2 ? index : index + 1);
  }
  function endDrag() {
    setDragId(null);
    setDropAt(null);
  }
  function drop(e) {
    e.preventDefault();
    if (dragId !== null && dropAt !== null) {
      const ids = rows.map((r) => r.clientId);
      const next = moveClientId(ids, dragId, dropAt);
      if (next.some((id, i) => id !== ids[i])) {
        void onReorder(next).then(
          () => toast.success("Company order saved"),
          () => toast.error("The new order could not be saved. Try again."),
        );
      }
    }
    endDrag();
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14 pr-0">S.No.</TableHead>
            <TableHead>Company name</TableHead>
            <TableHead>CIN</TableHead>
            <TableHead>Mobile</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Consultant (reference)</TableHead>
            {directorSlots.map((i) => (
              <TableHead key={i}>Director {i + 1}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, index) => {
            const c = byId.get(r.clientId);
            if (!c) return null;
            const active = c.id === activeClientId;
            const line =
              dragId !== null && dropAt === index
                ? "shadow-[inset_0_2px_0_0_var(--primary)]"
                : dragId !== null && dropAt === index + 1 && index === rows.length - 1
                  ? "shadow-[inset_0_-2px_0_0_var(--primary)]"
                  : "";
            return (
              <TableRow
                key={r.clientId}
                draggable={canDrag}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", r.name);
                  setDragId(r.clientId);
                }}
                onDragOver={(e) => overRow(e, index)}
                onDrop={drop}
                onDragEnd={endDrag}
                className={cn(active && "bg-primary/5", dragId === r.clientId && "opacity-40", line)}
              >
                <TableCell className="pr-0 align-top">
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    {canDrag ? (
                      <GripVertical
                        className="size-4 shrink-0 cursor-grab opacity-50 active:cursor-grabbing"
                        aria-label="Drag to reorder"
                      />
                    ) : null}
                    <span className="tabular">{index + 1}</span>
                  </span>
                </TableCell>
                <TableCell className="align-top">
                  {/* Tapping the name opens the company's details to view or edit. */}
                  <button
                    type="button"
                    onClick={() => onEdit(c)}
                    className="text-left font-semibold text-primary hover:underline"
                    title={`Open ${c.name}`}
                  >
                    {r.name}
                  </button>
                  {active ? <span className="ml-1.5 text-[11px] font-medium text-primary">Active</span> : null}
                </TableCell>
                <TableCell className="tabular align-top text-sm">{r.cin}</TableCell>
                <TableCell className="tabular align-top text-sm whitespace-nowrap">{r.mobile || none}</TableCell>
                <TableCell className="align-top text-sm">{r.email || none}</TableCell>
                <TableCell className="align-top text-sm">
                  {r.consultantName ? (
                    <>
                      <span className="block font-medium">{r.consultantName}</span>
                      <span className="tabular block text-xs text-muted-foreground">{r.consultantMobile}</span>
                    </>
                  ) : (
                    none
                  )}
                </TableCell>
                {directorSlots.map((i) => {
                  const d = r.directors[i];
                  return (
                    <TableCell key={i} className="align-top text-sm">
                      {d ? (
                        <>
                          <span className="block whitespace-nowrap font-medium">{d.name}</span>
                          <span className="tabular block text-xs text-muted-foreground">DIN {d.din}</span>
                        </>
                      ) : (
                        none
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
