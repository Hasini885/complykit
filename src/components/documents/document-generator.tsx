"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  Download,
  FileDown,
  FilePlus2,
  FileText,
  FolderOpen,
  Loader2,
  Printer,
  Save,
  Search,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tip } from "@/components/shared/tip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { DocumentPreview } from "@/components/documents/document-preview";
import { DocxDocumentPreview } from "@/components/documents/docx-document-preview";
import { usePortfolio } from "@/components/portfolio/portfolio-provider";
import { formatDate, isoDate, today } from "@/lib/dates";
import { dinAt, directorsForClient } from "@/lib/portfolio/directors";
import { formatMobile } from "@/lib/portfolio/mobile";
import { emailInput, mobileInput } from "@/lib/input-filters";
import { typeLabelLong } from "@/lib/portfolio/clients";
import { anyTemplateById, findTemplates, initialValues } from "@/lib/documents/templates";
import { FIRM_FIELD_IDS } from "@/lib/documents/aoc4";
import {
  DOC_CATEGORIES,
  isDocxTemplate,
  type AnyTemplate,
  type DocCategory,
  type DocContext,
  type Field,
  type Values,
} from "@/lib/documents/types";
import { deleteSaved, readFirm, readSaved, saveDocument, writeFirm, type SavedDocument } from "@/lib/documents/saved";
import { cn } from "@/lib/utils";

const MANUAL = "__manual__";

/**
 * Secretarial document generator: choose a template, fill a short form that
 * starts pre-filled from the selected company, see the document live, and
 * download it as Word or PDF.
 */
export function DocumentGenerator() {
  const { ready } = usePortfolio();
  const [open, setOpen] = React.useState<{ template: AnyTemplate; saved?: SavedDocument } | null>(null);

  if (!ready) return <div className="h-64 animate-pulse rounded-lg border bg-muted/30" aria-hidden />;

  return open ? (
    <Generator
      key={open.saved?.id ?? open.template.id}
      template={open.template}
      saved={open.saved}
      onBack={() => setOpen(null)}
    />
  ) : (
    <Library onOpen={(template, saved) => setOpen({ template, saved })} />
  );
}

/* ------------------------------------------------------------------ */
/* The template library                                                */
/* ------------------------------------------------------------------ */

