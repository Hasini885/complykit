/**
 * MCA Service Request Numbers.
 *
 * The format has changed over the years (V2 SRNs such as G12345678, V3 SRNs
 * such as AB1234567), so this checks only what every SRN has in common —
 * letters and digits, a sensible length, at least one digit — rather than
 * rejecting a real SRN in a format it does not know.
 */

export function normaliseSrn(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

/** A reason the SRN looks wrong, or null when it is acceptable. */
export function checkSrn(raw: string): string | null {
  const srn = normaliseSrn(raw);
  if (srn === "") return null;
  if (!/^[A-Z0-9]+$/.test(srn)) return "An SRN has only letters and numbers, e.g. AB1234567.";
  if (srn.length < 6 || srn.length > 20) return "That is not the length of an SRN, e.g. AB1234567.";
  if (!/\d/.test(srn)) return "An SRN includes numbers, e.g. AB1234567.";
  return null;
}
