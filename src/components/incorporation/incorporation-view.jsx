"use client";

import * as React from "react";
import { Building2, Check, Handshake, Layers, LayoutGrid, ListChecks, Scale, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import {
  COMPARISON_ROWS,
  DOCUMENT_COLUMNS,
  ENTITY_TYPE_CARDS,
  FILLIP_STEPS,
  SPICE_PLUS_STEPS,
} from "@/data/incorporation";
import { cn } from "@/lib/utils";

export function IncorporationView() {
  const [process, setProcess] = React.useState("company");
  const steps = process === "company" ? SPICE_PLUS_STEPS : FILLIP_STEPS;

  return (
    <div className="space-y-12">
      <PageHeader
        icon={LayoutGrid}
        eyebrow="Incorporation & Registration Toolkit"
        title="Start a New Company or LLP"
        lede="Compare entity types, follow the official MCA SPICe+ / FiLLiP process step-by-step, and gather every document needed — all in one guided workspace."
      />

      {/* Section 1 */}
      <section>
        <SectionHeading icon={Scale} title="Choose the right structure" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ENTITY_TYPE_CARDS.map((e) => (
            <div key={e.id} className="relative rounded-lg border bg-card p-4">
              {e.popular ? (
                <Badge className="absolute right-3 top-3 gap-1 text-[10px]">
                  <Star className="size-2.5" aria-hidden /> Popular
                </Badge>
              ) : null}
              <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Building2 className="size-4" aria-hidden />
              </span>
              <h3 className="mt-3 font-heading text-base font-semibold">{e.title}</h3>
              <p className="mt-1.5 text-xs text-muted-foreground">{e.description}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {e.statPills.map((p) => (
                  <Badge key={p} variant="outline" className="text-[10px]">
                    {p}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 2 */}
      <section>
        <SectionHeading icon={Layers} title="Compare at a glance" />
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entity</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Directors</TableHead>
                <TableHead>Min capital</TableHead>
                <TableHead>Statutory audit</TableHead>
                <TableHead>Best for</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {COMPARISON_ROWS.map((r) => (
                <TableRow key={r.entityId}>
                  <TableCell className="align-top font-medium">{r.entity}</TableCell>
                  <TableCell className="align-top text-sm">{r.members}</TableCell>
                  <TableCell className="align-top text-sm">{r.directors}</TableCell>
                  <TableCell className="align-top text-sm">{r.minCapital}</TableCell>
                  <TableCell className="align-top text-sm">{r.statutoryAudit}</TableCell>
                  <TableCell className="align-top max-w-xs text-xs text-muted-foreground">{r.bestFor}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Section 3 */}
      <section>
        <SectionHeading icon={ListChecks} title="The registration process" />

        <div className="mb-5 inline-flex rounded-md border p-0.5">
          <Button size="sm" variant={process === "company" ? "default" : "ghost"} onClick={() => setProcess("company")}>
            <Building2 className="size-4" aria-hidden /> Company (SPICe+)
          </Button>
          <Button size="sm" variant={process === "llp" ? "default" : "ghost"} onClick={() => setProcess("llp")}>
            <Handshake className="size-4" aria-hidden /> LLP (FiLLiP)
          </Button>
        </div>

        <ProcessSteps key={process} steps={steps} />
      </section>

      {/* Section 4 */}
      <section>
        <SectionHeading icon={ListChecks} title="Documents you'll need" />
        <div className="grid gap-4 md:grid-cols-3">
          {DOCUMENT_COLUMNS.map((col) => (
            <div key={col.id} className="rounded-lg border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">{col.title}</h3>
              <ul className="space-y-2">
                {col.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProcessSteps({ steps }) {
  const [activeStep, setActiveStep] = React.useState(0);

  return (
    <>
      {/* Stepper */}
      <div className="mb-6 overflow-x-auto pb-2">
        <ol className="flex min-w-max items-center">
          {steps.map((s, i) => (
            <li key={s.id} className="flex items-center">
              <button
                type="button"
                onClick={() => setActiveStep(i)}
                className="flex flex-col items-center gap-1.5 px-2"
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                    i === activeStep
                      ? "bg-primary text-primary-foreground"
                      : i < activeStep
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {i + 1}
                </span>
                <span
                  className={cn(
                    "w-20 text-center text-[10px] leading-tight",
                    i === activeStep ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  {s.title}
                </span>
              </button>
              {i < steps.length - 1 ? (
                <span className={cn("h-px w-6 shrink-0", i < activeStep ? "bg-primary" : "bg-border")} aria-hidden />
              ) : null}
            </li>
          ))}
        </ol>
      </div>

      {/* Accordion, expanded to the active step */}
      <Accordion
        type="single"
        collapsible
        value={steps[activeStep]?.id}
        onValueChange={(v) => {
          const i = steps.findIndex((s) => s.id === v);
          if (i >= 0) setActiveStep(i);
        }}
        className="rounded-lg border"
      >
        {steps.map((s, i) => (
          <AccordionItem key={s.id} value={s.id} className="px-4">
            <AccordionTrigger className="text-sm">
              <span className="flex items-center gap-2">
                <span className="tabular font-mono text-xs text-muted-foreground">{i + 1}.</span>
                {s.title}
              </span>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">{s.detail}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </>
  );
}

function SectionHeading({ icon: Icon, title }) {
  return (
    <div className="mb-4 flex items-center gap-2 border-b pb-3">
      <Icon className="size-4 text-primary" aria-hidden />
      <h2 className="font-heading text-xl font-semibold">{title}</h2>
    </div>
  );
}
