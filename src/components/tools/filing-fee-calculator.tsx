"use client";

import * as React from "react";
import { IndianRupee } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NORMAL_FEE_BANDS, NO_SHARE_CAPITAL_FEE, formatInr, normalFeeBand } from "@/lib/fees";

type Entity = "with-capital" | "without-capital";

/**
 * The normal, on-time MCA filing fee — the standalone version of the table
 * also used inside the late-fee calculator.
 *
 * LLP filing fees follow a different, per-form flat-fee schedule rather than
 * the share-capital slab below, and are not modelled here to avoid guessing
 * at figures this project has not verified — see the note under the result.
 */
export function FilingFeeCalculator() {
  const [entity, setEntity] = React.useState<Entity>("with-capital");
  const [capital, setCapital] = React.useState("1000000");

  const capitalValue = Number(capital.replace(/[^\d]/g, "")) || 0;
  const band = normalFeeBand(capitalValue);
  const fee = entity === "with-capital" ? band.fee : NO_SHARE_CAPITAL_FEE;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-4 text-sm font-semibold">Entity</h3>
        <div className="space-y-4">
          <Field label="Entity">
            <Select value={entity} onValueChange={(v) => setEntity(v as Entity)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="with-capital">Company (by share capital)</SelectItem>
                <SelectItem value="without-capital">Company without share capital</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {entity === "with-capital" ? (
            <Field label="Nominal / authorised share capital (₹)">
              <Input
                inputMode="numeric"
                value={capital}
                onChange={(e) => setCapital(e.target.value)}
                className="tabular"
              />
            </Field>
          ) : null}

          <p className="text-xs text-muted-foreground">
            For companies without share capital, fee is {formatInr(NO_SHARE_CAPITAL_FEE)}.
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          <IndianRupee className="size-3.5" aria-hidden />
          Normal MCA filing fee
        </div>
        <p className="tabular mt-2 font-mono text-4xl font-bold">{formatInr(fee)}</p>

        <dl className="mt-4 space-y-2 border-t pt-3 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">Applicable slab</dt>
            <dd className="text-right">
              {entity === "with-capital" ? band.label : "No share capital"}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">Basis</dt>
            <dd className="text-right text-xs">
              Companies (Registration Offices and Fees) Rules, 2014
            </dd>
          </div>
        </dl>

      </div>

      <div className="lg:col-span-2">
        <details className="rounded-lg border">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
            The full slab table
          </summary>
          <ul className="space-y-1 border-t p-4 text-xs">
            {NORMAL_FEE_BANDS.map((b) => (
              <li key={b.label} className="flex justify-between gap-4">
                <span className="text-muted-foreground">{b.label}</span>
                <span className="tabular font-mono">{formatInr(b.fee)}</span>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}
