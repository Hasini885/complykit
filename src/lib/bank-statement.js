export const BANKS = [
  [
    "India — Public sector",
    [
      "State Bank of India (SBI)",
      "Punjab National Bank (PNB)",
      "Bank of Baroda",
      "Canara Bank",
      "Union Bank of India",
      "Bank of India",
      "Indian Bank",
      "Central Bank of India",
      "Indian Overseas Bank",
      "UCO Bank",
      "Bank of Maharashtra",
      "Punjab & Sind Bank",
      "IDBI Bank",
    ],
  ],
  [
    "India — Private",
    [
      "HDFC Bank",
      "ICICI Bank",
      "Axis Bank",
      "Kotak Mahindra Bank",
      "Yes Bank",
      "IndusInd Bank",
      "IDFC FIRST Bank",
      "Federal Bank",
      "South Indian Bank",
      "Karnataka Bank",
      "Karur Vysya Bank",
      "City Union Bank",
      "RBL Bank",
      "Bandhan Bank",
      "DCB Bank",
      "CSB Bank",
      "Dhanlaxmi Bank",
      "Tamilnad Mercantile Bank",
      "Jammu & Kashmir Bank",
      "Nainital Bank",
    ],
  ],
  [
    "India — Small finance, payments, gramin, co-op",
    [
      "AU Small Finance Bank",
      "Equitas Small Finance Bank",
      "Ujjivan Small Finance Bank",
      "Jana Small Finance Bank",
      "Suryoday Small Finance Bank",
      "Paytm Payments Bank",
      "India Post Payments Bank (IPPB)",
      "Airtel Payments Bank",
      "Fino Payments Bank",
      "Andhra Pradesh Grameena Vikas Bank",
      "Telangana Grameena Bank",
      "Kerala Gramin Bank",
      "Karnataka Grameena Bank",
      "Saraswat Co-operative Bank",
      "Cosmos Co-operative Bank",
      "Bharat Co-operative Bank",
      "Other Co-operative / Gramin bank",
    ],
  ],
  [
    "India — Foreign banks",
    [
      "Standard Chartered Bank",
      "HSBC India",
      "Citibank India",
      "DBS Bank India",
      "Deutsche Bank India",
      "Barclays India",
    ],
  ],
  [
    "USA / Canada",
    [
      "Chase",
      "Bank of America",
      "Wells Fargo",
      "Citibank (US)",
      "Capital One",
      "US Bank",
      "PNC Bank",
      "TD Bank",
      "Royal Bank of Canada (RBC)",
      "Scotiabank",
      "BMO",
    ],
  ],
  [
    "UK / Europe",
    [
      "Barclays",
      "Lloyds Bank",
      "NatWest",
      "HSBC UK",
      "Santander UK",
      "Monzo",
      "Revolut",
      "Deutsche Bank",
      "BNP Paribas",
      "ING",
    ],
  ],
  [
    "Middle East / Asia / Pacific",
    [
      "Emirates NBD",
      "Abu Dhabi Commercial Bank (ADCB)",
      "Mashreq Bank",
      "First Abu Dhabi Bank (FAB)",
      "Qatar National Bank",
      "DBS Singapore",
      "OCBC",
      "UOB",
      "Maybank",
      "Commonwealth Bank",
      "ANZ",
      "Westpac",
      "NAB",
    ],
  ],
  ["Not listed", ["Other bank (auto-detect layout)"]],
];

/** Banks that print dates month-first. */
export const MDY_BANKS = new Set([
  "Chase",
  "Bank of America",
  "Wells Fargo",
  "Citibank (US)",
  "Capital One",
  "US Bank",
  "PNC Bank",
  "TD Bank",
  "Royal Bank of Canada (RBC)",
  "Scotiabank",
  "BMO",
]);

/* ---------- PDF reading ---------- */

const MAX_PAGES = 200;

