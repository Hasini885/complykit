import { z } from "zod";

import { EXTRACTION_SYSTEM_PROMPT, ExtractedCompanySchema } from "@/lib/pdf-extraction";

/**
 * PDF -> structured company data, via Google's Gemini API (Interactions API).
 *
 * The same contract as the Claude extractor: the same prompt, the same schema,
 * and a field the document does not state comes back null. Gemini's output is
 * still validated against the Zod schema here, so a malformed reply is
 * rejected rather than reaching a form.
 *
 * Configure with, in .env.local:
 *   GEMINI_API_KEY=...   (aistudio.google.com -> Get API key)
 *   GEMINI_MODEL=...     (optional; defaults to DEFAULT_GEMINI_MODEL)
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";

/** Current stable Flash model per ai.google.dev/gemini-api/docs/models (Oct 2026). */
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

/**
 * The Zod schema as JSON Schema, in the shape Gemini documents: nullable
 * fields as `"type": [T, "null"]`. Zod writes a nullable object or array as
 * `anyOf: [T, null]`, so that one form is flattened.
 */
export function geminiResponseSchema() {
  const flatten = (node) => {
    if (Array.isArray(node)) return node.map(flatten);
    if (!node || typeof node !== "object") return node;
    const obj = node;
    const anyOf = obj.anyOf;
    if (anyOf && anyOf.length === 2 && anyOf.some((s) => s.type === "null")) {
      const other = anyOf.find((s) => s.type !== "null");
      if (typeof other.type === "string") {
        const { anyOf: _drop, ...rest } = obj;
        void _drop;
        return flatten({ ...rest, ...other, type: [other.type, "null"] });
      }
    }
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === "$schema" || k === "additionalProperties") continue;
      out[k] = flatten(v);
    }
    return out;
  };
  return flatten(z.toJSONSchema(ExtractedCompanySchema));
}

/** The text of the model's final answer, wherever the response put it. */
function outputText(body) {
  const b = body;
  if (typeof b.output_text === "string") return b.output_text;
  const steps = Array.isArray(b.steps) ? b.steps : [];
  for (let i = steps.length - 1; i >= 0; i--) {
    const parts = Array.isArray(steps[i].content) ? steps[i].content : [];
    const text = parts.find((p) => typeof p.text === "string")?.text;
    if (typeof text === "string") return text;
  }
  return null;
}

export async function extractWithGemini(apiKey, pdfBase64, model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL) {
  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        model,
        input: [
          { type: "document", mime_type: "application/pdf", data: pdfBase64 },
          {
            type: "text",
            text: `${EXTRACTION_SYSTEM_PROMPT}\n\nExtract the fields specified above from this document.`,
          },
        ],
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: geminiResponseSchema(),
        },
      }),
      // A long scanned PDF can take a while; never hang the request forever.
      signal: AbortSignal.timeout(90_000),
    });
  } catch (error) {
    return { ok: false, kind: "unavailable", detail: String(error) };
  }

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 500);
    // Google reports a wrong key as 400 API_KEY_INVALID, not 401.
    if (res.status === 401 || res.status === 403 || /API_KEY_INVALID|PERMISSION_DENIED/.test(detail)) {
      return { ok: false, kind: "auth", detail: `${res.status}` };
    }
    if (res.status === 429) return { ok: false, kind: "rate-limit", detail };
    if (res.status === 400) return { ok: false, kind: "bad-request", detail };
    return { ok: false, kind: "unavailable", detail: `${res.status} ${detail}` };
  }

  const text = outputText(await res.json().catch(() => null));
  if (!text) return { ok: false, kind: "unreadable", detail: "no text in response" };

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, kind: "unreadable", detail: "response was not JSON" };
  }
  const parsed = ExtractedCompanySchema.safeParse(json);
  if (!parsed.success) return { ok: false, kind: "unreadable", detail: parsed.error.message.slice(0, 500) };
  return { ok: true, data: parsed.data };
}
