"use client";

import * as React from "react";
import { RotateCcw, SquareCheckBig } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tip } from "@/components/shared/tip";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PageHeader } from "@/components/page-header";
import { checklists, type Checklist } from "@/data/checklists";
import { clearChecklist, setChecklistItem, useChecklistState } from "@/lib/checklist-store";
import { cn } from "@/lib/utils";

export function ChecklistsView() {
  const [openId, setOpenId] = React.useState<string | null>(null);
  const open = checklists.find((c) => c.id === openId) ?? null;

  return (
    <>
      <PageHeader
        icon={SquareCheckBig}
        eyebrow="Compliance Checklists"
        title="Track Compliance, Item by Item"
        lede="Ready-made, expert checklists for every entity type. Tick items off as you complete them — your progress is saved automatically in this browser."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {checklists.map((c) => (
          <ChecklistCard key={c.id} checklist={c} onOpen={() => setOpenId(c.id)} />
        ))}
      </div>

      <ChecklistDetail checklist={open} onClose={() => setOpenId(null)} />
    </>
  );
}

function ChecklistCard({ checklist, onOpen }: { checklist: Checklist; onOpen: () => void }) {
  const state = useChecklistState(checklist.id);
  const done = checklist.items.filter((i) => state[i.id]).length;
  const total = checklist.items.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const Icon = checklist.icon;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col items-start rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-accent/40"
    >
      <div className="flex w-full items-start justify-between gap-2">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-4" aria-hidden />
        </span>
        <Badge variant="secondary" className="text-[10px]">
          {checklist.pill}
        </Badge>
      </div>

      <h2 className="mt-3 font-heading text-base font-semibold leading-snug">{checklist.title}</h2>
      <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{checklist.description}</p>

      <div className="mt-4 w-full">
        <div className="flex items-center justify-between text-xs">
          <span className="tabular font-mono text-muted-foreground">
            {done} / {total} done
          </span>
          <span className="tabular font-mono font-medium">{pct}%</span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              pct === 100 ? "bg-emerald-500" : "bg-primary",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </button>
  );
}

function ChecklistDetail({
  checklist,
  onClose,
}: {
  checklist: Checklist | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={checklist !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        {checklist ? <ChecklistDetailBody checklist={checklist} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function ChecklistDetailBody({ checklist }: { checklist: Checklist }) {
  const state = useChecklistState(checklist.id);
  const done = checklist.items.filter((i) => state[i.id]).length;
  const total = checklist.items.length;
  const Icon = checklist.icon;

  return (
    <>
      <SheetHeader className="border-b">
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="size-4" aria-hidden />
          </span>
          <Badge variant="secondary" className="text-[10px]">
            {checklist.pill}
          </Badge>
        </div>
        <SheetTitle className="font-heading text-xl">{checklist.title}</SheetTitle>
        <SheetDescription>{checklist.description}</SheetDescription>
      </SheetHeader>

      <div className="px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <span className="tabular font-mono text-sm text-muted-foreground">
            {done} / {total} done
          </span>
          <Tip label="Reset checklist">
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => clearChecklist(checklist.id)}
              aria-label="Reset checklist"
            >
              <RotateCcw className="size-3.5" aria-hidden />
            </Button>
          </Tip>
        </div>

        <ul className="mt-3 divide-y">
          {checklist.items.map((item) => {
            const checked = !!state[item.id];
            return (
              <li key={item.id} className="py-3">
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => setChecklistItem(checklist.id, item.id, e.target.checked)}
                    className="mt-0.5 size-4 shrink-0 accent-primary"
                  />
                  <span className="min-w-0">
                    <span
                      className={cn(
                        "block text-sm font-medium",
                        checked && "text-muted-foreground line-through",
                      )}
                    >
                      {item.text}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {item.detail}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
