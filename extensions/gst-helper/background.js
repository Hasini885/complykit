// Starts work when CA Compliance Tool asks for it:
//  - "start": saves the list of clients to check and opens Search Taxpayer;
//  - "login": keeps one client's user name and password for a moment (in
//    memory only) for login.js to fill in. The site opens the login tab itself,
//    so the portal opens even without this extension.
const SEARCH_URL = "https://services.gst.gov.in/services/searchtp";
const SITES = ["https://cacompliancetool.com", "https://www.cacompliancetool.com", "http://localhost:3000"];
const PORTAL = "https://services.gst.gov.in";
const LOGIN_TTL_MS = 3 * 60 * 1000;

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const origin = sender.url ? new URL(sender.url).origin : "";

  if (SITES.includes(origin) && msg?.type === "start") {
    const clients = Array.isArray(msg.clients) ? msg.clients : [];
    if (!/^\d{4}-\d{2}$/.test(msg.month) || clients.length === 0) return reply({ ok: false });
    chrome.storage.local.set({ job: { month: msg.month, clients, index: 0, site: origin } }, () => {
      chrome.tabs.create({ url: SEARCH_URL });
      reply({ ok: true });
    });
    return true;
  }

  if (SITES.includes(origin) && msg?.type === "login") {
    const user = String(msg.user ?? "").slice(0, 100);
    const pass = String(msg.pass ?? "").slice(0, 100);
    if (!user) return reply({ ok: false });
    // Session storage lives in memory only and is cleared when Chrome closes.
    chrome.storage.session.set({ login: { user, pass, at: Date.now() } }, () => reply({ ok: true }));
    return true;
  }

  // The login page takes the details once; they are deleted as they are handed over.
  if (origin === PORTAL && msg?.type === "take-login") {
    chrome.storage.session.get("login", ({ login }) => {
      chrome.storage.session.remove("login");
      reply(login && Date.now() - login.at < LOGIN_TTL_MS ? { user: login.user, pass: login.pass } : null);
    });
    return true;
  }
});
