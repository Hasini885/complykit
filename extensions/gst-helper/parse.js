/*
 * Reads GSTR-1 and GSTR-3B filing status for one month from the tables on
 * the GST portal's public Search Taxpayer page ("Show Filing Table").
 *
 * Works on plain data (each table's nearby heading text and its cells), so
 * it does not depend on the portal's exact markup, and can be tested.
 */
(function (root) {
  const MONTH_RE =
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/g;
  const MONTH_INDEX = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

  /** "2026-10" -> { m: 9, fyStart: 2026 }: the financial year runs April to March. */
  function target(month) {
    const [y, m] = month.split("-").map(Number);
    return { m: m - 1, fyStart: m >= 4 ? y : y - 1 };
  }

  /** Month numbers a period names; a quarter such as "July - September" covers all three. */
  function monthsIn(text) {
    const t = String(text).toLowerCase();
    const found = [];
    let x;
    MONTH_RE.lastIndex = 0;
    while ((x = MONTH_RE.exec(t))) found.push(MONTH_INDEX[x[1].slice(0, 3)]);
    if (found.length === 2 && /\s(-|–|to)\s|[a-z](-|–)[a-z]/.test(t)) {
      const [a, b] = found;
      const out = [];
      for (let i = a; ; i = (i + 1) % 12) {
        out.push(i);
        if (i === b || out.length > 12) break;
      }
      return out;
    }
    return found;
  }

  /** True when the text names no financial year, or names this one ("2026-2027" or "2026-27"). */
  function fyFits(text, fyStart) {
    const t = String(text).replace(/\s+/g, "");
    const years = t.match(/\b20\d{2}-(?:20)?\d{2}\b/g);
    if (!years) return true;
    return years.some((y) => y === `${fyStart}-${fyStart + 1}` || y === `${fyStart}-${String(fyStart + 1).slice(2)}`);
  }

  /** "g1", "g3b" or null: the return named last in the text (the nearest heading or tab). */
  function returnTypeOf(text) {
    const t = String(text).toUpperCase().replace(/\s+/g, "");
    const g3b = Math.max(t.lastIndexOf("GSTR-3B"), t.lastIndexOf("GSTR3B"));
    const g1 = Math.max(lastMatch(t, /GSTR-?1(?![0-9A-Z])/g), t.lastIndexOf("IFF"));
    if (g3b < 0 && g1 < 0) return null;
    return g3b > g1 ? "g3b" : "g1";
  }

  function lastMatch(t, re) {
    let at = -1;
    let x;
    while ((x = re.exec(t))) at = x.index;
    return at;
  }

  /**
   * tables: [{ context, rows: [[cell, ...], ...] }]
   * Returns { g1, g3b }, each { filed, date } when a row for the month was
   * found, or null when the table does not show that month.
   */
  function readFiling(tables, month) {
    const tg = target(month);
    const out = { g1: null, g3b: null };
    for (const table of tables) {
      const fromContext = returnTypeOf(table.context || "");
      for (const cells of table.rows) {
        const text = cells.join(" | ");
        const type = returnTypeOf(text) || fromContext;
        if (!type) continue;
        if (!monthsIn(text).includes(tg.m)) continue;
        if (!fyFits(text, tg.fyStart)) continue;
        const filed = /\bfiled\b/i.test(text) && !/not\s*filed/i.test(text);
        const date = (text.match(/\b\d{2}[/-]\d{2}[/-]\d{4}\b/) || [""])[0];
        // A filed row wins over another row for the same month that is not.
        if (!out[type] || (filed && !out[type].filed)) out[type] = { filed, date };
      }
    }
    return out;
  }

  root.cactGstParse = { readFiling, target, monthsIn, fyFits, returnTypeOf };
})(typeof globalThis !== "undefined" ? globalThis : this);
