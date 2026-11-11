/**
 * The site owner's list of everyone who has created an account: name, mobile
 * and email (as given at sign-up), when they joined and last signed in.
 * Pure, so the rules are tested without Clerk.
 */

export type UserRow = {
  id: string;
  name: string;
  /** 10 digits, or "" for accounts made before the mobile was asked for. */
  mobile: string;
  email: string;
  /** ms since 1970. */
  joinedAt: number;
  lastSignInAt: number | null;
  /** Subscription, e.g. "Trial till 11 Dec 2026"; added by the admin page. */
  plan?: string;
};

/** The parts of a Clerk user this reads. */
export type ClerkUserLike = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  unsafeMetadata: Record<string, unknown>;
  primaryEmailAddressId: string | null;
  emailAddresses: { id: string; emailAddress: string }[];
  phoneNumbers?: { phoneNumber: string }[];
  createdAt: number;
  lastSignInAt: number | null;
};

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function toUserRow(u: ClerkUserLike): UserRow {
  const meta = u.unsafeMetadata ?? {};
  const email =
    u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress ?? u.emailAddresses[0]?.emailAddress ?? "";
  const name = text(meta.name) || [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  const mobile = text(meta.mobile) || (u.phoneNumbers?.[0]?.phoneNumber ?? "").replace(/^\+91/, "");
  return { id: u.id, name, mobile, email, joinedAt: u.createdAt, lastSignInAt: u.lastSignInAt };
}

/** Whether this email is one of the site owner's (ADMIN_EMAILS, comma separated). */
export function isAdminEmail(email: string | null | undefined, adminEmails: string | undefined): boolean {
  if (!email || !adminEmails) return false;
  const list = adminEmails.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}
