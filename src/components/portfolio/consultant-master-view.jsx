"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Building2, Contact, Download, Eye, Loader2, Pencil, Plus, Trash2, UserX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tip } from "@/components/shared/tip";
import { ExcelIcon, PdfIcon } from "@/components/shared/file-type-icon";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { StatCard, StatCardGrid } from "@/components/shared/stat-card";
import { usePortfolio, useScopedClients } from "@/components/portfolio/portfolio-provider";
import { ScopeNote } from "@/components/portfolio/scope-note";
import { ConsultantFormDialog } from "@/components/portfolio/consultant-form-dialog";
import { StatusPill } from "@/components/portfolio/status-pill";
import { initials, typeLabel } from "@/lib/portfolio/clients";
import { clientsForConsultant } from "@/lib/portfolio/consultants";
import { buildDuesRows } from "@/lib/portfolio/dues-table";
import { buildFilingMatrix } from "@/lib/portfolio/filing-matrix";
import { financialYearLabel, today } from "@/lib/dates";
import { selectableYears } from "@/lib/portfolio/schedule";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMobile } from "@/lib/portfolio/mobile";
/**
 * The consultant master: every consultant once, with the companies that name
 * them as their reference. Companies pick from this list in their profile.
 */
export function ConsultantMasterView() {
  const { ready, consultants: allConsultants, directors, removeConsultant, setActiveClient } = usePortfolio();
  // Only the active company (and its consultant) when one is selected.
  const { clients, activeClient } = useScopedClients();
  const consultants = React.useMemo(
    () => (activeClient ? allConsultants.filter((c) => c.id === activeClient.consultantId) : allConsultants),
    [allConsultants, activeClient],
  );
  // The consultant whose filings report is being built, while it downloads.
  const [downloading, setDownloading] = React.useState(null);
  // The financial year the reports cover: null is the current window.
  const years = React.useMemo(() => selectableYears(null, today()), []);
  const [fy, setFy] = React.useState(null);
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  // The consultant whose companies are listed in the dialog.
  const [viewing, setViewing] = React.useState(null);

  const rows = React.useMemo(
    () => consultants.map((c) => ({ consultant: c, companies: clientsForConsultant(c.id, clients) })),
    [consultants, clients],
  );
  const withReference = clients.filter((c) => c.consultantId).length;
  const withoutReference = clients.length - withReference;

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(c) {
    setEditing(c);
    setFormOpen(true);
  }
  /**
   * The filings report for every company under one consultant: the same
   * filing-status sheet as the dashboard, for those companies only.
   */
  async function downloadReport(c, kind) {
    const companies = clientsForConsultant(c.id, clients);
    if (companies.length === 0) {
      toast.info(`No companies are under ${c.name} yet.`);
      return;
    }
    setDownloading(c.id);
    try {
      const { downloadDuesXlsx, downloadMatrixPdf } = await import("@/lib/portfolio/dues-export");
      const asOf = today();
      const rows = buildDuesRows(companies, directors, asOf, { filingsOnly: true, fyEndingYear: fy });
      const matrix = buildFilingMatrix(rows, companies);
      const meta = {
        asOf,
        scope: `Consultant: ${c.name} (${formatMobile(c.mobile)}) · ${companies.length} ${companies.length === 1 ? "company" : "companies"} · ${fy === null ? "Current" : financialYearLabel(fy)}`,
        fileTag: c.name,
      };
      if (kind === "pdf") await downloadMatrixPdf(matrix, meta);
      else await downloadDuesXlsx(rows, meta, matrix);
      toast.success(
        `Filings report for ${c.name} (${fy === null ? "current" : financialYearLabel(fy)}) downloaded as ${kind === "pdf" ? "PDF" : "Excel"}`,
      );
    } catch (error) {
      console.error("Consultant report failed", error);
      toast.error("The report could not be created. Try again.");
    } finally {
      setDownloading(null);
    }
  }

  /** Opens that company's dashboard. */
  async function openCompany(id) {
    await setActiveClient(id);
    router.push("/dashboard");
  }

  async function onDelete(c, companies) {
    const also =
      companies > 0 ? ` ${companies} ${companies === 1 ? "company" : "companies"} will be left with no reference.` : "";
    if (!window.confirm(`Remove ${c.name} from the consultant master?${also}`)) return;
    await removeConsultant(c.id);
    toast.success(`${c.name} removed`);
  }

  if (!ready) {
    return <div className="h-64 animate-pulse rounded-lg border bg-muted/30" aria-hidden />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Contact}
        eyebrow="Consultant Master"
        badge="NEW"
        title="Consultant Files"
        lede="Every consultant once, with the companies that name them as their reference. Pick a consultant in a company's profile under Reference."
        action={
          <div className="flex items-center gap-2">
            <Select
              value={fy === null ? "current" : String(fy)}
              onValueChange={(v) => setFy(v === "current" ? null : Number(v))}
            >
              <Tip label="Financial year for the filings reports">
                <SelectTrigger className="w-40" aria-label="Financial year for the filings reports">
                  <SelectValue />
                </SelectTrigger>
              </Tip>
              <SelectContent>
                <SelectItem value="current">Current</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {financialYearLabel(y)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Tip label="Add consultant">
              <Button size="icon" onClick={openAdd} aria-label="Add consultant">
                <Plus className="size-4" aria-hidden />
              </Button>
            </Tip>
          </div>
        }
      />

      <ScopeNote />

      <StatCardGrid>
        <StatCard icon={Contact} value={consultants.length} label="Consultants" />
        <StatCard icon={Building2} value={withReference} label="Companies with a reference" />
        <StatCard
          icon={UserX}
          value={withoutReference}
          label="Companies without one"
          tone={withoutReference > 0 && consultants.length > 0 ? "warn" : "neutral"}
        />
      </StatCardGrid>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          {activeClient ? (
            <>
              <p className="font-heading text-lg">No consultant for {activeClient.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add one on the Consultant step of the company&apos;s form in Company Master Data.
              </p>
            </>
          ) : (
            <>
              <p className="font-heading text-lg">No consultants yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                <button type="button" onClick={openAdd} className="underline underline-offset-4">
                  Add a consultant
                </button>{" "}
                with their name and mobile number, then pick them in a company&apos;s profile.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Consultant</TableHead>
                <TableHead>Mobile number</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Companies</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ consultant: c, companies }) => (
                <TableRow key={c.id}>
                  <TableCell className="align-top">
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[11px] font-bold text-muted-foreground">
                        {initials(c.name)}
                      </span>
                      <span>
                        <span className="block font-medium">{c.name}</span>
                        {c.firm ? <span className="block text-xs text-muted-foreground">{c.firm}</span> : null}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <a href={`tel:+91${c.mobile}`} className="tabular text-sm hover:text-primary hover:underline">
                      {formatMobile(c.mobile)}
                    </a>
                  </TableCell>
                  <TableCell className="align-top text-sm">
                    {c.email ? (
                      <a href={`mailto:${c.email}`} className="hover:text-primary hover:underline">
                        {c.email}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    {companies.length === 0 ? (
                      <span className="text-sm text-muted-foreground">0 companies</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setViewing(c)}
                        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-medium transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary"
                        title={`See the companies under ${c.name}`}
                      >
                        <Building2 className="size-3.5" aria-hidden />
                        <span className="tabular">{companies.length}</span>
                        {companies.length === 1 ? "company" : "companies"}
                        <Eye className="size-3.5 opacity-70" aria-hidden />
                      </button>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex items-center justify-end gap-1">
                      <DropdownMenu>
                        <Tip label="Download filings report">
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7"
                              disabled={downloading !== null || companies.length === 0}
                              aria-label={`Download the filings report for ${c.name}`}
                            >
                              {downloading === c.id ? (
                                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                              ) : (
                                <Download className="size-3.5" aria-hidden />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                        </Tip>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                            Filings report · {fy === null ? "Current" : financialYearLabel(fy)} · {companies.length}{" "}
                            {companies.length === 1 ? "company" : "companies"}
                          </DropdownMenuLabel>
                          <DropdownMenuItem onSelect={() => downloadReport(c, "pdf")}>
                            <PdfIcon className="size-4" /> PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => downloadReport(c, "xlsx")}>
                            <ExcelIcon className="size-4" /> Excel (.xlsx)
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button size="icon" variant="ghost" className="size-7" onClick={() => openEdit(c)}>
                        <Pencil className="size-3.5" aria-hidden />
                        <span className="sr-only">Edit {c.name}</span>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-destructive hover:text-destructive"
                        onClick={() => onDelete(c, companies.length)}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                        <span className="sr-only">Remove {c.name}</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ConsultantFormDialog open={formOpen} onOpenChange={setFormOpen} consultant={editing} />

      <Dialog open={viewing !== null} onOpenChange={(open) => (open ? null : setViewing(null))}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {viewing ? (
            <ReferenceCompanies
              consultant={viewing}
              companies={clientsForConsultant(viewing.id, clients)}
              onOpenCompany={(id) => {
                setViewing(null);
                void openCompany(id);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** The companies that name one consultant as their reference. */
function ReferenceCompanies({ consultant, companies, onOpenCompany }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-heading text-lg">
          {companies.length} {companies.length === 1 ? "company" : "companies"} under {consultant.name}
        </DialogTitle>
        <DialogDescription>
          Reference mobile {formatMobile(consultant.mobile)}
          {consultant.firm ? ` · ${consultant.firm}` : ""}
        </DialogDescription>
      </DialogHeader>
      {companies.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          No company names this consultant as its reference yet.
        </p>
      ) : (
        <ol className="divide-y rounded-md border">
          {companies.map((co, i) => (
            <li key={co.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <span className="tabular w-5 shrink-0 text-right text-xs text-muted-foreground">{i + 1}.</span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">{co.name}</span>
                  <StatusPill status={co.status} />
                </span>
                <span className="block font-mono text-[11px] text-muted-foreground">
                  {co.cin} · {typeLabel(co.type)}
                  {co.mobile ? <span className="font-sans"> · {formatMobile(co.mobile)}</span> : null}
                </span>
              </span>
              <Tip label="Open this company">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => onOpenCompany(co.id)}
                  aria-label={`Open ${co.name}`}
                >
                  <ArrowRight className="size-3.5" aria-hidden />
                </Button>
              </Tip>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
