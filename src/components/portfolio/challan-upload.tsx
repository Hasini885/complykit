"use client";

import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Receipt, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tip } from "@/components/shared/tip";
import { AuditorYearsField } from "@/components/dashboard/auditor-years-field";
import { ClientFormDialog } from "@/components/portfolio/client-form-dialog";
import { usePortfolio } from "@/components/portfolio/portfolio-provider";
import {
  NOT_A_CHALLAN,
  bestChallanRow,
  challanCandidates,
  findChallanCompany,
  parseMcaChallan,
  type Challan,
} from "@/lib/challan";
import { financialYearLabel, formatDate, parseIsoDate, today } from "@/lib/dates";
import { formatInr } from "@/lib/fees";
import { draftFrom } from "@/lib/portfolio/clients";
import { appointmentCovering } from "@/lib/portfolio/auditor";
import { filingKey } from "@/lib/portfolio/filings";
import { buildPortfolioReport } from "@/lib/portfolio/report";
import { auditorTermOf } from "@/lib/portfolio/schedule";
import type { Client } from "@/lib/portfolio/types";
import type { ResolvedDueDate } from "@/lib/resolve-due-dates";

/**
 * Upload an MCA payment challan (G.A.R.7) and it updates the company's master
 * data (name, registered office) from it and marks the filing it paid for as
 * filed, with the SRN and the SRN date. Only G.A.R.7 receipts are accepted.
 */
