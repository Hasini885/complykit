"use client";

import * as React from "react";
import { AlertTriangle, Scale } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { BEYOND_ROC_CATEGORIES, beyondRocItems } from "@/data/beyond-roc";
import { daysRemaining, extensionFor, resolveBeyondRocDue } from "@/lib/beyond-roc";
import { formatDate, today } from "@/lib/dates";
import { cn } from "@/lib/utils";

const FREQUENCY_TONE = {
  Monthly: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  Quarterly: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  "Half-yearly": "bg-teal-500/10 text-teal-700 dark:text-teal-400",
  Annual: "bg-primary/10 text-primary",
  "Event-driven": "bg-muted text-muted-foreground",
};

export function BeyondRocView() {
  const [category, setCategory] = React.useState("GST");
  const reference = React.useMemo(() => today(), []);

  const rows = React.useMemo(() => {
    return beyondRocItems
      .filter((i) => i.category === category)
      .map((item) => {
        const due = resolveBeyondRocDue(item.rule, reference);
        return { item, due, days: due ? daysRemaining(due, reference) : null };
      })
      .sort((a, b) => {
        if (a.due === null && b.due === null) return 0;
        if (a.due === null) return 1;
        if (b.due === null) return -1;
        return a.due.getTime() - b.due.getTime();
      });
  }, [category, reference]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Scale}
        eyebrow="Beyond Companies Act"
        badge="NEW"
        title="All-Regulator Compliance Calendar"
        lede="The other statutory deadlines every business juggles — GST, Income Tax & TDS, PF/ESI, SEBI LODR and FEMA/RBI — with live 'next due' dates. Applies only where you hold the relevant registration."
      />

      <Tabs value={category} onValueChange={(v) => setCategory(v)}>
        <TabsList className="flex-wrap">
          {BEYOND_ROC_CATEGORIES.map((c) => (
            <TabsTrigger key={c} value={c}>
              {c}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={category} className="mt-4">
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Form</TableHead>
                  <TableHead>Compliance</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Next due</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ item, due, days }) => (
                  <TableRow key={item.id}>
                    <TableCell className="align-top">
                      <Badge variant="outline" className="font-mono text-[11px]">
                        {item.formCode}
                      </Badge>
                    </TableCell>
                    <TableCell className="align-top">
                      <span className="font-medium">{item.title}</span>
                      {item.confidence === "review" ? (
                        <span
                          className="ml-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400"
                          title={item.note}
                        >
                          <AlertTriangle className="size-3" aria-hidden />
                          verify
                        </span>
                      ) : null}
                      {item.note ? (
                        <p className="mt-1 max-w-md text-xs whitespace-normal text-muted-foreground">{item.note}</p>
                      ) : null}
                      {extensionFor(item.rule, due) ? (
                        <p className="mt-1 max-w-md text-xs whitespace-normal text-sky-800 dark:text-sky-300">
                          Extended to {formatDate(due)} by {extensionFor(item.rule, due).source}.
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="align-top">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                          FREQUENCY_TONE[item.frequency],
                        )}
                      >
                        {item.frequency}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-xs align-top text-sm whitespace-normal text-muted-foreground">
                      {item.scheduleText}
                    </TableCell>
                    <TableCell className="align-top">
                      {due ? (
                        <span className="tabular font-mono text-sm">
                          {formatDate(due)}
                          <span
                            className={cn(
                              "ml-1.5 text-xs",
                              days !== null && days <= 7
                                ? "text-destructive"
                                : days !== null && days <= 30
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-muted-foreground",
                            )}
                          >
                            · {days}d
                          </span>
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Event-driven</span>
                      )}
                    </TableCell>
                    <TableCell className="align-top text-xs text-muted-foreground">{item.reference}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
