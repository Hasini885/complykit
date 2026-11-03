"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, Search, X } from "lucide-react";

import { SECTION_THEMES, type ActSection, type SectionTheme } from "@/data/sections";
import type { McaForm } from "@/data/forms";
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
import { matchesSection } from "@/lib/search";
import { useUrlParam } from "@/lib/use-url-param";

/** Precomputed on the server so this component stays free of data-layer imports. */
export type SectionWithForms = {
  section: ActSection;
  relatedForms: Pick<McaForm, "id" | "code" | "name">[];
};

export function SectionsExplorer({ entries }: { entries: SectionWithForms[] }) {
  const [query, setQuery] = React.useState("");
  const [theme, setTheme] = React.useState<SectionTheme | "all">("all");
  // `undefined` means "follow the ?section= deep link"; an explicit value wins.
  const [override, setOverride] = React.useState<SectionWithForms | null | undefined>(undefined);
  const linkedId = useUrlParam("section");
  const linked = React.useMemo(
    () => (linkedId ? (entries.find((e) => e.section.id === linkedId) ?? null) : null),
    [entries, linkedId],
  );
  const selected = override === undefined ? linked : override;
  const setSelected = setOverride;

  const results = React.useMemo(
    () =>
      entries.filter(
        (e) =>
          matchesSection(e.section, query) && (theme === "all" || e.section.theme === theme),
      ),
    [entries, query, theme],
  );

  const filtered = query !== "" || theme !== "all";

  // Only offer themes that actually have entries.
  const themes = React.useMemo(
    () => SECTION_THEMES.filter((t) => entries.some((e) => e.section.theme === t)),
    [entries],
  );

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by section number, subject or penalty…"
            aria-label="Search sections"
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant={theme === "all" ? "secondary" : "ghost"}
            onClick={() => setTheme("all")}
          >
            All
          </Button>
          {themes.map((t) => (
            <Button
              key={t}
              size="sm"
              variant={theme === t ? "secondary" : "ghost"}
              onClick={() => setTheme(t)}
            >
              {t}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="tabular">
            {results.length} of {entries.length} sections
          </span>
          {filtered ? (
            <Tip label="Clear filters">
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => {
                  setQuery("");
                  setTheme("all");
                }}
                aria-label="Clear filters"
              >
                <X className="size-3.5" aria-hidden />
              </Button>
            </Tip>
          ) : null}
        </div>
      </div>

      {results.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <p className="font-heading text-lg">No section matches that</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a number like <span className="font-mono">137</span>, or a word like
            &ldquo;charge&rdquo;, &ldquo;auditor&rdquo; or &ldquo;disqualification&rdquo;.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {results.map((entry) => (
            <li key={entry.section.id}>
              <button
                type="button"
                onClick={() => setSelected(entry)}
                className="w-full rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-accent/40"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono text-sm font-semibold text-primary">
                    Section {entry.section.number}
                  </span>
                  <span className="font-heading text-base font-semibold">
                    {entry.section.title}
                  </span>
                  <Badge variant="secondary" className="ml-auto shrink-0 text-[10px]">
                    {entry.section.theme}
                  </Badge>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {entry.section.summary}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {entry.relatedForms.map((f) => (
                    <Badge key={f.id} variant="outline" className="font-mono text-[10px]">
                      {f.code}
                    </Badge>
                  ))}
                  {entry.section.penalty ? (
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {entry.section.penalty.summary}
                    </span>
                  ) : null}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <SectionDetail entry={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function SectionDetail({
  entry,
  onClose,
}: {
  entry: SectionWithForms | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={entry !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        {entry ? (
          <>
            <SheetHeader className="border-b">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-primary">
                {entry.section.theme}
              </p>
              <SheetTitle className="font-mono text-2xl">
                Section {entry.section.number}
              </SheetTitle>
              <SheetDescription>{entry.section.title}</SheetDescription>
            </SheetHeader>

            <div className="space-y-6 px-4 py-5 text-sm">
              <div>
                <Label>In plain language</Label>
                <p className="leading-relaxed text-muted-foreground">{entry.section.summary}</p>
              </div>

              <div>
                <Label>Key points</Label>
                <ul className="list-disc space-y-1.5 pl-5 leading-relaxed text-muted-foreground">
                  {entry.section.keyPoints.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>

              <div>
                <Label>Penalty</Label>
                {entry.section.penalty ? (
                  <>
                    <p className="font-medium text-foreground">{entry.section.penalty.summary}</p>
                    <p className="mt-1 leading-relaxed text-muted-foreground">
                      {entry.section.penalty.detail}
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    None — this section is definitional and carries no penalty of its own.
                  </p>
                )}
              </div>

              {entry.relatedForms.length > 0 ? (
                <div>
                  <Label>Forms this drives</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {entry.relatedForms.map((f) => (
                      <Link
                        key={f.id}
                        href={`/forms?form=${f.id}`}
                        className="inline-flex items-center rounded border px-2 py-1 font-mono text-xs transition-colors hover:border-primary hover:text-primary"
                        title={f.name}
                      >
                        {f.code}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-1.5">
                {entry.section.tags.map((t) => (
                  <Badge key={t} variant="outline" className="text-muted-foreground">
                    {t}
                  </Badge>
                ))}
              </div>

              <div className="border-t pt-4">
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={entry.section.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Read the bare section on India Code
                    <ExternalLink className="size-3.5" aria-hidden />
                  </Link>
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  Everything above is a paraphrase written for this toolkit, not the statutory
                  text. India Code is the official Government of India repository; it uses opaque
                  per-section ids, so this opens the Act rather than the individual section.
                </p>
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
      {children}
    </p>
  );
}