export function ChallanUploadButton({
  className,
  variant = "icon",
}: {
  className?: string;
  /** "icon" for toolbars; "hero" for a large drop area with a big button. */
  variant?: "icon" | "hero";
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [reading, setReading] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  // Challans waiting to be reviewed, one at a time; `total` is for "2 of 5".
  const [queue, setQueue] = React.useState<Challan[]>([]);
  const [total, setTotal] = React.useState(0);
  const challan = queue[0] ?? null;

  /** Reads every PDF given; the challans among them are queued for review. */
  async function onFiles(list: FileList | File[] | null | undefined) {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    setReading(true);
    const found: Challan[] = [];
    const rejected: string[] = [];
    try {
      const { extractPdfLines } = await import("@/lib/pdf-text");
      for (const file of files) {
        if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
          rejected.push(file.name);
          continue;
        }
        try {
          const result = parseMcaChallan(await extractPdfLines(file));
          if (!result.ok) rejected.push(file.name);
          // The same challan twice in one batch is reviewed once.
          else if (!found.some((c) => c.srn === result.challan.srn)) found.push(result.challan);
        } catch {
          rejected.push(file.name);
        }
      }
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
    if (rejected.length > 0) {
      toast.error(
        files.length === 1 ? NOT_A_CHALLAN : `${rejected.length} of ${files.length} files are not MCA challans and were skipped`,
        files.length === 1 ? undefined : { description: rejected.slice(0, 5).join(", ") + (rejected.length > 5 ? "…" : "") },
      );
    }
    if (found.length > 0) {
      setQueue(found);
      setTotal(found.length);
    }
  }

  /** On to the next challan in the batch. */
  const next = () => setQueue((q) => q.slice(1));

  const drop = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      void onFiles(e.dataTransfer.files);
    },
  };

  const trigger =
    variant === "hero" ? (
      <section
        {...drop}
        aria-label="Upload MCA challan"
        className={`flex flex-col items-center rounded-3xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
          dragging ? "border-primary bg-primary/10" : "border-primary/25 bg-card/60"
        } ${className ?? ""}`}
      >
        <h2 className="font-heading text-2xl font-bold tracking-tight">Upload MCA challan</h2>
        <p className="mt-1.5 max-w-[52ch] text-sm text-muted-foreground">
          Mark a filing as filed with its SRN, straight from the MCA payment receipt.
        </p>
        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={reading}
          className="mt-4 h-12 w-full max-w-xs rounded-2xl text-base font-semibold shadow-md shadow-primary/25"
        >
          {reading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
          {reading ? "Reading challans…" : "Select challan PDFs"}
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">or drop one or more challan PDFs here</p>
      </section>
    ) : (
      <Tip label="Upload MCA challan (marks the filing and SRN)">
        <Button
          size="icon-sm"
          variant="outline"
          className={className ?? "size-9"}
          onClick={() => inputRef.current?.click()}
          disabled={reading}
          aria-label="Upload MCA challan"
        >
          {reading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Receipt className="size-4" aria-hidden />}
        </Button>
      </Tip>
    );

  return (
    <>
      {trigger}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
      <Dialog open={challan !== null} onOpenChange={(o) => !o && setQueue([])}>
        <DialogContent className="max-w-lg">
          {challan ? (
            <ChallanReview
              key={challan.srn}
              challan={challan}
              position={total > 1 ? { index: total - queue.length + 1, total } : null}
              onDone={next}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function rowLabel(item: ResolvedDueDate): string {
  const parts = [
    `${item.source.title}${item.source.formCode ? ` (${item.source.formCode})` : ""}`,
    financialYearLabel(item.fyEndingYear) + (item.qualifier ? `, ${item.qualifier}` : ""),
    `due ${formatDate(item.due!)}`,
  ];
  if (item.filedOn) parts.push(`filed${item.srn ? ` · ${item.srn}` : ""}`);
  return parts.join(" · ");
}

function ChallanReview({
  challan,
  position,
  onDone,
}: {
  challan: Challan;
  /** In a batch: which challan this is. */
  position: { index: number; total: number } | null;
  onDone: () => void;
}) {
  const { clients } = usePortfolio();
  const found = findChallanCompany(clients, challan);
  // When neither the CIN nor the name matches, the user can pick the company.
  const [pickedId, setPickedId] = React.useState<string>("");
  const client = found?.client ?? clients.find((c) => c.id === pickedId) ?? null;
  const [adding, setAdding] = React.useState(false);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between gap-3 pr-6">
          <DialogTitle className="font-heading text-lg">
            MCA challan{position ? ` ${position.index} of ${position.total}` : ""}
          </DialogTitle>
          {position ? (
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>
              Skip
            </Button>
          ) : null}
        </div>
        <DialogDescription className="mt-1 text-sm">
          SRN <b className="font-mono text-foreground">{challan.srn}</b> paid on {formatDate(parseIsoDate(challan.srnDate)!)}
          {challan.total !== null ? ` · ${formatInr(challan.total)}` : ""}
        </DialogDescription>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 rounded-xl border p-3 text-sm">
        <dt className="text-muted-foreground">Company</dt>
        <dd className="font-medium">{challan.companyName}</dd>
        <dt className="text-muted-foreground">CIN</dt>
        <dd className="font-mono">{challan.cin}</dd>
        <dt className="text-muted-foreground">Address</dt>
        <dd>{challan.address || "—"}</dd>
        <dt className="text-muted-foreground">Fee for</dt>
        <dd>{challan.fees.map((f) => f.description).join(", ") || "—"}</dd>
        {challan.payerName ? (
          <>
            <dt className="text-muted-foreground">Paid by</dt>
            <dd>{challan.payerName}</dd>
          </>
        ) : null}
      </dl>

      {!found && clients.length > 0 ? (
        <div className="space-y-1.5">
          <p className="rounded-xl bg-muted p-3 text-sm">
            No company in your master data has CIN <span className="font-mono">{challan.cin}</span>. Pick the
            company this challan is for, or add it as a new company.
          </p>
          <Select value={pickedId} onValueChange={setPickedId}>
            <SelectTrigger className="w-full" aria-label="Company this challan is for">
              <SelectValue placeholder="Choose the company" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} · {c.cin}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {found?.by === "name" ? (
        <p className="rounded-xl bg-muted p-3 text-sm">
          Matched by name. The CIN in master data is <span className="font-mono">{found.client.cin}</span>; the
          challan says <span className="font-mono">{challan.cin}</span>.
        </p>
      ) : null}

      {client ? (
        <ApplyToCompany key={client.id} challan={challan} client={client} onDone={onDone} />
      ) : (
        <>
          {clients.length === 0 ? (
            <p className="rounded-xl bg-muted p-3 text-sm">
              Your master data has no companies yet. Add this one from the challan, then upload the challan again
              to mark the filing.
            </p>
          ) : null}
          <DialogFooter>
            <Button variant={clients.length > 0 ? "outline" : "default"} onClick={() => setAdding(true)}>
              Add as a new company
            </Button>
          </DialogFooter>
          <ClientFormDialog
            open={adding}
            onOpenChange={(o) => {
              setAdding(o);
              if (!o) onDone();
            }}
            initial={{ name: challan.companyName, cin: challan.cin, registeredOffice: challan.address }}
          />
        </>
      )}
    </div>
  );
}

function ApplyToCompany({
  challan,
  client,
  onDone,
}: {
  challan: Challan;
  client: Client;
  onDone: () => void;
}) {
  const { directors, markFiled, updateClient, setAuditorTerm } = usePortfolio();
  const candidates = React.useMemo(() => {
    const report = buildPortfolioReport([client], directors, { clientId: client.id, asOf: today() });
    const items = report.sections[0]?.items.map((i) => i.item) ?? [];
    const codes = challan.fees.map((f) => f.formCode).filter((c): c is string => c !== null);
    return challanCandidates(items, codes);
  }, [client, directors, challan]);
  const [rowKey, setRowKey] = React.useState<string>(() => {
    const best = bestChallanRow(candidates, challan);
    return best ? filingKey(best) : "";
  });
  const row = candidates.find((c) => filingKey(c) === rowKey) ?? null;

  const nameDiffers = challan.companyName.trim() !== client.name.trim();
  const addressDiffers = challan.address !== "" && challan.address.trim() !== client.registeredOffice.trim();
  const [updateMaster, setUpdateMaster] = React.useState(nameDiffers || addressDiffers);

  const isAdt1 = row?.source.id === "adt-1";
  // Years the auditor is appointed for, per ADT-1 row (as in the mark-filed dialog).
  const [yearsByRow, setYearsByRow] = React.useState<Record<string, number>>({});
  const years = row
    ? (yearsByRow[rowKey] ?? appointmentCovering(client, row.fyEndingYear)?.years ?? auditorTermOf(client))
    : 0;
  const setYears = (n: number) => setYearsByRow((m) => ({ ...m, [rowKey]: n }));
  const [busy, setBusy] = React.useState(false);

  async function apply() {
    setBusy(true);
    try {
      if (updateMaster && (nameDiffers || addressDiffers)) {
        await updateClient(client.id, {
          ...draftFrom(client),
          ...(nameDiffers ? { name: challan.companyName } : {}),
          ...(addressDiffers ? { registeredOffice: challan.address } : {}),
        });
      }
      if (row) {
        await markFiled(client.id, row, { filedOn: challan.srnDate, srn: challan.srn });
        if (isAdt1) await setAuditorTerm(client.id, row.fyEndingYear, years);
      }
      toast.success(row ? `${row.source.title} marked filed` : "Master data updated", {
        description: row ? `SRN ${challan.srn} · ${client.name}` : client.name,
      });
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="space-y-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Mark as filed
        </span>
        {candidates.length > 0 ? (
          <Select value={rowKey} onValueChange={setRowKey}>
            <SelectTrigger className="w-full" aria-label="Filing this challan is for">
              <SelectValue placeholder="Choose the filing" />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((c) => (
                <SelectItem key={filingKey(c)} value={filingKey(c)}>
                  {rowLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-sm text-muted-foreground">
            {client.name} has no {challan.fees.map((f) => f.formCode ?? f.description).join(", ")} filing in its
            schedule, so only the master data can be updated.
          </p>
        )}
        {row ? (
          <p className="text-[11px] text-muted-foreground">
            Filed on {formatDate(parseIsoDate(challan.srnDate)!)} with SRN {challan.srn}.
          </p>
        ) : null}
      </div>

      {isAdt1 ? <AuditorYearsField value={years} onChange={setYears} /> : null}

      {nameDiffers || addressDiffers ? (
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={updateMaster} onCheckedChange={(v) => setUpdateMaster(v === true)} className="mt-0.5" />
          <span>
            Update {nameDiffers && addressDiffers ? "name and registered office" : nameDiffers ? "name" : "registered office"}{" "}
            in master data from the challan
          </span>
        </label>
      ) : null}

      <DialogFooter>
        <Button onClick={apply} disabled={busy || (!row && !(updateMaster && (nameDiffers || addressDiffers)))}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}{" "}
          Save
        </Button>
      </DialogFooter>
    </>
  );
}