export async function extractStatementPages(file, password) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data, password: password || undefined });
  try {
    const doc = await task.promise;
    const pages = [];
    for (let p = 1; p <= Math.min(doc.numPages, MAX_PAGES); p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const items = [];
      for (const it of content.items) {
        if (!("str" in it) || !it.str.trim()) continue;
        const x = it.transform[4];
        const y = it.transform[5];
        const w = it.width || it.str.length * 4;
        const len = it.str.length;
        for (const m of it.str.matchAll(/\S+/g)) {
          const x0 = x + (w * (m.index ?? 0)) / len;
          const w0 = (w * m[0].length) / len;
          items.push({ s: m[0], x: x0, r: x0 + w0, c: x0 + w0 / 2, y });
        }
      }
      items.sort((a, b) => b.y - a.y || a.x - b.x);
      const lines = [];
      let cur = null;
      for (const it of items) {
        if (cur && Math.abs(it.y - cur.y) <= 3) cur.tk.push(it);
        else {
          cur = { y: it.y, tk: [it] };
          lines.push(cur);
        }
      }
      lines.forEach((l) => l.tk.sort((a, b) => a.x - b.x));
      pages.push(lines);
      page.cleanup();
    }
    return pages;
  } finally {
    await task.destroy();
  }
}

export const linesToText = (pages) =>
  pages.map((p, i) => `--- page ${i + 1} ---\n${p.map((l) => l.tk.map((t) => t.s).join(" ")).join("\n")}`).join("\n");

/* ---------- Numbers and dates ---------- */

const NUM_RE = /^[(-]?(?:₹|Rs\.?|\$|£|€)?\d[\d,]*\.\d{1,2}\)?(?:Dr|Cr|DR|CR)?\.?$/;
const isNum = (s) => NUM_RE.test(s);

