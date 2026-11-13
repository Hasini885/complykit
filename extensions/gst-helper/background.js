// Starts a check when CA Compliance Tool asks for one: saves the list of
// clients and opens the portal's public Search Taxpayer page.
const SEARCH_URL = "https://services.gst.gov.in/services/searchtp";
const SITES = ["https://cacompliancetool.com", "https://www.cacompliancetool.com", "http://localhost:3000"];

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const origin = sender.url ? new URL(sender.url).origin : "";
  if (!SITES.includes(origin) || msg?.type !== "start") return;
  const clients = Array.isArray(msg.clients) ? msg.clients : [];
  if (!/^\d{4}-\d{2}$/.test(msg.month) || clients.length === 0) return reply({ ok: false });
  chrome.storage.local.set({ job: { month: msg.month, clients, index: 0, site: origin } }, () => {
    chrome.tabs.create({ url: SEARCH_URL });
    reply({ ok: true });
  });
  return true;
});
