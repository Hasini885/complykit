/**
 * Email validation for the alerts signup.
 *
 * Deliberately permissive rather than RFC-complete: the cost of rejecting a
 * real address is a lost lead, and Kit does the authoritative check anyway.
 * This exists to catch typos and obvious rubbish before a network round trip.
 */

const EMAIL = /^[^\s@,;]+@[^\s@.,;]+(\.[^\s@.,;]+)+$/;

export type EmailCheck = { ok: true; email: string } | { ok: false; reason: string };

export function checkEmail(raw: string): EmailCheck {
  const email = raw.trim().toLowerCase();

  if (email === "") return { ok: false, reason: "Enter your email address." };
  if (email.length > 254) return { ok: false, reason: "That address is too long." };
  if (!email.includes("@")) return { ok: false, reason: "That address is missing an @." };
  if (!EMAIL.test(email)) return { ok: false, reason: "That does not look like an email address." };

  const [local, domain] = email.split("@");
  if (local.length > 64) return { ok: false, reason: "That address is too long before the @." };
  if (domain.endsWith("-") || domain.startsWith("-")) {
    return { ok: false, reason: "That does not look like an email address." };
  }

  return { ok: true, email };
}
