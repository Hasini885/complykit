"use client";

import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Receipt } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tip } from "@/components/shared/tip";
import { UploadHero } from "@/components/shared/upload-hero";
import { AuditorYearsField } from "@/components/dashboard/auditor-years-field";
import { ClientFormDialog } from "@/components/portfolio/client-form-dialog";
import { usePortfolio } from "@/components/portfolio/portfolio-provider";
import {
  NOT_A_DOCUMENT,
  bestChallanRow,
  challanCandidates,
  findChallanCompany,
  parseFilingDocument,
  type Challan,
} from "@/lib/challan";
import { financialYearLabel, formatDate, parseIsoDate, today } from "@/lib/dates";
import { formatInr } from "@/lib/fees";
import { appointmentCovering } from "@/lib/portfolio/auditor";
import { applyFilings, filingKey } from "@/lib/portfolio/filings";
import { buildPortfolioReport } from "@/lib/portfolio/report";
import { auditorTermOf, postIncorporationItems } from "@/lib/portfolio/schedule";
import type { Client } from "@/lib/portfolio/types";
import type { ResolvedDueDate } from "@/lib/resolve-due-dates";

/**
 * Upload MCA payment challans (G.A.R.7) and ITR acknowledgements. A challan
 * marks the filing it paid for as filed with its SRN and SRN date; an ITR acknowledgement
 * marks that year's ITR filed with its acknowledgement number and date of
 * filing. Any other document is refused.
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
      const { readPdfLayout } = await import("@/lib/pdf-text");
      for (const file of files) {
        if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
          rejected.push(file.name);
          continue;
        }
        try {
          // A document saved with Microsoft Print to PDF, or scanned, is read by OCR.
          const result = parseFilingDocument((await readPdfLayout(file)).lines);
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
        files.length === 1
          ? NOT_A_DOCUMENT
          : `${rejected.length} of ${files.length} files are not MCA challans or ITR acknowledgements and were skipped`,
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

  const trigger =
    variant === "hero" ? (
      <UploadHero
        title="Upload MCA challan & ITR Acknowledgement"
        description="Mark filings as filed: the SRN from an MCA challan, or the acknowledgement number from an ITR acknowledgement."
        button="Select PDFs"
        busyLabel="Reading…"
        dropHint="or drop challans and ITR acknowledgements here"
        busy={reading}
        onPick={() => inputRef.current?.click()}
        onDropFiles={(files) => void onFiles(files)}
        className={className}
      />
    ) : (
      <Tip label="Upload MCA challan or ITR acknowledgement (marks the filing)">
        <Button
          size="icon-sm"
          variant="outline"
          className={className ?? "size-9"}
          onClick={() => inputRef.current?.click()}
          disabled={reading}
          aria-label="Upload MCA challan or ITR acknowledgement"
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
        <DialogContent className="sm:max-w-xl">
          {challan ? (
            <ChallanReview
              key={challan.srn}
              challan={challan}
              position={total > 1 ? { index: total - queue.length + 1, total } : null}
              onDone={next}
              onSkip={total > 1 ? next : undefined}
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
  onSkip,
}: {
  challan: Challan;
  /** In a batch: which document this is. */
  position: { index: number; total: number } | null;
  onDone: () => void;
  /** In a batch: on to the next without saving. */
  onSkip?: () => void;
}) {
  const itr = challan.kind === "itr";
  const { clients } = usePortfolio();
  const found = findChallanCompany(clients, challan);
  // When neither the CIN nor the name matches, the user can pick the company.
  const [pickedId, setPickedId] = React.useState<string>("");
  const client = found?.client ?? clients.find((c) => c.id === pickedId) ?? null;
  const [adding, setAdding] = React.useState(false);

  return (
    <div className="space-y-4">
      <div className="pr-6">
        <DialogTitle className="font-heading text-lg">
          {itr ? "ITR acknowledgement" : "MCA challan"}
          {position ? ` ${position.index} of ${position.total}` : ""}
        </DialogTitle>
        <DialogDescription className="mt-1 text-sm">
          {itr ? "Acknowledgement no." : "SRN"} <b className="font-mono text-foreground">{challan.srn}</b>{" "}
          {itr ? "filed on" : "paid on"} {formatDate(parseIsoDate(challan.srnDate)!)}
          {challan.total !== null ? ` · ${formatInr(challan.total)}` : ""}
        </DialogDescription>
      </div>

      <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 rounded-xl border p-3 text-sm [&_dd]:break-words">
        <dt className="text-muted-foreground">Company</dt>
        <dd className="font-medium">{challan.companyName}</dd>
        {challan.cin ? (
          <>
            <dt className="text-muted-foreground">CIN</dt>
            <dd className="font-mono">{challan.cin}</dd>
          </>
        ) : null}
        {challan.pan ? (
          <>
            <dt className="text-muted-foreground">PAN</dt>
            <dd className="font-mono">{challan.pan}</dd>
          </>
        ) : null}
        {challan.address ? (
          <>
            <dt className="text-muted-foreground">Address</dt>
            <dd>{challan.address}</dd>
          </>
        ) : null}
        <dt className="text-muted-foreground">{itr ? "Return" : "Fee for"}</dt>
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
            {itr ? (
              <>No company in your master data is named {challan.companyName}. Pick the company this return is for.</>
            ) : (
              <>
                No company in your master data has CIN <span className="font-mono">{challan.cin}</span>. Pick the
                company this challan is for, or add it as a new company.
              </>
            )}
          </p>
          <Select value={pickedId} onValueChange={setPickedId}>
            <SelectTrigger className="w-full min-w-0" aria-label="Company this document is for">
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

      {found?.by === "name" && !itr ? (
        <p className="rounded-xl bg-muted p-3 text-sm">
          Matched by name. The CIN in master data is <span className="font-mono">{found.client.cin}</span>; the
          challan says <span className="font-mono">{challan.cin}</span>.
        </p>
      ) : null}

      {client ? (
        <ApplyToCompany key={client.id} challan={challan} client={client} onDone={onDone} onSkip={onSkip} />
      ) : (
        <>
          {clients.length === 0 ? (
            <p className="rounded-xl bg-muted p-3 text-sm">
              Your master data has no companies yet. Add this one from the challan, then upload the challan again
              to mark the filing.
            </p>
          ) : null}
          <DialogFooter className="gap-2">
            {onSkip ? (
              <Button variant="ghost" onClick={onSkip}>
                Skip
              </Button>
            ) : null}
            {itr ? null : (
              <Button variant={clients.length > 0 ? "outline" : "default"} onClick={() => setAdding(true)}>
                Add as a new company
              </Button>
            )}
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

type AuditorKind = "first" | "subsequent";

function ApplyToCompany({
  challan,
  client,
  onDone,
  onSkip,
}: {
  challan: Challan;
  client: Client;
  onDone: () => void;
  onSkip?: () => void;
}) {
  const { directors, markFiled, setAuditorTerm } = usePortfolio();
  const itr = challan.kind === "itr";
  const codes = React.useMemo(
    () => challan.fees.map((f) => f.formCode).filter((c): c is string => c !== null),
    [challan],
  );
  const isAdtChallan = codes.includes("ADT-1");

  // The company's rows: this year's schedule, plus the one-time post incorporation
  // forms (the first auditor's ADT-1), which stay open until filed however old the company.
  const items = React.useMemo(() => {
    const report = buildPortfolioReport([client], directors, { clientId: client.id, asOf: today() });
    const rows = report.sections[0]?.items.map((i) => i.item) ?? [];
    const seen = new Set(rows.map(filingKey));
    const once = applyFilings(postIncorporationItems(client), client).filter((i) => !seen.has(filingKey(i)));
    return [...rows, ...once];
  }, [client, directors]);

  // ADT-1: first auditor or subsequent? Asked only while the first auditor's ADT-1 is not yet filed.
  const firstAuditorRow = isAdtChallan ? (items.find((i) => i.source.id === "first-auditor" && i.due) ?? null) : null;
  const askAuditor = firstAuditorRow !== null && !firstAuditorRow.filedOn;
  const [auditorKind, setAuditorKind] = React.useState<AuditorKind>("first");

  const candidates = React.useMemo(() => {
    const all = challanCandidates(items, codes);
    if (!isAdtChallan) return all;
    if (askAuditor && auditorKind === "first") return all.filter((i) => i.source.id === "first-auditor");
    return all.filter((i) => i.source.id !== "first-auditor");
  }, [items, codes, isAdtChallan, askAuditor, auditorKind]);
  // The row picked by hand, else the best match for this document.
  const [pickedKey, setRowKey] = React.useState<string | null>(null);
  const row = candidates.find((c) => filingKey(c) === pickedKey) ?? bestChallanRow(candidates, challan);
  const rowKey = row ? filingKey(row) : "";

  const refLabel = itr ? "Acknowledgement no." : "SRN";

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
      if (!row) return;
      await markFiled(client.id, row, { filedOn: challan.srnDate, srn: challan.srn });
      if (isAdt1) await setAuditorTerm(client.id, row.fyEndingYear, years);
      toast.success(`${row.source.title} marked filed`, {
        description: `${refLabel} ${challan.srn} · ${client.name}`,
      });
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {askAuditor ? (
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            This ADT-1 is for the
          </span>
          <div className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1" role="radiogroup" aria-label="Which auditor">
            {(
              [
                ["first", "First auditor"],
                ["subsequent", "Subsequent auditor"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={auditorKind === value}
                onClick={() => {
                  setAuditorKind(value);
                  setRowKey(null);
                }}
                className={`rounded-full py-1.5 text-sm font-medium transition-colors ${
                  auditorKind === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="min-w-0 space-y-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Mark as filed
        </span>
        {candidates.length > 0 ? (
          <Select value={rowKey} onValueChange={setRowKey}>
            <SelectTrigger
              className="w-full min-w-0 [&>span]:min-w-0 [&>span]:truncate"
              aria-label="Filing this document is for"
            >
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
            schedule.
          </p>
        )}
        {row ? (
          <p className="text-[11px] text-muted-foreground">
            Filed on {formatDate(parseIsoDate(challan.srnDate)!)} with {refLabel} {challan.srn}.
          </p>
        ) : null}
      </div>

      {isAdt1 ? <AuditorYearsField value={years} onChange={setYears} /> : null}

      <DialogFooter className="gap-2">
        {onSkip ? (
          <Button type="button" variant="ghost" onClick={onSkip} disabled={busy}>
            Skip
          </Button>
        ) : null}
        <Button onClick={apply} disabled={busy || !row}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}{" "}
          Save
        </Button>
      </DialogFooter>
    </>
  );
}
