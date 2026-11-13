/*
 * CA Compliance Tool service worker (installed app and offline use).
 *
 * - Pages: always fetched fresh when online. A copy of each page is kept on
 *   this device, so with no internet the app still opens (your data is
 *   already in this browser). A page never opened shows the dashboard, or the
 *   offline page if even that was never opened.
 * - Next's build files, fonts, icons and templates are kept too.
 * - Never stored: API calls (/api), sign-in, anything from another site.
 * - Signing out clears the kept pages.
 */
const VERSION = "v2";
const STATIC = `cact-static-${VERSION}`;
const PAGES = `cact-pages-${VERSION}`;
const OFFLINE = "/offline.html";
const ASSET = /^\/(_next\/static\/|icons\/|brand\/|doc-templates\/)|\.(?:svg|png|jpe?g|webp|ico|woff2?)$/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC)
      .then((c) => c.addAll([OFFLINE, "/icons/icon-192.png", "/icons/icon-512.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith("cact-") && k !== STATIC && k !== PAGES).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** A page response worth keeping: a real page, not a redirect to sign-in. */
const keepable = (res) => res.ok && !res.redirected && res.type === "basic";

async function keepPage(path, res) {
  const cache = await caches.open(PAGES);
  await cache.put(path, res);
}

async function keepAsset(req, res) {
  if (!res.ok) return;
  const cache = await caches.open(STATIC);
  await cache.put(req, res);
}

async function page(req) {
  const path = new URL(req.url).pathname;
  try {
    const res = await fetch(req);
    if (keepable(res)) keepPage(path, res.clone());
    return res;
  } catch {
    const cache = await caches.open(PAGES);
    return (
      (await cache.match(path)) ||
      (await cache.match("/dashboard")) ||
      (await caches.match(OFFLINE)) ||
      Response.error()
    );
  }
}

async function asset(req) {
  const hit = await caches.match(req, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  keepAsset(req, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    event.respondWith(page(req));
    return;
  }
  if (ASSET.test(url.pathname)) event.respondWith(asset(req));
  // Everything else (page data for in-app clicks) goes to the network as usual;
  // if that fails offline, Next opens the page in full, which is served above.
});

/**
 * Messages from the site:
 *  - { type: "warm", paths }: keep a copy of these pages and their files now,
 *    so they open offline even if never visited on this device.
 *  - { type: "clear" }: signed out, forget the kept pages.
 */
self.addEventListener("message", (event) => {
  if (event.origin && event.origin !== self.location.origin) return;
  const msg = event.data || {};
  if (msg.type === "clear") {
    event.waitUntil(caches.delete(PAGES));
  } else if (msg.type === "warm" && Array.isArray(msg.paths)) {
    event.waitUntil(warm(msg.paths.filter((p) => typeof p === "string" && p.startsWith("/")).slice(0, 40)));
  }
});

async function warm(paths) {
  const files = new Set();
  for (const path of paths) {
    try {
      const res = await fetch(path, { credentials: "same-origin" });
      if (!keepable(res)) continue;
      const html = await res.clone().text();
      await keepPage(path, res);
      for (const m of html.matchAll(/["'](\/_next\/static\/[^"'?\s]+)["']/g)) files.add(m[1]);
    } catch {
      // Offline or failed: try again next time.
    }
  }
  const cache = await caches.open(STATIC);
  for (const f of files) {
    if (await cache.match(f)) continue;
    try {
      const res = await fetch(f);
      if (res.ok) await cache.put(f, res);
    } catch {
      // Skip.
    }
  }
}
