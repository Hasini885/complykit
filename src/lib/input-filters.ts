/**
 * Keystroke filters for data entry. Each takes what the user typed or pasted
 * and returns what the field may hold, so impossible characters never get in
 * and fields stop at their real length. Validation still runs on save; this
 * only stops the obvious mistakes as they are made.
 */

/** Digits only, at most `max` of them. */
export function digitsOnly(value: string, max: number): string {
  return value.replace(/\D/g, "").slice(0, max);
}

/**
 * An Indian mobile, shown as "98765 43210". A pasted "+91 98765 43210" or
 * "098765 43210" keeps only the ten digits that matter.
 */
export function mobileInput(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length > 10 && digits.startsWith("0")) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  return digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
}

/** A CIN: 21 capital letters and digits. An LLPIN: "AAB-1234", 8 characters with the hyphen. */
export function cinInput(value: string, llp: boolean): string {
  const upper = value.toUpperCase();
  return llp ? upper.replace(/[^A-Z0-9-]/g, "").slice(0, 8) : upper.replace(/[^A-Z0-9]/g, "").slice(0, 21);
}

/** A DIN (or DPIN): eight digits. */
export function dinInput(value: string): string {
  return digitsOnly(value, 8);
}

/** An MCA SRN: capital letters and digits, up to 20. */
export function srnInput(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
}

/** A person's name: letters (any script), spaces and . ' - only, up to 100 characters. */
export function personNameInput(value: string): string {
  return value.replace(/[^\p{L}\p{M}\s.'-]/gu, "").replace(/\s{2,}/g, " ").slice(0, 100);
}

/** A company or firm name: letters, digits, spaces and & . , ( ) - ' / only, up to 200 characters. */
export function companyNameInput(value: string): string {
  return value.replace(/[^\p{L}\p{M}\p{N}\s&.,()'/-]/gu, "").replace(/\s{2,}/g, " ").slice(0, 200);
}

/** An email: no spaces, lower case, up to 254 characters. */
export function emailInput(value: string): string {
  return value.replace(/\s/g, "").toLowerCase().slice(0, 254);
}

/** Free text such as an address or a note, kept to a sensible length. */
export function textInput(value: string, max: number): string {
  return value.slice(0, max);
}

/** Rupee amounts: digits only, up to 15 (below ₹1,000 lakh crore). */
/** A rupee amount in Indian grouping for an input box, e.g. 1000000 → "10,00,000"; "" for none. */
export function indianAmount(value: number | null | undefined): string {
  if (!value || !Number.isFinite(value)) return "";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.trunc(value));
}

export function amountInput(value: string): number {
  const n = Number(digitsOnly(value, 15));
  return Number.isFinite(n) ? n : 0;
}