function parseNum(s) {
  const neg = /^[(-]/.test(s);
  const suf = s.match(/(dr|cr)\.?$/i)?.[1]?.toLowerCase() ?? "";
  const v = parseFloat(s.replace(/(dr|cr)\.?$/i, "").replace(/[^\d.]/g, "")) || 0;
  return { v: neg ? -v : v, suf };
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

function mkDate(y, m, d) {
  let yy = +y;
  if (yy < 100) yy += 2000;
  const mm = +m;
  const dd = +d;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yy < 1990 || yy > 2100) return null;
  return `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

export function parseDateStr(s, order) {
  let m;
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) return mkDate(m[1], m[2], m[3]);
  if ((m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})$/))) {
    let a = +m[1];
    let b = +m[2];
    if (order === "mdy") {
      if (a > 12 && b <= 12) [a, b] = [b, a];
      return mkDate(m[3], a, b);
    }
    if (b > 12 && a <= 12) return mkDate(m[3], b, a);
    return mkDate(m[3], b, a);
  }
  if ((m = s.match(/^(\d{1,2})[\s\-/.]+([A-Za-z]{3,9})[\s\-/.,]+(\d{2}|\d{4})$/))) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    return mo ? mkDate(m[3], mo, m[1]) : null;
  }
  if ((m = s.match(/^([A-Za-z]{3,9})[\s\-/.]+(\d{1,2}),?[\s\-/.]+(\d{4})$/))) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
    return mo ? mkDate(m[3], mo, m[2]) : null;
  }
  return null;
}

function matchDate(tk, i, order) {
  if (!tk[i]) return null;
  let iso = parseDateStr(tk[i].s, order);
  if (iso) return { iso, n: 1 };
  if (tk[i + 2]) {
    iso = parseDateStr(`${tk[i].s} ${tk[i + 1].s} ${tk[i + 2].s}`, order);
    if (iso) return { iso, n: 3 };
  }
  return null;
}

function classifyHeader(t0) {
  const t = t0.toLowerCase().trim();
  if (/^(dr\s*\/\s*cr|cr\s*\/\s*dr)$/.test(t)) return "drcr";
  if (/value\s*d/.test(t)) return "vdate";
  if (/date/.test(t)) return "date";
  if (/withdraw|debit|\bdr\b/.test(t)) return "debit";
  if (/deposit|credit|\bcr\b/.test(t)) return "credit";
  if (/balance/.test(t)) return "balance";
  if (/chq|cheque|\bref|instrument|utr/.test(t)) return "ref";
  if (/narration|description|particulars|details|remarks|transaction/.test(t)) return "desc";
  if (/^amount/.test(t)) return "amount";
  return null;
}

function detectHeader(tk) {
  const groups = [];
  for (const t of tk) {
    const g = groups[groups.length - 1];
    if (g && t.x - g.r < 4.5) {
      g.s += " " + t.s;
      g.r = t.r;
    } else groups.push({ s: t.s, x: t.x, r: t.r });
  }
  const cols = {};
  for (const g of groups) {
    const k = classifyHeader(g.s);
    if (k && !cols[k]) cols[k] = { l: g.x, r: g.r, c: (g.x + g.r) / 2 };
  }
  const hasAmt = cols.debit || cols.credit || cols.amount;
  if (hasAmt && (cols.date || cols.desc) && Object.keys(cols).length >= 3) return cols;
  return null;
}

/* ---------- Statement parsing ---------- */

const STOP_RE =
  /closing balance|statement summary|page\s*\d+\s*(of|\/)|computer generated|registered office|end of statement|legends|\*\*\*/i;
const OPEN_RE = /opening balance|balance b\/?f|brought forward/i;
const KW_CR = /\b(cr|credit|deposit|received|refund|interest|salary|cashback|reversal)\b/i;

function addTokens(r, tk, cols) {
  r.withCols = !!cols;
  const numCols = cols ? ["debit", "credit", "balance", "amount"].filter((k) => cols[k]) : [];
  const minL = numCols.length ? Math.min(...numCols.map((k) => cols[k].l)) - 25 : Infinity;
  for (let i = 0; i < tk.length; i++) {
    const t = tk[i];
    const s = t.s;
    const inNumZone = !cols || t.r >= minL;
    if (/^(dr|cr)\.?$/i.test(s) && i > 0 && isNum(tk[i - 1].s) && (!cols || t.x >= minL)) {
      // A Dr/Cr suffix split into its own token belongs to the previous number.
      const suf = s.toLowerCase().slice(0, 2);
      if (cols) r.suf = suf;
      else if (r.nums.length) r.nums[r.nums.length - 1].suf = suf;
      continue;
    }
    if (isNum(s) && inNumZone) {
      const p = parseNum(s);
      if (cols) {
        let best = null;
        let bd = 1e9;
        for (const k of numCols) {
          const c = cols[k];
          const d = Math.min(Math.abs(t.c - c.c), Math.abs(t.r - c.r), Math.abs(t.x - c.l));
          if (d < bd) {
            bd = d;
            best = k;
          }
        }
        if (best === "debit") r.debit = Math.abs(p.v) || r.debit;
        else if (best === "credit") r.credit = Math.abs(p.v) || r.credit;
        else if (best === "balance") r.balance = p.suf === "dr" ? -p.v : p.v;
        else if (best === "amount") {
          r.amt = Math.abs(p.v);
          r.suf = p.suf || (p.v < 0 ? "dr" : "");
        }
      } else r.nums.push({ v: p.v, suf: p.suf });
      continue;
    }
    if (cols && t.x >= minL && /^(dr|cr|d|c)\.?$/i.test(s)) {
      if (!r.suf) r.suf = s.toLowerCase().startsWith("c") ? "cr" : "dr";
      continue;
    }
    if (cols?.ref && t.x >= cols.ref.l - 6 && t.c <= cols.ref.r + 8 && (!cols.desc || cols.ref.l > cols.desc.l))
      r.ref.push(s);
    else r.desc.push(s);
  }
}

export function parseStatement(pages, order) {
  let cols = null;
  let layoutSeen = null;
  let opening = null;
  const out = [];

  for (const lines of pages) {
    let cur = null;
    for (const ln of lines) {
      const tk = ln.tk;
      if (!tk.length) continue;
      const text = tk.map((t) => t.s).join(" ");
      const hdr = detectHeader(tk);
      if (hdr) {
        cols = layoutSeen = hdr;
        cur = null;
        continue;
      }
      if (OPEN_RE.test(text)) {
        const nums = tk.filter((t) => isNum(t.s));
        if (nums.length && opening === null) {
          const o = parseNum(nums[nums.length - 1].s);
          opening = o.suf === "dr" ? -o.v : o.v;
        }
        cur = null;
        continue;
      }
      let di = 0;
      let dm = matchDate(tk, 0, order);
      if (!dm && /^\d{1,6}$/.test(tk[0].s)) {
        dm = matchDate(tk, 1, order);
        di = 1;
      }
      if (dm) {
        if (STOP_RE.test(text)) {
          cur = null;
          continue;
        }
        let rest = tk.slice(di + dm.n);
        const v = matchDate(rest, 0, order);
        if (v) rest = rest.slice(v.n); // value date
        cur = {
          date: dm.iso,
          desc: [],
          ref: [],
          debit: 0,
          credit: 0,
          balance: null,
          amt: null,
          suf: "",
          withCols: false,
          nums: [],
        };
        out.push(cur);
        addTokens(cur, rest, cols);
      } else if (cur) {
        if (STOP_RE.test(text)) {
          cur = null;
          continue;
        }
        addTokens(cur, tk, cols);
      }
    }
  }

  let prev = opening;
  for (const r of out) {
    if (!r.withCols) {
      const nz = r.nums;
      if (nz.length >= 2) {
        const b = nz[nz.length - 1];
        r.balance = b.suf === "dr" ? -b.v : b.v;
        const a = nz.slice(0, -1).filter((x) => x.v !== 0);
        if (a.length) {
          r.amt = Math.abs(a[0].v);
          r.suf = a[0].suf;
        }
      } else if (nz.length === 1) {
        r.amt = Math.abs(nz[0].v);
        r.suf = nz[0].suf;
      }
    }
    if (r.amt !== null && !r.debit && !r.credit) {
      let dir = r.suf === "cr" ? "c" : r.suf === "dr" ? "d" : "";
      if (!dir && prev !== null && r.balance !== null) {
        const d = r.balance - prev;
        if (Math.abs(d - r.amt) < 0.011) dir = "c";
        else if (Math.abs(d + r.amt) < 0.011) dir = "d";
      }
      if (!dir) dir = KW_CR.test(r.desc.join(" ")) ? "c" : "d";
      if (dir === "c") r.credit = r.amt;
      else r.debit = r.amt;
    }
    if (r.balance !== null) prev = r.balance;
  }

  const NAMES = {
    date: "Date",
    vdate: "Value date",
    desc: "Description",
    ref: "Ref",
    debit: "Debit",
    credit: "Credit",
    balance: "Balance",
    amount: "Amount",
    drcr: "Dr/Cr",
  };
  const layout = layoutSeen
    ? Object.entries(layoutSeen)
        .sort((a, b) => a[1].l - b[1].l)
        .map((e) => NAMES[e[0]])
        .join(" · ")
    : "positional (no header found)";

  const rows = out
    .filter((r) => r.debit || r.credit || r.balance !== null)
    .map((r) => ({
      date: r.date,
      desc: r.desc.join(" ").replace(/\s+/g, " ").trim(),
      ref: r.ref.join(" ").trim(),
      debit: r.debit,
      credit: r.credit,
      balance: r.balance,
    }));
  return { rows, layout };
}

/* ---------- Formatting ---------- */

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fmtDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}-${MON[+m - 1]}-${y}`;
}
export const fmtAmt = (n) =>
  n ? n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
