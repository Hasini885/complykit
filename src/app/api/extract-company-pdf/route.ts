import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import {
  EXTRACTION_SYSTEM_PROMPT,
  ExtractedCompanySchema,
  PDF_MAX_BYTES,
} from "@/lib/pdf-extraction";
import { extractWithGemini } from "@/lib/gemini-extraction";

/**
 * PDF -> structured company data, via Gemini or the Claude API.
 *
 * Nothing here persists the PDF: the decoded bytes live only in this
 * function's memory for the duration of the request, are never written to
 * disk, and are never logged. Only the extracted structured fields leave this
 * route.
 *
 * Configure ONE of these in .env.local:
 *   GEMINI_API_KEY=...      (aistudio.google.com -> Get API key) — used first when set
 *   ANTHROPIC_API_KEY=...   (console.anthropic.com -> API Keys)
 *
 * Without either, this returns 503 and says so plainly — matching the pattern
 * already established in /api/subscribe for a missing third-party key. It
 * never pretends extraction succeeded.
 */

export const runtime = "nodejs";

type Body = { fileBase64?: unknown; filename?: unknown };

/**
 * Whether AI extraction is switched on, so the upload box can offer it as a
 * second pass after the in-browser reader. Says nothing about the key itself.
 */
export async function GET() {
  const provider = activeProvider();
  return NextResponse.json({ configured: provider !== null, provider: provider?.name ?? null });
}

type Provider = { name: "gemini" | "claude"; apiKey: string };

/** Gemini when its key is set (for testing), otherwise Claude. */
function activeProvider(): Provider | null {
  if (process.env.GEMINI_API_KEY) return { name: "gemini", apiKey: process.env.GEMINI_API_KEY };
  if (process.env.ANTHROPIC_API_KEY) return { name: "claude", apiKey: process.env.ANTHROPIC_API_KEY };
  return null;
}

function stripDataUrlPrefix(value: string): string {
  const commaIndex = value.indexOf(",");
  return value.startsWith("data:") && commaIndex !== -1 ? value.slice(commaIndex + 1) : value;
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }

  if (typeof body.filename !== "string" || body.filename.trim() === "") {
    return NextResponse.json({ error: "A filename is required." }, { status: 400 });
  }
  if (!/\.pdf$/i.test(body.filename.trim())) {
    return NextResponse.json({ error: "Only PDF files are accepted." }, { status: 400 });
  }
  if (typeof body.fileBase64 !== "string" || body.fileBase64.trim() === "") {
    return NextResponse.json({ error: "No file data received." }, { status: 400 });
  }

  const base64 = stripDataUrlPrefix(body.fileBase64.trim());
  let pdfBytes: Buffer;
  try {
    pdfBytes = Buffer.from(base64, "base64");
  } catch {
    return NextResponse.json({ error: "That file could not be read." }, { status: 400 });
  }
  if (pdfBytes.length === 0) {
    return NextResponse.json({ error: "The uploaded file is empty." }, { status: 400 });
  }
  if (pdfBytes.length > PDF_MAX_BYTES) {
    return NextResponse.json(
      { error: `PDF is too large — the limit is ${PDF_MAX_BYTES / (1024 * 1024)}MB.` },
      { status: 400 },
    );
  }
  // %PDF- magic bytes: a cheap check that this is actually a PDF, not a
  // renamed file — filename and MIME type are both easy to spoof.
  if (pdfBytes.subarray(0, 5).toString("latin1") !== "%PDF-") {
    return NextResponse.json(
      { error: "That doesn't look like a valid PDF file." },
      { status: 400 },
    );
  }

  const provider = activeProvider();
  if (!provider) {
    return NextResponse.json(
      {
        error:
          "PDF auto-fill is not connected yet. Set GEMINI_API_KEY or ANTHROPIC_API_KEY to switch this on.",
        configured: false,
      },
      { status: 503 },
    );
  }

  if (provider.name === "gemini") return geminiResponse(provider.apiKey, base64);

  const client = new Anthropic({ apiKey: provider.apiKey });

  try {
    const response = await client.messages.parse({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: base64 },
            },
            {
              type: "text",
              text: "Extract the fields specified in the system prompt from this document.",
            },
          ],
        },
      ],
      output_config: { format: zodOutputFormat(ExtractedCompanySchema) },
    });

    if (!response.parsed_output) {
      return NextResponse.json(
        {
          error:
            "The document could not be read as structured data. Try a clearer scan, or fill the form in manually.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ data: response.parsed_output });
  } catch (error) {
    // Most-specific first — see error-codes.md. Never echo the API key or
    // the raw PDF bytes into a log line.
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("PDF extraction: Anthropic auth failed");
      return NextResponse.json(
        { error: "PDF auto-fill is misconfigured on the server. Fill the form in manually." },
        { status: 502 },
      );
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Too many requests right now — try again in a moment." },
        { status: 429 },
      );
    }
    if (error instanceof Anthropic.BadRequestError) {
      console.error("PDF extraction: bad request", error.message);
      return NextResponse.json(
        { error: "That PDF could not be processed. Try a different file, or fill the form in manually." },
        { status: 400 },
      );
    }
    if (error instanceof Anthropic.APIError) {
      console.error("PDF extraction: API error", error.status, error.message);
      return NextResponse.json(
        { error: "We could not reach the extraction service. Try again shortly." },
        { status: 502 },
      );
    }
    console.error("PDF extraction: unexpected error", error);
    return NextResponse.json(
      { error: "Something went wrong reading that file. Fill the form in manually." },
      { status: 500 },
    );
  }
}

/** Maps the Gemini extractor's outcome onto the same responses as the Claude path. */
async function geminiResponse(apiKey: string, base64: string) {
  const result = await extractWithGemini(apiKey, base64);
  if (result.ok) return NextResponse.json({ data: result.data });

  // Never echo the API key or the raw PDF bytes into a log line.
  switch (result.kind) {
    case "auth":
      console.error("PDF extraction: Gemini auth failed", result.detail);
      return NextResponse.json(
        { error: "PDF auto-fill is misconfigured on the server. Fill the form in manually." },
        { status: 502 },
      );
    case "rate-limit":
      return NextResponse.json(
        { error: "Too many requests right now — try again in a moment." },
        { status: 429 },
      );
    case "bad-request":
      console.error("PDF extraction: Gemini bad request", result.detail);
      return NextResponse.json(
        { error: "That PDF could not be processed. Try a different file, or fill the form in manually." },
        { status: 400 },
      );
    case "unreadable":
      console.error("PDF extraction: Gemini reply unusable", result.detail);
      return NextResponse.json(
        {
          error:
            "The document could not be read as structured data. Try a clearer scan, or fill the form in manually.",
        },
        { status: 502 },
      );
    case "unavailable":
      console.error("PDF extraction: Gemini unavailable", result.detail);
      return NextResponse.json(
        { error: "We could not reach the extraction service. Try again shortly." },
        { status: 502 },
      );
  }
}
