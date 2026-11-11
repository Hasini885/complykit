import assert from "node:assert/strict";
import test from "node:test";

import { GET, POST } from "./route";
import { emptyExtraction } from "@/lib/pdf-extraction";
import { geminiResponseSchema } from "@/lib/gemini-extraction";

/**
 * Only the branches reachable without a live AI API call are tested
 * here: input validation, size/type/magic-byte checks, and the missing-key
 * 503. The actual extraction call is exercised by hand with a real PDF and a
 * real key, per the plan agreed with the user -- there is no live credential
 * in this environment to test against.
 */

const post = (body, raw) =>
  POST(
    new Request("http://localhost/api/extract-company-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: raw ?? JSON.stringify(body),
    }),
  );

// A minimal but structurally valid one-page PDF, so "valid file, but not a
// real extractable document" is also exercisable without hitting the network
// once ANTHROPIC_API_KEY is unset (the key check happens before any parsing).
const MINIMAL_PDF_BASE64 = Buffer.from("%PDF-1.4\n%%EOF").toString("base64");

test("rejects a non-JSON body", async () => {
  const res = await post(null, "not json at all");
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /JSON/i);
});

test("rejects a missing or blank filename", async () => {
  for (const body of [{}, { filename: "" }, { filename: "   ", fileBase64: "x" }]) {
    const res = await post(body);
    assert.equal(res.status, 400);
  }
});

test("rejects a filename that isn't a .pdf", async () => {
  const res = await post({ filename: "company.docx", fileBase64: MINIMAL_PDF_BASE64 });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /PDF/i);
});

test("accepts .pdf case-insensitively", async () => {
  // Gets past the filename check; will fail later on the missing API key,
  // which is fine -- this only asserts the extension check itself.
  const res = await post({ filename: "Company.PDF", fileBase64: MINIMAL_PDF_BASE64 });
  assert.notEqual(res.status, 400);
});

test("rejects a missing or empty fileBase64", async () => {
  for (const body of [{ filename: "x.pdf" }, { filename: "x.pdf", fileBase64: "" }]) {
    const res = await post(body);
    assert.equal(res.status, 400);
  }
});

test("rejects a file over the 10MB cap before ever touching the network", async () => {
  // One byte over 10MB, base64-encoded. Content doesn't matter -- this must
  // be rejected on size alone.
  const oversized = Buffer.alloc(10 * 1024 * 1024 + 1, 0x41).toString("base64");
  const res = await post({ filename: "big.pdf", fileBase64: oversized });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /large|10MB/i);
});

test("rejects a file that is not actually a PDF, even with a .pdf name", async () => {
  const notAPdf = Buffer.from("this is just plain text, not a pdf").toString("base64");
  const res = await post({ filename: "fake.pdf", fileBase64: notAPdf });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /valid PDF/i);
});

test("accepts a data: URL prefix on fileBase64, stripping it before decoding", async () => {
  const withPrefix = `data:application/pdf;base64,${MINIMAL_PDF_BASE64}`;
  const res = await post({ filename: "x.pdf", fileBase64: withPrefix });
  // Passes every validation step; fails only on the missing key below.
  assert.equal(res.status, 503);
});

test("says plainly when no AI key is configured, rather than faking success", async () => {
  const prevKey = process.env.ANTHROPIC_API_KEY;
  const prevGemini = process.env.GEMINI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const res = await post({ filename: "company.pdf", fileBase64: MINIMAL_PDF_BASE64 });
    assert.equal(res.status, 503, "must not be a 2xx");
    const data = await res.json();
    assert.equal(data.configured, false);
    assert.match(data.error, /GEMINI_API_KEY or ANTHROPIC_API_KEY/);
    assert.notEqual(data.ok, true, "must never report success while unconfigured");
  } finally {
    if (prevKey !== undefined) process.env.ANTHROPIC_API_KEY = prevKey;
    if (prevGemini !== undefined) process.env.GEMINI_API_KEY = prevGemini;
  }
});

