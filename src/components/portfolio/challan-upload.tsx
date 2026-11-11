"use client";

import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Receipt } from "lucide-react";

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
  parseMcaChallan,
  sameCin,
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
export function ChallanUploadButton({ className }: { className?: string }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [reading, setReading] = React.useState(false);
  const [challan, setChallan] = React.useState<Challan | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      toast.error(NOT_A_CHALLAN);
      return;
    }
    setReading(true);
    try {
      const { extractPdfLines } = await import("@/lib/pdf-text");
      const result = parseMcaChallan(await extractPdfLines(file));
      if (!result.ok) toast.error(result.error);
      else setChallan(result.challan);
    } catch {
      toast.error("Could not read that PDF.", { description: NOT_A_CHALLAN });
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
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
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <Dialog open={challan !== null} onOpenChange={(o) => !o && setChallan(null)}>
        <DialogContent className="max-w-lg">
          {challan ? <ChallanReview key={challan.srn} challan={challan} onDone={() => setChallan(null)} /> : null}
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

function ChallanReview({ challan, onDone }: { challan: Challan; onDone: () => void }) {
  const { clients } = usePortfolio();
  const client = clients.find((c) => sameCin(c.cin, challan.cin)) ?? null;
  const [adding, setAdding] = React.useState(false);

  return (
    <div className="space-y-4">
      <div>
        <DialogTitle className="font-heading text-lg">MCA challan</DialogTitle>
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

      {client ? (
        <ApplyToCompany challan={challan} client={client} onDone={onDone} />
      ) : (
        <>
          <p className="rounded-xl bg-muted p-3 text-sm">
            No company with CIN <span className="font-mono">{challan.cin}</span> is in your master data yet. Add it
            from this challan, then upload the challan again to mark the filing.
          </p>
          <DialogFooter>
            <Button onClick={() => setAdding(true)}>Add company from challan</Button>
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
