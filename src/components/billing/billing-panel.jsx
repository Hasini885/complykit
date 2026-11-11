"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import { toast } from "sonner";
import { CheckCircle2, CreditCard } from "lucide-react";

import { LiquidMetalButton } from "@/components/ui/liquid-metal-button";
import { site } from "@/config/site";
import { formatDate } from "@/lib/dates";
import { formatInr } from "@/lib/fees";
/** Loads Razorpay Checkout once. */
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const dateOf = (ms) => formatDate(new Date(ms));

const INCLUDED = [
  "All companies, directors and due dates",
  "Challan and MCA master data upload",
  "Reports, reminders and exports",
];

export function BillingPanel({ access, price, payable }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function confirm(r) {
    const v = await fetch("/api/billing/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(r),
    });
    const out = await v.json().catch(() => ({}));
    setBusy(false);
    if (v.ok) {
      toast.success("Payment received. Thank you!", {
        description: out.paidUntil ? `Subscribed until ${dateOf(out.paidUntil)}.` : undefined,
      });
      router.push("/dashboard");
      router.refresh();
    } else {
      toast.error(out.error ?? "The payment could not be verified.", {
        description: `If money was taken it will be credited automatically. Payment ID: ${r.razorpay_payment_id}`,
      });
    }
  }

  async function pay() {
    setBusy(true);
    try {
      if (!(await loadCheckout()) || !window.Razorpay) {
        toast.error("Could not load the payment window. Check your connection and try again.");
        setBusy(false);
        return;
      }
      const res = await fetch("/api/billing/order", { method: "POST" });
      const order = await res.json();
      if (!res.ok) {
        toast.error(order.error ?? "Could not start the payment.");
        setBusy(false);
        return;
      }
      const rzp = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: site.name,
        description: "Yearly subscription",
        prefill: order.prefill,
        theme: { color: "#7c6cf0" },
        modal: { ondismiss: () => setBusy(false) },
        handler: (r) => void confirm(r),
      });
      rzp.on("payment.failed", (r) => {
        toast.error(r.error?.description ?? "The payment failed. No money was taken.");
        setBusy(false);
      });
      rzp.open();
    } catch {
      toast.error("Could not start the payment.");
      setBusy(false);
    }
  }

  const days = access.daysLeft ?? 0;
  const status =
    access.state === "trial"
      ? `Free trial until ${dateOf(access.trialEndsAt)} (${days} day${days === 1 ? "" : "s"} left).`
      : access.state === "paid" && access.paidUntil
        ? `Subscribed until ${dateOf(access.paidUntil)}.`
        : access.state === "expired"
          ? `Your ${access.paidUntil ? "subscription" : "free month"} has ended. Subscribe to keep using ${site.name}; your saved companies are kept.`
          : access.state === "admin"
            ? "You are an admin: no subscription needed."
            : "Free for now.";

  return (
    <div className="space-y-4">
      <p
        className={`rounded-xl px-3 py-2 text-sm ${access.state === "expired" ? "bg-destructive/10 text-destructive" : "bg-muted/50"}`}
      >
        {status}
      </p>

      {price > 0 ? (
        <div className="rounded-2xl border p-4">
          <p className="text-sm text-muted-foreground">Yearly plan</p>
          <p className="font-heading text-3xl font-bold">
            {formatInr(price)}
            <span className="text-base font-medium text-muted-foreground"> / year</span>
          </p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {INCLUDED.map((t) => (
              <li key={t} className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-primary" aria-hidden /> {t}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {access.state === "admin" ? null : payable ? (
        <LiquidMetalButton
          label={
            access.state === "paid" ? `Renew for a year · ${formatInr(price)}` : `Pay ${formatInr(price)} for a year`
          }
          icon={<CreditCard className="size-4" aria-hidden />}
          busy={busy}
          onClick={pay}
          fullWidth
        />
      ) : (
        <p className="text-center text-sm text-muted-foreground">Payments are not open yet. Enjoy it free for now.</p>
      )}

      <p className="text-center text-[11px] text-muted-foreground">
        Secure payment by Razorpay: UPI, cards, netbanking and wallets. A paid year starts when your free month ends.
      </p>

      {!access.allowed ? (
        <SignOutButton>
          <button
            type="button"
            className="block w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            Sign out
          </button>
        </SignOutButton>
      ) : null}
    </div>
  );
}
