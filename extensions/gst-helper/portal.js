// Runs on the GST portal's public Search Taxpayer page during a check.
// It fills the client's GSTIN; YOU type the captcha, click Search and then
// Show Filing Table. It reads the month's GSTR-1 / GSTR-3B status from the
// table for you to confirm, then moves to the next client.
const SEARCH_URL = "https://services.gst.gov.in/services/searchtp";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const visible = (el) => !!el && el.offsetParent !== null;

function setValue(el, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function findInput(test) {
  return [...document.querySelectorAll("input")].find(
    (el) => visible(el) && test(`${el.id} ${el.name} ${el.placeholder} ${el.getAttribute("aria-label") ?? ""}`.toLowerCase()),
  );
}

function monthLabel(m) {
  const [y, mo] = m.split("-");
  return `${MONTHS[+mo - 1]} ${y}`;
}

function fyLabel(m) {
  const { fyStart } = globalThis.cactGstParse.target(m);
  return `${fyStart}-${String(fyStart + 1).slice(2)}`;
}

/** Text just before a table (headings, the selected tab), to tell GSTR-1 from GSTR-3B. */
function contextOf(table) {
  let text = "";
  let el = table;
  for (let depth = 0; depth < 5 && el && text.length < 400; depth++) {
    let prev = el.previousElementSibling;
    while (prev && text.length < 400) {
      text = `${prev.innerText ?? ""} ${text}`;
      prev = prev.previousElementSibling;
    }
    el = el.parentElement;
  }
  const active = document.querySelector(".active a, li.active, [aria-selected='true']");
  return `${text.slice(-400)} ${active?.innerText ?? ""}`;
}

function readTables() {
  return [...document.querySelectorAll("table")].filter(visible).map((t) => ({
    context: contextOf(t),
    rows: [...t.rows].map((r) => [...r.cells].map((c) => (c.innerText ?? "").trim())),
  }));
}

async function main() {
  const { job } = await chrome.storage.local.get("job");
  if (!job || job.index >= job.clients.length) return;
  const client = job.clients[job.index];

  // Fill the GSTIN once the form is on the page, and put the cursor in the captcha.
  let tries = 0;
  const filler = setInterval(() => {
    const gstin = document.querySelector("#for_gstin") ?? findInput((s) => s.includes("gstin") || s.includes("uin"));
    if (gstin) {
      clearInterval(filler);
      setValue(gstin, client.gstin);
      const captcha = findInput((s) => s.includes("captcha"));
      if (captcha) captcha.focus();
    } else if (++tries > 40) clearInterval(filler);
  }, 500);

  panel(job, client);
}

function panel(job, client) {
  const box = document.createElement("div");
  box.style.cssText =
    "position:fixed;right:14px;bottom:14px;z-index:2147483647;width:320px;background:#101633;color:#eef1ff;border:1px solid #4f46e5;border-radius:14px;padding:14px 16px;font:13px/1.45 system-ui,Segoe UI,sans-serif;box-shadow:0 10px 30px #0008";
  const sel = (id) => `<select id="${id}" style="margin-left:6px;padding:3px 6px;border-radius:6px;background:#1b2350;color:#fff;border:1px solid #333c70"><option value="notfiled">Not Filed</option><option value="filed">Filed</option></select>`;
  const btn = (a, bg, label) =>
    `<button data-a="${a}" style="margin:8px 6px 0 0;padding:6px 11px;background:${bg};color:#fff;border:0;border-radius:8px;cursor:pointer;font:inherit">${label}</button>`;
  box.innerHTML = `
    <div style="opacity:.7;font-size:11px;letter-spacing:.08em">CA COMPLIANCE TOOL · ${job.index + 1} OF ${job.clients.length}</div>
    <b class="n" style="display:block;font-size:14px;margin-top:2px"></b>
    <div class="g" style="opacity:.8"></div>
    <ol style="margin:8px 0 6px 18px;padding:0;opacity:.85">
      <li>Type the captcha and click <b>Search</b>.</li>
      <li>Click <b>Show Filing Table</b>; pick FY <b>${fyLabel(job.month)}</b> if asked.</li>
      <li>Check the status below, then <b>Save &amp; Next</b>.</li>
    </ol>
    <div>GSTR-1: ${sel("g1")} <span class="d1" style="opacity:.7"></span></div>
    <div style="margin-top:4px">GSTR-3B: ${sel("g3b")} <span class="d3" style="opacity:.7"></span></div>
    <div class="msg" style="margin-top:6px;font-size:12px;color:#ffcf66"></div>
    ${btn("save", "#12805a", "Save &amp; Next")}${btn("read", "#4f46e5", "Read table")}${btn("skip", "#555d80", "Skip")}${btn("stop", "#a63245", "Stop")}`;
  box.querySelector(".n").textContent = client.name || client.gstin;
  box.querySelector(".g").textContent = `${client.gstin} · ${monthLabel(job.month)}`;
  document.body.appendChild(box);

  // What the user changed by hand is not overwritten by a later read.
  const touched = new Set();
  box.querySelectorAll("select").forEach((s) => s.addEventListener("change", () => touched.add(s.id)));

  function read() {
    const found = globalThis.cactGstParse.readFiling(readTables(), job.month);
    const show = (key, labelCls) => {
      const r = found[key];
      if (r && !touched.has(key)) box.querySelector(`#${key}`).value = r.filed ? "filed" : "notfiled";
      box.querySelector(labelCls).textContent = r ? (r.filed ? `read: filed ${r.date}` : "read: not filed") : "";
    };
    show("g1", ".d1");
    show("g3b", ".d3");
    const msg = box.querySelector(".msg");
    if (found.g1 || found.g3b) msg.textContent = "";
    else if (document.querySelectorAll("table").length > 0)
      msg.textContent = `${monthLabel(job.month)} not found in the table yet. Pick FY ${fyLabel(job.month)}, or set it by hand.`;
    return found;
  }

  let timer = null;
  new MutationObserver((changes) => {
    // The panel's own updates are not the portal's: ignore them, or reading would loop.
    if (changes.every((c) => box.contains(c.target))) return;
    clearTimeout(timer);
    timer = setTimeout(read, 500);
  }).observe(document.body, { childList: true, subtree: true });

  box.addEventListener("click", async (e) => {
    const a = e.target.dataset?.a;
    if (!a) return;
    if (a === "read") return void read();
    if (a === "stop") {
      await chrome.storage.local.remove("job");
      box.remove();
      return;
    }
    const { results = [] } = await chrome.storage.local.get("results");
    if (a === "save") {
      results.push({
        key: `${client.id}|${job.month}|${Date.now()}`,
        clientId: client.id,
        month: job.month,
        g1: box.querySelector("#g1").value,
        g3b: box.querySelector("#g3b").value,
      });
    }
    const next = { ...job, index: job.index + 1 };
    if (next.index < next.clients.length) {
      await chrome.storage.local.set({ results, job: next });
      location.href = SEARCH_URL;
    } else {
      await chrome.storage.local.set({ results });
      await chrome.storage.local.remove("job");
      box.innerHTML =
        '<b style="font-size:14px">All done.</b><div style="margin-top:4px;opacity:.85">The results are in Return Filing Status on CA Compliance Tool. You can close this tab.</div>';
    }
  });
}

main();