test("validation runs before the API-key check, so a bad file never reaches billing", async () => {
  const prevKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "sk-ant-test-key-not-real";
  try {
    const res = await post({ filename: "notes.txt", fileBase64: MINIMAL_PDF_BASE64 });
    assert.equal(res.status, 400, "extension check must fire before any API key is even read");
  } finally {
    if (prevKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = prevKey;
  }
});

/* ---------------- Gemini (network stubbed) ---------------- */

/** Runs `fn` with GEMINI_API_KEY set and fetch answering with `reply`. */
async function withGemini(reply, fn) {
  const prevKey = process.env.GEMINI_API_KEY;
  const prevFetch = globalThis.fetch;
  const calls = [];
  process.env.GEMINI_API_KEY = "gemini-test-key-not-real";
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, body: JSON.parse(String(init?.body)), headers: new Headers(init?.headers) });
    return reply(url, init ?? {});
  };
  try {
    await fn(calls);
  } finally {
    globalThis.fetch = prevFetch;
    if (prevKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prevKey;
  }
}

const interaction = (text) => Response.json({ steps: [{ content: [{ type: "text", text }] }] });

test("with GEMINI_API_KEY set, the PDF goes to Gemini and its JSON fills the result", async () => {
  const extracted = { ...emptyExtraction(), companyName: "Bluefin Analytics Private Limited", paidUpCapital: 100000 };
  await withGemini(
    () => interaction(JSON.stringify(extracted)),
    async (calls) => {
      const res = await post({ filename: "coi.pdf", fileBase64: MINIMAL_PDF_BASE64 });
      assert.equal(res.status, 200);
      assert.deepEqual((await res.json()).data, extracted);

      assert.equal(calls.length, 1);
      assert.match(calls[0].url, /generativelanguage\.googleapis\.com\/v1beta\/interactions$/);
      assert.equal(calls[0].headers.get("x-goog-api-key"), "gemini-test-key-not-real");
      const input = calls[0].body.input;
      assert.equal(input[0].type, "document");
      assert.equal(input[0].mime_type, "application/pdf");
      assert.equal(input[0].data, MINIMAL_PDF_BASE64);
      const format = calls[0].body.response_format;
      assert.equal(format.mime_type, "application/json");
    },
  );
});

test("Gemini is preferred over Claude when both keys are set", async () => {
  const prevAnthropic = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "sk-ant-test-key-not-real";
  try {
    await withGemini(
      () => interaction(JSON.stringify(emptyExtraction())),
      async (calls) => {
        await post({ filename: "coi.pdf", fileBase64: MINIMAL_PDF_BASE64 });
        assert.equal(calls.length, 1, "the request went to Gemini");
        const status = await (await GET()).json();
        assert.deepEqual(status, { configured: true, provider: "gemini" });
      },
    );
  } finally {
    if (prevAnthropic === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = prevAnthropic;
  }
});

test("a reply that does not match the schema is rejected, not passed to the form", async () => {
  await withGemini(
    () => interaction(JSON.stringify({ companyName: 42 })),
    async () => {
      const res = await post({ filename: "coi.pdf", fileBase64: MINIMAL_PDF_BASE64 });
      assert.equal(res.status, 502);
    },
  );
});

test("a wrong Gemini key is reported as misconfiguration, without echoing the key", async () => {
  await withGemini(
    () =>
      new Response('{"error":{"status":"INVALID_ARGUMENT","details":[{"reason":"API_KEY_INVALID"}]}}', { status: 400 }),
    async () => {
      const res = await post({ filename: "coi.pdf", fileBase64: MINIMAL_PDF_BASE64 });
      assert.equal(res.status, 502);
      const text = JSON.stringify(await res.json());
      assert.match(text, /misconfigured/);
      assert.ok(!text.includes("gemini-test-key-not-real"));
    },
  );
});

test("Gemini rate limiting comes back as 429", async () => {
  await withGemini(
    () => new Response("quota", { status: 429 }),
    async () => {
      const res = await post({ filename: "coi.pdf", fileBase64: MINIMAL_PDF_BASE64 });
      assert.equal(res.status, 429);
    },
  );
});

test("the schema sent to Gemini uses type arrays for nullables, not anyOf", () => {
  const schema = JSON.stringify(geminiResponseSchema());
  assert.ok(!schema.includes("anyOf"));
  assert.ok(!schema.includes("$schema"));
  const props = geminiResponseSchema().properties;
  assert.deepEqual(props.directors.type, ["array", "null"]);
  assert.deepEqual(props.companyName.type, ["string", "null"]);
});
