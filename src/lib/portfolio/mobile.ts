/**
 * Indian mobile numbers, shared by the company master, the consultant master
 * and the director's authorised-person fields. Kept apart from those modules
 * so each can use it without importing the others.
 */

/**
 * An Indian mobile number reduced to its 10 digits: spaces, dashes and a
 * leading +91, 91 or 0 are dropped. Returns "" when what is left is not a
 * valid mobile (10 digits starting 6-9).
 */
export function normaliseMobile(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : "";
}

/** "98765 43210" — how a stored mobile is shown. */
export function formatMobile(digits: string): string {
  return digits.length === 10 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
}

export const MOBILE_ERROR = "Enter a 10-digit mobile number starting 6–9.";
