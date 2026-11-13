import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

import manifest from "@/app/manifest";

const m = manifest();

test("manifest has what browsers need to offer Install", () => {
  assert.equal(m.display, "standalone");
  assert.ok(m.name && m.short_name && m.start_url);
  const sizes = m.icons.map((i) => i.sizes);
  assert.ok(sizes.includes("192x192") && sizes.includes("512x512"));
  assert.ok(m.icons.some((i) => i.purpose === "maskable"));
});

test("every icon, the service worker and the offline page exist", () => {
  for (const i of [...m.icons, ...m.shortcuts.flatMap((s) => s.icons)]) {
    assert.ok(existsSync(`public${i.src}`), i.src);
  }
  assert.ok(existsSync("public/sw.js"));
  assert.ok(existsSync("public/offline.html"));
  assert.ok(existsSync("src/app/apple-icon.png"));
});

test("service worker never caches pages or API calls", () => {
  const sw = readFileSync("public/sw.js", "utf8");
  assert.match(sw, /req\.mode === "navigate"[\s\S]*fetch\(req\)\.catch/);
  assert.doesNotMatch(sw, /\/api\//);
  assert.match(sw, /"\/offline\.html"/);
});

test("sign-in check lets the browser fetch the app files", () => {
  const proxy = readFileSync("src/proxy.js", "utf8");
  for (const ext of ["webmanifest", "png", "js(?!on)", "html?"]) assert.ok(proxy.includes(ext), ext);
});
