import { z } from "zod";

import {
  EXTRACTION_SYSTEM_PROMPT,
  ExtractedCompanySchema,
  type ExtractedCompany,
} from "@/lib/pdf-extraction";

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

export type GeminiResult =
  | { ok: true; data: ExtractedCompany }
  | { ok: false; kind: "auth" | "rate-limit" | "bad-request" | "unreadable" | "unavailable"; detail: string };

/**
 * The Zod schema as JSON Schema, in the shape Gemini documents: nullable
 * fields as `"type": [T, "null"]`. Zod writes a nullable object or array as
 * `anyOf: [T, null]`, so that one form is flattened.
 */
export function geminiResponseSchema(): Record<string, unknown> {
  const flatten = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(flatten);
    if (!node || typeof node !== "object") return node;
    const obj = node as Record<string, unknown>;
    const anyOf = obj.anyOf as Record<string, unknown>[] | undefined;
    if (anyOf && anyOf.length === 2 && anyOf.some((s) => s.type === "null")) {
      const other = anyOf.find((s) => s.type !== "null")!;
      if (typeof other.type === "string") {
        const { anyOf: _drop, ...rest } = obj;
        void _drop;
        return flatten({ ...rest, ...other, type: [other.type, "null"] });
      }
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === "$schema" || k === "additionalProperties") continue;
      out[k] = flatten(v);
    }
    return out;
  };
  return flatten(z.toJSONSchema(ExtractedCompanySchema)) as Record<string, unknown>;
}

/** The text of the model's final answer, wherever the response put it. */
function outputText(body: unknown): string | null {
  const b = body as { output_text?: unknown; steps?: { content?: { type?: string; text?: unknown }[] }[] };
  if (typeof b.output_text === "string") return b.output_text;
  const steps = Array.isArray(b.steps) ? b.steps : [];
  for (let i = steps.length - 1; i >= 0; i--) {
    const parts = Array.isArray(steps[i].content) ? steps[i].content! : [];
    const text = parts.find((p) => typeof p.text === "string")?.text;
    if (typeof text === "string") return text;
  }
  return null;
}

export async function extractWithGemini(
  apiKey: string,
  pdfBase64: string,
  model: string = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
): Promise<GeminiResult> {
  let res: Response;
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

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, kind: "unreadable", detail: "response was not JSON" };
  }
  const parsed = ExtractedCompanySchema.safeParse(json);
  if (!parsed.success) return { ok: false, kind: "unreadable", detail: parsed.error.message.slice(0, 500) };
  return { ok: true, data: parsed.data };
}
