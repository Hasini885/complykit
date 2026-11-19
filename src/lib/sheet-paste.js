/** Turning text pasted from Excel into the values the sheets keep. */

/** "Filed" / "yes" → "filed"; "Quarterly" / "Q" / "QRMP" → "quarterly"; anything else → "notfiled" (pasted GST status). */
export function pastedFiled(v) {
  const t = String(v).trim();
  if (/^(quarterly|qtrly|qtr|q|qrmp)$/i.test(t)) return "quarterly";
  return /^(filed|yes|y|done|✓)$/i.test(t) ? "filed" : "notfiled";
}

/** "13-11-2026", "13/11/2026" or "2026-11-13" → "2026-11-13"; anything else → "" (for pasted dates). */
export function pastedDate(v) {
  const t = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
}
