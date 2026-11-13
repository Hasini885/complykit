// Runs on CA Compliance Tool. Passes "check these clients" and "log in as
// this client" from the page to the extension, and hands results back.
const GSTIN = /^[0-9A-Z]{15}$/;

window.addEventListener("message", (e) => {
  if (e.source !== window || e.origin !== location.origin) return;
  const d = e.data;
  if (!d || typeof d !== "object") return;

  if (d.type === "cact-gst-ping") window.postMessage({ type: "cact-gst-pong" }, location.origin);

  if (d.type === "cact-gst-start" && /^\d{4}-\d{2}$/.test(d.month) && Array.isArray(d.clients)) {
    const clients = d.clients
      .filter((c) => c && typeof c.id === "string" && GSTIN.test(c.gstin))
      .slice(0, 500)
      .map((c) => ({ id: c.id.slice(0, 100), gstin: c.gstin, name: String(c.name ?? "").slice(0, 200) }));
    chrome.runtime.sendMessage({ type: "start", month: d.month, clients });
  }

  if (d.type === "cact-gst-login" && typeof d.user === "string" && d.user) {
    chrome.runtime.sendMessage({ type: "login", user: d.user.slice(0, 100), pass: String(d.pass ?? "").slice(0, 100) });
  }

  if (d.type === "cact-gst-ready") deliver();

  if (d.type === "cact-gst-ack" && Array.isArray(d.keys)) {
    chrome.storage.local.get("results", ({ results = [] }) => {
      chrome.storage.local.set({ results: results.filter((r) => !d.keys.includes(r.key)) });
    });
  }
});

function deliver() {
  chrome.storage.local.get("results", ({ results = [] }) => {
    if (results.length) window.postMessage({ type: "cact-gst-results", results }, location.origin);
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.results) deliver();
});
