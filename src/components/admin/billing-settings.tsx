"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, CircleAlert, IndianRupee, Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TRIAL_DAYS } from "@/lib/billing";
import { formatInr } from "@/lib/fees";

function Item({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      {ok ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
      ) : (
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
      )}
      <span>{children}</span>
    </li>
  );
}

/**
 * The owner's subscription settings: the yearly price, and whether Razorpay is
 * connected. Charging starts only once both are in place.
 */
export function BillingSettings({
  yearlyPrice,
  razorpay,
  webhook,
}: {
  yearlyPrice: number;
  razorpay: boolean;
  webhook: boolean;
}) {
  const router = useRouter();
  const [price, setPrice] = React.useState(yearlyPrice > 0 ? String(yearlyPrice) : "");
  const [busy, setBusy] = React.useState(false);
  const live = yearlyPrice > 0 && razorpay;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/billing/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yearlyPrice: Number(price) }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(out.error ?? "Could not save the price.");
        return;
      }
      toast.success(`Yearly price set to ${formatInr(Number(price))}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5">
      <div>
        <h2 className="font-heading text-lg font-semibold">Subscription</h2>
        <p className="text-sm text-muted-foreground">
          Every account is free for {TRIAL_DAYS} days, then pays this price for a year by Razorpay.{" "}
          {live ? "Charging is on." : "Charging is off until both items below are done; nobody is blocked meanwhile."}
        </p>
      </div>

      <form onSubmit={save} className="flex flex-wrap items-end gap-2">
        <label className="space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Yearly price (₹, GST included)
          </span>
          <div className="relative">
            <IndianRupee className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              placeholder="e.g. 4999"
              className="w-44 pl-9 tabular"
            />
          </div>
        </label>
        <Button type="submit" disabled={busy || !price || Number(price) === yearlyPrice}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />} Save
        </Button>
      </form>

      <ul className="space-y-1.5 text-sm">
        <Item ok={yearlyPrice > 0}>
          {yearlyPrice > 0 ? `Price set: ${formatInr(yearlyPrice)} a year.` : "Set the yearly price above."}
        </Item>
        <Item ok={razorpay}>
          {razorpay
            ? "Razorpay connected."
            : "Connect Razorpay: add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Vercel → Settings → Environment Variables, then redeploy."}
        </Item>
        <Item ok={webhook}>
          {webhook
            ? "Webhook secret set: payments are credited even if the payer closes the tab."
            : "Recommended: in Razorpay → Webhooks, add https://<your site>/api/billing/webhook for payment.captured, and put its secret in RAZORPAY_WEBHOOK_SECRET."}
        </Item>
      </ul>
    </section>
  );
}
