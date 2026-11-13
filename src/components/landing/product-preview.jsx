import {
  BellRing,
  Calculator,
  CheckCircle2,
  ClipboardList,
  FilePen,
  Landmark,
  ReceiptIndianRupee,
  ShieldCheck,
} from "lucide-react";

import { IconTile } from "@/components/shared/icon-tile";
import { cn } from "@/lib/utils";

/**
 * A static, illustrative miniature of the main dashboard for the landing hero:
 * the six tool boxes with sample live lines. Decorative only (the numbers are
 * placeholders), so it is hidden from assistive tech and described in one
 * sentence instead.
 */
const BOXES = [
  { icon: ReceiptIndianRupee, tint: "violet", title: "GST", line: "24 clients · 3 not filed", tone: "bad" },
  { icon: ShieldCheck, tint: "sky", title: "MCA", line: "12 companies · 2 overdue", tone: "warn" },
  { icon: Calculator, tint: "amber", title: "Late Fee", line: "Any ROC form or ITR" },
  { icon: Landmark, tint: "emerald", title: "Bank to Excel", line: "PDF in, Excel out" },
  { icon: FilePen, tint: "pink", title: "Documents", line: "Word or PDF" },
  { icon: ClipboardList, tint: "indigo", title: "Tasks", line: "8 pending · 1 overdue", tone: "warn" },
];

const TONE = {
  bad: "text-rose-600 dark:text-rose-400",
  warn: "text-amber-600 dark:text-amber-400",
};

export function ProductPreview({ className }) {
  return (
    <div className={cn("relative", className)}>
      <p className="sr-only">
        Preview of the CA Compliance Tool dashboard: six tool boxes for GST, MCA, late fees, bank statements, documents
        and tasks, each with a live summary.
      </p>
      <div aria-hidden className="relative">
        <div className="rounded-[2rem] border border-white/70 bg-card/90 p-3 shadow-lift backdrop-blur dark:border-white/10">
          <div className="mb-3 flex items-center gap-1.5 px-2 pt-1">
            <span className="size-2.5 rounded-full bg-rose-300" />
            <span className="size-2.5 rounded-full bg-amber-300" />
            <span className="size-2.5 rounded-full bg-emerald-300" />
            <span className="ml-3 h-5 flex-1 rounded-full bg-muted" />
          </div>

          <div className="rounded-3xl bg-background p-4">
            <p className="mb-3 px-1 font-heading text-lg font-bold">Dashboard</p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {BOXES.map((b) => (
                <div key={b.title} className="rounded-2xl border-2 border-dashed border-primary/25 p-3">
                  <IconTile icon={b.icon} tint={b.tint} size="sm" />
                  <p className="mt-2 text-sm font-bold">{b.title}</p>
                  <p className={cn("mt-0.5 truncate text-[10px] text-muted-foreground", b.tone && TONE[b.tone])}>
                    {b.line}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Floating notes */}
        <div className="absolute -top-9 -left-6 hidden items-center gap-2 rounded-2xl border bg-card px-3 py-2 shadow-lift sm:flex motion-safe:animate-[float_6s_ease-in-out_infinite]">
          <IconTile icon={BellRing} tint="pink" size="sm" />
          <span className="text-xs">
            <span className="block font-semibold">GSTR-3B due on the 20th</span>
            <span className="block text-muted-foreground">3 clients not filed yet</span>
          </span>
        </div>
        <div className="absolute -right-4 -bottom-6 hidden items-center gap-2 rounded-2xl border bg-card px-3 py-2 shadow-lift sm:flex motion-safe:animate-[float_7s_ease-in-out_1s_infinite]">
          <IconTile icon={ShieldCheck} tint="sky" size="sm" />
          <span className="text-xs">
            <span className="block font-semibold">AOC-4 filed</span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <CheckCircle2 className="size-3 text-emerald-500" /> Northwind Tech Ltd.
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
