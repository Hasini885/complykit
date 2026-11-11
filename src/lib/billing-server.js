import { createHmac, timingSafeEqual } from "node:crypto";
import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { get, put } from "@vercel/blob";

import { isAdminEmail } from "@/lib/admin-users";
import { formatDate } from "@/lib/dates";
import { EMPTY_CONFIG, accessFor, readConfig, readUserBilling, withPayment } from "@/lib/billing";

/**
 * Server-only half of billing: the price (private Blob file), Razorpay calls,
 * signature checks, and the paid-up date on the user (Clerk privateMetadata).
 * Never import this from a client component.
 */

const CONFIG_PATH = "config/billing.json";

export async function getBillingConfig() {
  try {
    const found = await get(CONFIG_PATH, { access: "private", useCache: false });
    if (!found || found.statusCode !== 200) return EMPTY_CONFIG;
    return readConfig(JSON.parse(await new Response(found.stream).text()));
  } catch {
    return EMPTY_CONFIG;
  }
}

export async function saveBillingConfig(config) {
  await put(CONFIG_PATH, JSON.stringify(config), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

/* ------------------------------------------------------------------ */
/* Razorpay                                                            */
/* ------------------------------------------------------------------ */

export function razorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function razorpayKeyId() {
  return process.env.RAZORPAY_KEY_ID ?? "";
}

async function razorpay(path, init) {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.description ?? `Razorpay ${res.status}`);
  return json;
}

export function createOrder(rupees, userId) {
  return razorpay("/orders", {
    method: "POST",
    body: JSON.stringify({
      amount: rupees * 100,
      currency: "INR",
      receipt: `yr_${userId.slice(-20)}_${Date.now().toString(36)}`,
      notes: { userId, plan: "yearly" },
    }),
  });
}

export function fetchPayment(paymentId) {
  return razorpay(`/payments/${encodeURIComponent(paymentId)}`);
}

export function fetchOrder(orderId) {
  return razorpay(`/orders/${encodeURIComponent(orderId)}`);
}

function safeEqualHex(a, b) {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Checkout's signature: HMAC-SHA256 of "order_id|payment_id" with the key secret. */
export function checkoutSignatureOk(orderId, paymentId, signature) {
  const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET ?? "")
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return safeEqualHex(expected, signature);
}

/** Webhook signature: HMAC-SHA256 of the raw body with the webhook secret. */
export function webhookSignatureOk(body, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  return safeEqualHex(createHmac("sha256", secret).update(body).digest("hex"), signature);
}

/* ------------------------------------------------------------------ */
/* Accounts                                                            */
/* ------------------------------------------------------------------ */

/** Whether charging is switched on: a price set and Razorpay configured. */
export function isEnforced(config) {
  return config.yearlyPrice > 0 && razorpayConfigured();
}

/** One account's subscription for the admin list, e.g. "Trial till 11 Dec 2026". */
export function planLabel(user, config) {
  const a = accessFor({
    createdAt: user.createdAt,
    billing: readUserBilling(user.privateMetadata),
    isAdmin: isAdminEmail(user.primaryEmailAddress?.emailAddress, process.env.ADMIN_EMAILS),
    enforced: isEnforced(config),
    now: Date.now(),
  });
  const on = (ms) => (ms ? formatDate(new Date(ms)) : "");
  switch (a.state) {
    case "admin":
      return "Admin";
    case "paid":
      return `Paid till ${on(a.paidUntil)}`;
    case "trial":
      return `Trial till ${on(a.trialEndsAt)}`;
    case "free":
      return "Free (charging off)";
    default:
      return a.paidUntil ? `Expired ${on(a.paidUntil)}` : `Trial ended ${on(a.trialEndsAt)}`;
  }
}

/** The signed-in user's access, or null when signed out. */
export async function currentAccess() {
  const user = await currentUser();
  if (!user) return null;
  const config = await getBillingConfig();
  const access = accessFor({
    createdAt: user.createdAt,
    billing: readUserBilling(user.privateMetadata),
    isAdmin: isAdminEmail(user.primaryEmailAddress?.emailAddress, process.env.ADMIN_EMAILS),
    enforced: isEnforced(config),
    now: Date.now(),
  });
  return { access, config };
}

/**
 * Credits a captured payment to its account, once. The amount must be at least
 * the price when the order was made (checked by the caller against the order).
 */
export async function creditPayment(userId, payment) {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const billing = readUserBilling(user.privateMetadata);
  const next = withPayment(
    billing,
    { paymentId: payment.id, orderId: payment.order_id, amount: Math.round(payment.amount / 100) },
    user.createdAt,
    Date.now(),
  );
  if (next.added) {
    await client.users.updateUserMetadata(userId, { privateMetadata: { billing: next.billing } });
  }
  return { paidUntil: next.billing.paidUntil };
}

/**
 * Checks a payment with Razorpay itself (never trusting the browser) and
 * credits it: captured, in rupees, for an order this app made for this user.
 */
export async function verifyAndCredit(paymentId, expectedUserId) {
  let payment = await fetchPayment(paymentId);
  if (payment.currency !== "INR") throw new Error("Unexpected currency.");
  const order = await fetchOrder(payment.order_id);
  const userId = order.notes?.userId;
  if (!userId || order.notes?.plan !== "yearly") throw new Error("That payment is not for this site.");
  if (expectedUserId && userId !== expectedUserId) throw new Error("That payment belongs to another account.");
  if (payment.amount < order.amount) throw new Error("The amount paid is less than the price.");
  // Accounts without auto-capture leave a payment "authorized": capture it, or it is refunded.
  if (payment.status === "authorized") {
    payment = await razorpay(`/payments/${encodeURIComponent(payment.id)}/capture`, {
      method: "POST",
      body: JSON.stringify({ amount: payment.amount, currency: "INR" }),
    });
  }
  if (payment.status !== "captured") throw new Error("The payment has not gone through yet.");
  return creditPayment(userId, payment);
}
