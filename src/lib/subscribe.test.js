import assert from "node:assert/strict";
import test from "node:test";

import { checkEmail } from "@/lib/email";
import { POST } from "@/app/api/subscribe/route";

/* ---------------- validation ---------------- */

test("accepts ordinary addresses, normalised", () => {
  for (const [input, expected] of [
    ["a@b.co", "a@b.co"],
    ["  Person@Firm.CO.IN  ", "person@firm.co.in"],
    ["first.last+tag@sub.domain.org", "first.last+tag@sub.domain.org"],
    ["ca_office@firm-associates.in", "ca_office@firm-associates.in"],
  ]) {
    const r = checkEmail(input);
    assert.equal(r.ok, true, `should accept ${input}`);
    if (r.ok) assert.equal(r.email, expected, "trimmed and lower-cased");
  }
});

test("rejects the usual rubbish with a usable reason", () => {
  for (const bad of [
    "",
    "   ",
    "no-at-sign.com",
    "two@@at.com",
    "trailing@dot.",
    "@nolocal.com",
    "nodomain@",
    "spaces in@address.com",
    "comma,@address.com",
    "under_score@nodot",
  ]) {
    const r = checkEmail(bad);
    assert.equal(r.ok, false, `should reject ${JSON.stringify(bad)}`);
    if (!r.ok) {
      assert.ok(r.reason.length > 0);
      assert.ok(r.reason.endsWith("."), "reasons read as sentences");
    }
  }
});

test("rejects over-long addresses", () => {
  assert.equal(checkEmail(`${"a".repeat(65)}@b.co`).ok, false, "local part over 64");
  assert.equal(checkEmail(`${"a".repeat(250)}@b.co`).ok, false, "whole address over 254");
});

/* ---------------- route handler ---------------- */

const post = (body, raw) =>
  POST(
    new Request("http://localhost/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: raw ?? JSON.stringify(body),
    }),
  );

test("rejects a non-JSON body", async () => {
  const res = await post(null, "not json at all");
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /JSON/i);
});

test("rejects a missing or non-string email", async () => {
  for (const body of [{}, { email: 42 }, { email: null }]) {
    const res = await post(body);
    assert.equal(res.status, 400);
  }
});

test("rejects an invalid email before any network call", async () => {
  // The route must surface the validator's own reason, not a generic message.
  for (const bad of ["nope", "no-at-sign.com", "trailing@dot."]) {
    const res = await post({ email: bad });
    assert.equal(res.status, 400);
    const reason = checkEmail(bad);
    assert.equal(reason.ok, false);
    if (!reason.ok) assert.equal((await res.json()).error, reason.reason);
  }
});

test("honeypot submissions are accepted and discarded", async () => {
  // A filled hidden field means a bot. Return success so it learns nothing,
  // and do it before the config check so no upstream call is ever made.
  const res = await post({ email: "bot@spam.example", website: "http://spam" });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, status: "subscribed" });
});

test("says plainly when Kit is not configured, rather than faking success", async () => {
  const prevKey = process.env.KIT_API_KEY;
  const prevForm = process.env.KIT_FORM_ID;
  delete process.env.KIT_API_KEY;
  delete process.env.KIT_FORM_ID;
  try {
    const res = await post({ email: "person@firm.co.in" });
    assert.equal(res.status, 503, "must not be a 2xx");
    const data = await res.json();
    assert.equal(data.configured, false);
    assert.match(data.error, /KIT_API_KEY/);
    assert.notEqual(data.ok, true, "must never report success while unconfigured");
  } finally {
    if (prevKey !== undefined) process.env.KIT_API_KEY = prevKey;
    if (prevForm !== undefined) process.env.KIT_FORM_ID = prevForm;
  }
});

test("an upstream failure surfaces as an error, never as success", async () => {
  const prevKey = process.env.KIT_API_KEY;
  const prevForm = process.env.KIT_FORM_ID;
  const realFetch = globalThis.fetch;

  process.env.KIT_API_KEY = "test-key";
  process.env.KIT_FORM_ID = "123456";
  globalThis.fetch = async () => new Response("upstream said no", { status: 500 });

  try {
    const res = await post({ email: "person@firm.co.in" });
    assert.equal(res.status, 502);
    const data = await res.json();
    assert.notEqual(data.ok, true);
    assert.ok(!JSON.stringify(data).includes("test-key"), "must not leak the API key");
  } finally {
    globalThis.fetch = realFetch;
    if (prevKey === undefined) delete process.env.KIT_API_KEY;
    else process.env.KIT_API_KEY = prevKey;
    if (prevForm === undefined) delete process.env.KIT_FORM_ID;
    else process.env.KIT_FORM_ID = prevForm;
  }
});

test("a successful upstream call sends the right payload and reports success", async () => {
  const prevKey = process.env.KIT_API_KEY;
  const prevForm = process.env.KIT_FORM_ID;
  const realFetch = globalThis.fetch;

  process.env.KIT_API_KEY = "test-key";
  process.env.KIT_FORM_ID = "123456";

  let seenUrl = "";
  let seenBody = {};
  globalThis.fetch = async (url, init) => {
    seenUrl = String(url);
    seenBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ subscription: { id: 1 } }), { status: 200 });
  };

  try {
    const res = await post({ email: "  Person@Firm.CO.IN  " });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, status: "subscribed" });

    assert.ok(seenUrl.includes("/v3/forms/123456/subscribe"), `unexpected url: ${seenUrl}`);
    assert.equal(seenBody.api_key, "test-key");
    assert.equal(seenBody.email, "person@firm.co.in", "the normalised address is sent");
  } finally {
    globalThis.fetch = realFetch;
    if (prevKey === undefined) delete process.env.KIT_API_KEY;
    else process.env.KIT_API_KEY = prevKey;
    if (prevForm === undefined) delete process.env.KIT_FORM_ID;
    else process.env.KIT_FORM_ID = prevForm;
  }
});
