"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, Search, X } from "lucide-react";

import {
  FORM_CATEGORIES,
  type EntityScope,
  type FormCategory,
  type McaForm,
} from "@/data/forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tip } from "@/components/shared/tip";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { FEE_RELAXATIONS } from "@/data/fee-relaxations";
import { financialYearLabel, formatDate, parseIsoDate } from "@/lib/dates";
import { matchesForm } from "@/lib/search";
import { useUrlParam } from "@/lib/use-url-param";
import { usePortfolio } from "@/components/portfolio/portfolio-provider";
import { formEntityScopeFor, typeLabel } from "@/lib/portfolio/clients";

const ENTITY_FILTERS: { value: EntityScope | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "company", label: "Company" },
  { value: "llp", label: "LLP" },
];

/** Colour-codes how the money accrues, not how severe it is. */
const LATE_FEE_TONE: Record<string, string> = {
  "per-day": "border-destructive/30 bg-destructive/10 text-destructive",
  "ad-valorem": "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  flat: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  slab: "border-border bg-muted text-muted-foreground",
  none: "border-border bg-muted text-muted-foreground",
};

export function FormsExplorer({ forms }: { forms: McaForm[] }) {
  const { activeClient } = usePortfolio();
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<FormCategory | "all">("all");
  const [entity, setEntity] = React.useState<EntityScope | "all">("all");
  const [scopedToClient, setScopedToClient] = React.useState(false);
  // `undefined` means "follow the ?form= deep link"; an explicit value overrides it.
  const [override, setOverride] = React.useState<McaForm | null | undefined>(undefined);
  const linkedId = useUrlParam("form");
  const linked = React.useMemo(
    () => (linkedId ? (forms.find((f) => f.id === linkedId) ?? null) : null),
    [forms, linkedId],
  );
  const selected = override === undefined ? linked : override;
  const setSelected = setOverride;

  const clientScope: EntityScope | null = activeClient
    ? formEntityScopeFor(activeClient.type)
    : null;
  const effectiveEntity = scopedToClient && clientScope ? clientScope : entity;

  const results = React.useMemo(
    () =>
      forms.filter(
        (f) =>
          matchesForm(f, query) &&
          (category === "all" || f.category === category) &&
          (effectiveEntity === "all" || f.entity.includes(effectiveEntity)),
      ),
    [forms, query, category, effectiveEntity],
  );

  const filtered = query !== "" || category !== "all" || entity !== "all" || scopedToClient;

  function reset() {
    setQuery("");
    setCategory("all");
    setEntity("all");
    setScopedToClient(false);
  }

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="space-y-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by form code, purpose, section or trigger…"
            aria-label="Search forms"
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {activeClient ? (
            <>
              <Button
                size="sm"
                variant={scopedToClient ? "default" : "outline"}
                onClick={() => setScopedToClient((v) => !v)}
              >
                Applicable to {activeClient.name}
              </Button>
              <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />
            </>
          ) : null}
          {ENTITY_FILTERS.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={!scopedToClient && entity === f.value ? "default" : "outline"}
              disabled={scopedToClient}
              onClick={() => setEntity(f.value)}
            >
              {f.label}
            </Button>
          ))}
          <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />
          <Button
            size="sm"
            variant={category === "all" ? "secondary" : "ghost"}
            onClick={() => setCategory("all")}
          >
            All categories
          </Button>
          {FORM_CATEGORIES.map((c) => (
            <Button
              key={c}
              size="sm"
              variant={category === c ? "secondary" : "ghost"}
              onClick={() => setCategory(c)}
            >
              {c}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="tabular">
            {results.length} of {forms.length} forms
          </span>
          {filtered ? (
            <Tip label="Clear filters">
              <Button size="icon-sm" variant="ghost" onClick={reset} aria-label="Clear filters">
                <X className="size-3.5" aria-hidden />
              </Button>
            </Tip>
          ) : null}
        </div>
        {scopedToClient && activeClient ? (
          <p className="text-xs text-muted-foreground">
            Scoped to {activeClient.name} ({typeLabel(activeClient.type)}). This filters by
            company-vs-LLP only — it does not yet account for size, listing or other
            entity-specific thresholds. Cross-check against{" "}
            <a href="/applicability" className="underline underline-offset-4 hover:text-foreground">
              What Applies To Me?
            </a>{" "}
            for the threshold-based picture.
          </p>
        ) : null}
      </div>

      {/* Results */}
      {results.length === 0 ? (
        <div className="rounded-3xl border border-dashed bg-card/50 py-16 text-center">
          <p className="font-heading text-lg">No form matches that</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a form code like <span className="font-mono">AOC-4</span>, or a word like
            &ldquo;charge&rdquo;, &ldquo;auditor&rdquo; or &ldquo;deposit&rdquo;.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Form</TableHead>
                <TableHead className="min-w-[240px]">Purpose</TableHead>
                <TableHead className="w-[170px]">Section</TableHead>
                <TableHead className="w-[200px]">Deadline</TableHead>
                <TableHead className="w-[190px]">Late fee</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((form) => (
                <TableRow
                  key={form.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open details for ${form.code}`}
                  onClick={() => setSelected(form)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(form);
                    }
                  }}
                  data-state={selected?.id === form.id ? "selected" : undefined}
                  className="cursor-pointer hover:bg-accent/40 data-[state=selected]:bg-accent/70 data-[state=selected]:shadow-[inset_3px_0_0_var(--primary)]"
                >
                  <TableCell className="align-top">
                    <span className="inline-flex whitespace-nowrap rounded-full bg-accent px-2.5 py-0.5 font-mono text-xs font-semibold text-accent-foreground">
                      {form.code}
                    </span>
                  </TableCell>
                  <TableCell className="align-top whitespace-normal">
                    <span className="block font-medium">{form.name}</span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                      {form.purpose}
                    </span>
                  </TableCell>
                  <TableCell className="align-top whitespace-normal">
                    <span className="font-mono text-xs text-muted-foreground">{form.section}</span>
                  </TableCell>
                  <TableCell className="align-top text-xs whitespace-normal">{form.deadline}</TableCell>
                  <TableCell className="align-top">
                    <span
                      className={cn(
                        "inline-block rounded border px-1.5 py-0.5 text-[11px] leading-snug",
                        LATE_FEE_TONE[form.lateFee.kind],
                      )}
                    >
                      {form.lateFee.summary}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <FormDetail form={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function FormDetail({ form, onClose }: { form: McaForm | null; onClose: () => void }) {
  return (
    <Sheet open={form !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        {form ? (
          <>
            <SheetHeader className="border-b">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-primary">
                {form.section}
              </p>
              <SheetTitle className="font-mono text-2xl">{form.code}</SheetTitle>
              <SheetDescription>{form.name}</SheetDescription>
            </SheetHeader>

            <div className="space-y-6 px-4 py-5 text-sm">
              <Field label="Purpose">{form.purpose}</Field>
              <Field label="Trigger">{form.trigger}</Field>
              <Field label="Deadline">
                <span className="font-medium text-foreground">{form.deadline}</span>
                {FEE_RELAXATIONS.filter((r) => r.formIds.includes(form.id)).map((r) => (
                  <span
                    key={r.id}
                    className="mt-2 block rounded-md border border-sky-500/30 bg-sky-500/10 p-2 text-xs text-sky-900 dark:text-sky-200"
                  >
                    {financialYearLabel(r.fyEndingYear)}: extended to {formatDate(parseIsoDate(r.feeFreeUntil)!)} without
                    additional fee — {r.circular}. The AGM date is not extended.
                  </span>
                ))}
              </Field>
              <Field label={`Late fee — ${form.lateFee.summary}`}>{form.lateFee.detail}</Field>
              <Field label="Watch out for">{form.watchOut}</Field>

              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary">{form.category}</Badge>
                {form.entity.map((e) => (
                  <Badge key={e} variant="outline">
                    {e === "llp" ? "LLP" : "Company"}
                  </Badge>
                ))}
                {form.tags.map((t) => (
                  <Badge key={t} variant="outline" className="text-muted-foreground">
                    {t}
                  </Badge>
                ))}
              </div>

              <div className="border-t pt-4">
                <Button asChild variant="outline" size="sm">
                  <Link href={form.mcaUrl} target="_blank" rel="noopener noreferrer">
                    Open the MCA forms library
                    <ExternalLink className="size-3.5" aria-hidden />
                  </Link>
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  Opens the official forms library on mca.gov.in rather than a direct file link —
                  MCA rotates per-form URLs.
                </p>
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <p className="leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}
