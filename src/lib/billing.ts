/**
 * Subscriptions: a free month, then a yearly fee the site owner sets.
 *
 * Pure rules, tested on their own. Where things are kept:
 *  - the yearly price: a private Vercel Blob file (src/lib/billing-store.ts),
 *    set by an admin on the Admin → Users page;
 *  - each account's paid-up date and payments: the user's Clerk
 *    privateMetadata (readable and writable on the server only);
 *  - payments: Razorpay orders, verified on the server before anything is
 *    extended (src/app/api/billing/*).
 *
 * Nothing is enforced until the owner has set a price AND the Razorpay keys
 * are configured, so the site never locks people out with no way to pay.
 */

export const TRIAL_DAYS = 30;
export const PLAN_MONTHS = 12;

/** Paying went live this day: accounts older than this get their free month from here. */
export const BILLING_LAUNCH = "2026-11-11";

const DAY = 86_400_000;

export type BillingConfig = {
  /** Yearly price in whole rupees, GST included. 0 = not set. */
  yearlyPrice: number;
  updatedAt: number;
};

export const EMPTY_CONFIG: BillingConfig = { yearlyPrice: 0, updatedAt: 0 };

export type PaymentRecord = {
  paymentId: string;
  orderId: string;
  /** Rupees. */
  amount: number;
  paidAt: number;
  /** The paid-up date this payment produced. */
  paidUntil: number;
};

/** What is kept on the user (Clerk privateMetadata.billing). */
export type UserBilling = {
  paidUntil: number | null;
  payments: PaymentRecord[];
};

export type AccessState = "admin" | "free" | "trial" | "paid" | "expired";

export type Access = {
  state: AccessState;
  /** May the app be used. */
  allowed: boolean;
  trialEndsAt: number;
  paidUntil: number | null;
  /** Whole days left of the trial or paid period (0 when expired; null for admin / free). */
  daysLeft: number | null;
};

function launchMs(): number {
  const [y, m, d] = BILLING_LAUNCH.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** When the free month started: sign-up, or the launch day for older accounts. */
export function trialStart(createdAt: number): number {
  return Math.max(createdAt, launchMs());
}

export function trialEnd(createdAt: number): number {
  return trialStart(createdAt) + TRIAL_DAYS * DAY;
}

/** Adds whole months, keeping the day of the month where it exists. */
export function addMonths(ms: number, months: number): number {
  const d = new Date(ms);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d.getTime();
}

/**
 * The paid-up date after a payment: a year from whichever is later, today or
 * the current paid-up date (so paying early never loses days), and never
 * before the free month ends.
 */
export function extendPaidUntil(current: number | null, createdAt: number, now: number): number {
  const from = Math.max(now, current ?? 0, trialEnd(createdAt));
  return addMonths(from, PLAN_MONTHS);
}

export function accessFor(opts: {
  createdAt: number;
  billing: UserBilling | null;
  isAdmin: boolean;
  /** False until a price is set and Razorpay is configured: then nobody is charged. */
  enforced: boolean;
  now: number;
}): Access {
  const trialEndsAt = trialEnd(opts.createdAt);
  const paidUntil = opts.billing?.paidUntil ?? null;
  const days = (until: number) => Math.max(0, Math.ceil((until - opts.now) / DAY));
  if (opts.isAdmin) return { state: "admin", allowed: true, trialEndsAt, paidUntil, daysLeft: null };
  if (paidUntil !== null && paidUntil > opts.now) {
    return { state: "paid", allowed: true, trialEndsAt, paidUntil, daysLeft: days(paidUntil) };
  }
  if (trialEndsAt > opts.now) {
    return { state: "trial", allowed: true, trialEndsAt, paidUntil, daysLeft: days(trialEndsAt) };
  }
  if (!opts.enforced) return { state: "free", allowed: true, trialEndsAt, paidUntil, daysLeft: null };
  return { state: "expired", allowed: false, trialEndsAt, paidUntil, daysLeft: 0 };
}

/** Reads the billing kept on a user, tolerating anything malformed. */
export function readUserBilling(privateMetadata: Record<string, unknown> | null | undefined): UserBilling {
  const raw = (privateMetadata?.billing ?? null) as Partial<UserBilling> | null;
  const paidUntil = typeof raw?.paidUntil === "number" && Number.isFinite(raw.paidUntil) ? raw.paidUntil : null;
  const payments = Array.isArray(raw?.payments)
    ? raw.payments.filter(
        (p): p is PaymentRecord =>
          !!p && typeof p.paymentId === "string" && typeof p.orderId === "string" && typeof p.amount === "number",
      )
    : [];
  return { paidUntil, payments };
}

/** The user's billing after a verified payment; unchanged if that payment was already counted. */
export function withPayment(
  billing: UserBilling,
  payment: { paymentId: string; orderId: string; amount: number },
  createdAt: number,
  now: number,
): { billing: UserBilling; added: boolean } {
  if (billing.payments.some((p) => p.paymentId === payment.paymentId)) return { billing, added: false };
  const paidUntil = extendPaidUntil(billing.paidUntil, createdAt, now);
  return {
    added: true,
    billing: { paidUntil, payments: [...billing.payments, { ...payment, paidAt: now, paidUntil }] },
  };
}

/** A reason the price is not acceptable, or null. */
export function checkPrice(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return "Enter the price in whole rupees.";
  if (value < 1) return "The price must be at least ₹1.";
  if (value > 500_000) return "That price is too high (limit ₹5,00,000).";
  return null;
}

export function readConfig(raw: unknown): BillingConfig {
  const r = (raw ?? {}) as Partial<BillingConfig>;
  return {
    yearlyPrice: typeof r.yearlyPrice === "number" && checkPrice(r.yearlyPrice) === null ? r.yearlyPrice : 0,
    updatedAt: typeof r.updatedAt === "number" ? r.updatedAt : 0,
  };
}
