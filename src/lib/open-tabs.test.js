import assert from "node:assert/strict";
import test from "node:test";

import { HOME_TAB, MAX_TABS, TAB_TITLES, closeTab, normalizeTabs, openTab, tabTitle } from "@/lib/open-tabs";

test("dashboard is always the first tab", () => {
  assert.deepEqual(normalizeTabs(null), [HOME_TAB]);
  assert.deepEqual(normalizeTabs(["/gst", "/dashboard", "/gst", 5, "bad"]), [HOME_TAB, "/gst"]);
});

test("opening a page adds a tab once, at the end", () => {
  let tabs = openTab([], "/gst");
  tabs = openTab(tabs, "/tasks");
  tabs = openTab(tabs, "/gst");
  assert.deepEqual(tabs, [HOME_TAB, "/gst", "/tasks"]);
});

test("sign-in and billing pages get no tab", () => {
  assert.deepEqual(openTab([HOME_TAB], "/sign-in/factor-one"), [HOME_TAB]);
  assert.deepEqual(openTab([HOME_TAB], "/billing"), [HOME_TAB]);
});

test("too many tabs drops the oldest, never the dashboard", () => {
  let tabs = [];
  for (let i = 0; i < MAX_TABS + 2; i++) tabs = openTab(tabs, `/p${i}`);
  assert.equal(tabs.length, MAX_TABS);
  assert.equal(tabs[0], HOME_TAB);
  assert.equal(tabs[tabs.length - 1], `/p${MAX_TABS + 1}`);
  assert.ok(!tabs.includes("/p0"));
});

test("closing the open tab moves right, else left", () => {
  const tabs = [HOME_TAB, "/gst", "/tasks", "/mca"];
  assert.deepEqual(closeTab(tabs, "/tasks", "/tasks"), { tabs: [HOME_TAB, "/gst", "/mca"], go: "/mca" });
  assert.deepEqual(closeTab(tabs, "/mca", "/mca"), { tabs: [HOME_TAB, "/gst", "/tasks"], go: "/tasks" });
  assert.deepEqual(closeTab(tabs, "/gst", "/mca").go, null);
});

test("the dashboard tab cannot be closed", () => {
  assert.deepEqual(closeTab([HOME_TAB, "/gst"], HOME_TAB, HOME_TAB), { tabs: [HOME_TAB, "/gst"], go: null });
});

test("tab titles come from the page names, the menu, then the closest parent, then the path", () => {
  const items = [
    { title: "Client Register", href: "/gst" },
    { title: "Return Filing Status", href: "/gst/returns" },
  ];
  assert.equal(tabTitle("/gst/returns", items), "GST Return Filing Status");
  assert.equal(tabTitle("/mca", items), "MCA Dashboard");
  assert.equal(tabTitle("/gst/some-page", items), "Client Register · Some Page");
  assert.equal(tabTitle("/admin/other-page", items), "Admin · Other Page");
});

test("every app page has a tab name", async () => {
  const { readdirSync } = await import("node:fs");
  const { join, relative, sep } = await import("node:path");
  const root = join(process.cwd(), "src", "app", "(app)");
  const pages = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(dir, e.name));
      else if (e.name === "page.jsx") pages.push(`/${relative(root, dir).split(sep).join("/")}`);
    }
  };
  walk(root);
  const missing = pages.filter((p) => !TAB_TITLES[p]);
  assert.deepEqual(missing, []);
});