function Library({ onOpen }: { onOpen: (t: AnyTemplate, saved?: SavedDocument) => void }) {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<DocCategory | "all">("all");
  const [saved, setSaved] = React.useState<SavedDocument[]>(() => (typeof window === "undefined" ? [] : readSaved()));

  const found = findTemplates(query).filter((t) => category === "all" || t.category === category);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileText}
        eyebrow="Document Generator"
        badge="NEW"
        title="Secretarial Document Generator"
        lede="Board and general meeting notices, resolutions, director forms and letters, drafted on the Companies Act, 2013 and the Secretarial Standards, plus the AOC-4 attachments in your firm's own Word format. Pre-filled from your selected company, previewed live, and downloaded as Word or PDF."
      />

      <div className="rounded-lg border bg-card p-4">
        <label htmlFor="doc-find" className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          What do you need to do?
        </label>
        <div className="relative mt-1.5">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id="doc-find"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. appoint a new director, open a bank account, change the registered office"
            className="h-10 pl-9"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(["all", ...DOC_CATEGORIES] as const).map((c) => (
            <Button
              key={c}
              size="sm"
              variant={category === c ? "secondary" : "ghost"}
              className="h-7 px-2.5 text-xs"
              onClick={() => setCategory(c)}
            >
              {c === "all" ? "All" : c}
            </Button>
          ))}
        </div>
      </div>

      {found.length === 0 ? (
        <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
          No template matches that. Try different words, or browse all of them.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {found.map((t) => (
            <div key={t.id} className="flex flex-col rounded-lg border bg-card p-4">
              <span className="w-fit rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                {t.category}
              </span>
              <h3 className="mt-2 font-heading text-base font-semibold leading-snug">{t.title}</h3>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">{t.description}</p>
              <p className="mt-2 text-[11px] text-muted-foreground">{t.reference}</p>
              <Tip label="Generate">
                <Button size="icon-sm" className="mt-3 size-8" onClick={() => onOpen(t)} aria-label={`Generate ${t.title}`}>
                  <FilePlus2 className="size-4" aria-hidden />
                </Button>
              </Tip>
            </div>
          ))}
        </div>
      )}

      {saved.length > 0 ? (
        <section>
          <h2 className="mb-2 flex items-center gap-2 font-heading text-lg font-semibold">
            <FolderOpen className="size-4" aria-hidden /> Saved documents
          </h2>
          <ul className="divide-y rounded-lg border bg-card">
            {saved.map((d) => {
              const t = anyTemplateById.get(d.templateId);
              return (
                <li key={d.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{d.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {d.companyName || "No company"} · saved {formatDate(new Date(d.savedAt))}
                    </span>
                  </span>
                  {t ? (
                    <Tip label="Open">
                      <Button size="icon-sm" variant="outline" onClick={() => onOpen(t, d)} aria-label={`Open ${d.title}`}>
                        <FolderOpen className="size-3.5" aria-hidden />
                      </Button>
                    </Tip>
                  ) : null}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    onClick={() => {
                      deleteSaved(d.id);
                      setSaved(readSaved());
                    }}
                    title="Delete"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    <span className="sr-only">Delete {d.title}</span>
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One template: form and live preview                                 */
/* ------------------------------------------------------------------ */

function Generator({
  template,
  saved,
  onBack,
}: {
  template: AnyTemplate;
  saved?: SavedDocument;
  onBack: () => void;
}) {
  const { clients, directors, activeClient } = usePortfolio();
  const reference = React.useMemo(() => today(), []);
  const [companyId, setCompanyId] = React.useState<string>(saved?.companyId ?? activeClient?.id ?? clients[0]?.id ?? MANUAL);
  const [manual, setManual] = React.useState({ companyName: "", cin: "", registeredOffice: "", mobile: "", email: "" });
  const [busy, setBusy] = React.useState<"docx" | "pdf" | "print" | null>(null);
  // Fixed once per opened draft, so repeated saves update the same document.
  const [draftId] = React.useState(() => saved?.id ?? `doc-${Date.now().toString(36)}`);

  const client = clients.find((c) => c.id === companyId) ?? null;
  const ctx: DocContext = React.useMemo(
    () =>
      client
        ? {
            companyName: client.name,
            cin: client.cin,
            registeredOffice: client.registeredOffice,
            entityLabel: typeLabelLong(client.type),
            directors: directorsForClient(directors, client.id, reference).map((d) => ({ name: d.name, din: dinAt(d, client.id) })),
            today: reference,
            incorporatedOn: client.incorporatedOn,
            // On every letterhead, from the company master data.
            mobile: client.mobile ? formatMobile(client.mobile) : "",
            email: client.email ?? "",
          }
        : { ...manual, entityLabel: "", directors: [], today: reference },
    [client, directors, manual, reference],
  );

  const docx = isDocxTemplate(template) ? template : null;
  const [values, setValues] = React.useState<Values>(
    () => saved?.values ?? { ...initialValues(template, ctx), ...(docx ? firmDefaults(template) : {}) },
  );
  const blocks = React.useMemo(() => (isDocxTemplate(template) ? [] : template.render(values, ctx)), [template, values, ctx]);
  const docxData = React.useMemo(() => (docx ? docx.data(values, ctx) : null), [docx, values, ctx]);
  const [fileIndex, setFileIndex] = React.useState(0);

  function changeCompany(id: string) {
    setCompanyId(id);
    // Re-seed company-derived defaults (signatory, venue, directors) for the new company.
    const next = clients.find((c) => c.id === id);
    if (next) {
      const nextCtx: DocContext = {
        companyName: next.name,
        cin: next.cin,
        registeredOffice: next.registeredOffice,
        entityLabel: typeLabelLong(next.type),
        directors: directorsForClient(directors, next.id, reference).map((d) => ({ name: d.name, din: dinAt(d, next.id) })),
        today: reference,
        incorporatedOn: next.incorporatedOn,
        mobile: next.mobile ? formatMobile(next.mobile) : "",
        email: next.email ?? "",
      };
      setValues((v) => ({ ...initialValues(template, nextCtx), ...pickTyped(v, template) }));
    }
  }

  const fileBase = `${template.id}-${(ctx.companyName || "draft").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}-${isoDate(reference)}`;

  async function download(kind: "docx" | "pdf") {
    setBusy(kind);
    try {
      if (docx && docxData) {
        const { buildDownload } = await import("@/lib/documents/docx-runtime");
        const { saveBlob } = await import("@/lib/documents/export");
        const { blob, fileName } = await buildDownload(docx, docxData, fileBase);
        saveBlob(blob, fileName);
        toast.success(docx.files.length > 1 ? `Downloaded ${docx.files.length} Word files as a .zip` : "Downloaded as Word");
        return;
      }
      const { saveBlob, toDocx, toPdf } = await import("@/lib/documents/export");
      const blob = kind === "docx" ? await toDocx(blocks, template.title) : await toPdf(blocks);
      saveBlob(blob, `${fileBase}.${kind}`);
      toast.success(`Downloaded as ${kind === "docx" ? "Word" : "PDF"}`);
    } catch (error) {
      console.error("Document export failed", error);
      toast.error("The file could not be created. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function print() {
    setBusy("print");
    try {
      if (docx && docxData) {
        const { fillFile, printDocx } = await import("@/lib/documents/docx-runtime");
        await printDocx(await Promise.all(docx.files.map((f) => fillFile(f.url, docxData))));
        return;
      }
      const { toPdf } = await import("@/lib/documents/export");
      const url = URL.createObjectURL(await toPdf(blocks));
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      console.error("Print failed", error);
      toast.error("Could not open printing. Download the Word file instead.");
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    const { toPlainText } = await import("@/lib/documents/export");
    try {
      await navigator.clipboard.writeText(toPlainText(blocks));
      toast.success("Copied as text");
    } catch {
      toast.error("Could not copy — use Word or PDF instead.");
    }
  }

  function save() {
    const ok = saveDocument({
      id: draftId,
      templateId: template.id,
      title: template.title,
      companyId: client?.id ?? null,
      companyName: ctx.companyName,
      values,
      savedAt: new Date().toISOString(),
    });
    if (ok) toast.success("Saved", { description: "Find it under Saved documents on this page." });
    else toast.error("This browser would not save it (storage may be full or blocked).");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
          <ArrowLeft className="size-4" aria-hidden /> All templates
        </Button>
        <div className="flex flex-wrap gap-2">
          {docx ? (
            // A Word-only template: one format, so the icon downloads it directly.
            <Tip label={docx.files.length > 1 ? "Download Word (.zip)" : "Download Word"}>
              <Button
                size="icon-sm"
                variant="outline"
                className="size-8"
                onClick={() => download("docx")}
                disabled={busy !== null}
                aria-label={docx.files.length > 1 ? "Download Word (.zip)" : "Download Word"}
              >
                {busy === "docx" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
              </Button>
            </Tip>
          ) : (
            <DropdownMenu>
              <Tip label="Download">
                <DropdownMenuTrigger asChild>
                  <Button size="icon-sm" variant="outline" className="size-8" disabled={busy !== null} aria-label="Download">
                    {busy === "docx" || busy === "pdf" ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Download className="size-4" aria-hidden />
                    )}
                  </Button>
                </DropdownMenuTrigger>
              </Tip>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => download("docx")}>
                  <FileDown className="size-4" aria-hidden /> Word (.docx)
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => download("pdf")}>
                  <FileText className="size-4" aria-hidden /> PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Tip label={docx ? "Print, or Save as PDF in the print window" : "Print"}>
            <Button
              size="icon-sm"
              variant="outline"
              className="size-8"
              onClick={print}
              disabled={busy !== null}
              aria-label={docx ? "Print or save as PDF" : "Print"}
            >
              {busy === "print" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Printer className="size-4" aria-hidden />}
            </Button>
          </Tip>
          {docx ? null : (
            <Tip label="Copy text">
              <Button size="icon-sm" variant="outline" className="size-8" onClick={copy} aria-label="Copy text">
                <Copy className="size-4" aria-hidden />
              </Button>
            </Tip>
          )}
          <Tip label="Save">
            <Button size="icon-sm" className="size-8" onClick={save} aria-label="Save">
              <Save className="size-4" aria-hidden />
            </Button>
          </Tip>
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">{template.category}</p>
        <h1 className="font-heading text-2xl font-semibold">{template.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{template.reference}</p>
        {template.followUp ? (
          <p className="mt-2 rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-900 dark:text-sky-200">
            Next step: {template.followUp}
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        {/* Form */}
        <div className="space-y-4 rounded-lg border bg-card p-4 lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto">
          <FieldShell label="Company" hint="Details and directors are filled in from the company's profile.">
            <select
              value={companyId}
              onChange={(e) => changeCompany(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value={MANUAL}>Another company (type its details)</option>
            </select>
          </FieldShell>
          {companyId === MANUAL ? (
            <div className="grid gap-3">
              <FieldShell label="Company name">
                <Input value={manual.companyName} onChange={(e) => setManual((m) => ({ ...m, companyName: e.target.value }))} />
              </FieldShell>
              <FieldShell label="CIN">
                <Input value={manual.cin} onChange={(e) => setManual((m) => ({ ...m, cin: e.target.value }))} className="font-mono uppercase" />
              </FieldShell>
              <FieldShell label="Registered office">
                <textarea
                  value={manual.registeredOffice}
                  onChange={(e) => setManual((m) => ({ ...m, registeredOffice: e.target.value }))}
                  rows={2}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </FieldShell>
              <div className="grid gap-3 sm:grid-cols-2">
                <FieldShell label="Mobile">
                  <Input
                    type="tel"
                    inputMode="tel"
                    value={manual.mobile}
                    onChange={(e) => setManual((m) => ({ ...m, mobile: mobileInput(e.target.value) }))}
                    placeholder="98765 43210"
                  />
                </FieldShell>
                <FieldShell label="Email">
                  <Input
                    type="email"
                    value={manual.email}
                    onChange={(e) => setManual((m) => ({ ...m, email: emailInput(e.target.value) }))}
                    placeholder="office@company.in"
                  />
                </FieldShell>
              </div>
            </div>
          ) : null}
          <div className="border-t pt-4" />
          <div className="grid gap-3 sm:grid-cols-2">
            {template.fields.map((f) => (
              <FieldInput
                key={f.id}
                field={f}
                value={values[f.id]}
                directors={ctx.directors}
                onChange={(val) => {
                  setValues((v) => ({ ...v, [f.id]: val }));
                  if (FIRM_FIELD_IDS.includes(f.id) && typeof val === "string") writeFirm({ ...readFirm(), [f.id]: val });
                }}
              />
            ))}
          </div>
        </div>

        {/* Live preview */}
        <div className="min-w-0 rounded-lg border bg-muted/40 p-3 sm:p-6">
          <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Live preview{docx ? " · as the Word file" : ""}
          </p>
          {docx && docxData ? (
            <>
              {docx.files.length > 1 ? (
                <div className="mb-3 flex justify-center">
                  <select
                    aria-label="Document to preview"
                    value={fileIndex}
                    onChange={(e) => setFileIndex(Number(e.target.value))}
                    className="h-8 w-full max-w-sm rounded-md border bg-background px-2 text-sm"
                  >
                    {docx.files.map((f, i) => (
                      <option key={f.url} value={i}>
                        {i + 1}. {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <DocxDocumentPreview url={(docx.files[fileIndex] ?? docx.files[0]).url} data={docxData} />
            </>
          ) : (
            <DocumentPreview blocks={blocks} />
          )}
        </div>
      </div>
    </div>
  );
}

/** Values the user typed that are not company-derived, kept when switching company. */
function pickTyped(v: Values, t: AnyTemplate): Values {
  const companyDerived = new Set(t.fields.filter((f) => typeof f.initial === "function").map((f) => f.id));
  return Object.fromEntries(Object.entries(v).filter(([k]) => !companyDerived.has(k)));
}

/** The audit firm's details remembered from the last pack, for the fields this template has. */
function firmDefaults(t: AnyTemplate): Values {
  if (typeof window === "undefined") return {};
  const ids = new Set(t.fields.map((f) => f.id));
  return Object.fromEntries(Object.entries(readFirm()).filter(([k]) => ids.has(k)));
}

function FieldShell({
  label,
  hint,
  wide,
  children,
}: {
  label: string;
  hint?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1", wide && "sm:col-span-2")}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function FieldInput({
  field: f,
  value,
  directors,
  onChange,
}: {
  field: Field;
  value: string | string[] | undefined;
  directors: { name: string; din: string }[];
  onChange: (v: string | string[]) => void;
}) {
  const text = Array.isArray(value) ? value.join("\n") : (value ?? "");
  const listId = React.useId();
  const wide = f.wide || f.type === "textarea" || f.type === "list";
  const label = f.required ? `${f.label} *` : f.label;

  let control: React.ReactNode;
  switch (f.type) {
    case "textarea":
      control = (
        <textarea
          value={text}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={f.placeholder}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      );
      break;
    case "list":
      control = (
        <textarea
          value={text}
          onChange={(e) => onChange(e.target.value.split("\n"))}
          rows={Math.max(3, (Array.isArray(value) ? value.length : 1) + 1)}
          placeholder={f.placeholder ?? "One item per line"}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      );
      break;
    case "select":
      control = (
        <select value={text} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
          {(f.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
      break;
    case "director":
      control = (
        <>
          <Input value={text} onChange={(e) => onChange(e.target.value)} list={listId} placeholder={f.placeholder ?? "Name"} />
          <datalist id={listId}>
            {directors.map((d) => (
              <option key={d.din} value={d.name}>
                DIN {d.din}
              </option>
            ))}
          </datalist>
        </>
      );
      break;
    default:
      control = (
        <Input
          type={f.type === "number" ? "text" : f.type}
          inputMode={f.type === "number" ? "decimal" : undefined}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder={f.placeholder}
          className={f.type === "date" || f.type === "time" ? "tabular" : undefined}
        />
      );
  }

  return (
    <FieldShell label={label} hint={f.hint} wide={wide}>
      {control}
    </FieldShell>
  );
}
