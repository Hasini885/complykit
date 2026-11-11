import { NextResponse } from "next/server";

import { checkEmail } from "@/lib/email";

/**
 * Newsletter signup, proxied to Kit (formerly ConvertKit).
 *
 * The request goes through this route rather than straight from the browser so
 * the API key stays server-side, so failures come back as readable messages
 * instead of an opaque CORS error, and so an ad blocker filtering third-party
 * requests cannot silently swallow a signup.
 *
 * Configure with, in .env.local:
 *   KIT_API_KEY=...      (Kit -> Settings -> Advanced -> API Key)
 *   KIT_FORM_ID=...      (the numeric id in the form's URL)
 *
 * With either missing the endpoint returns 503 and says so plainly. It never
 * pretends a signup succeeded.
 */

export const runtime = "nodejs";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }

  // Honeypot: a real person never fills a hidden field. Accept and discard, so
  // a bot gets no signal about what tripped it.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true, status: "subscribed" });
  }

  if (typeof body.email !== "string") {
    return NextResponse.json({ error: "Enter your email address." }, { status: 400 });
  }

  const check = checkEmail(body.email);
  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: 400 });
  }

  const apiKey = process.env.KIT_API_KEY;
  const formId = process.env.KIT_FORM_ID;

  if (!apiKey || !formId) {
    return NextResponse.json(
      {
        error: "Alerts are not connected yet. Set KIT_API_KEY and KIT_FORM_ID to switch this on.",
        configured: false,
      },
      { status: 503 },
    );
  }

  try {
    const res = await fetch(`https://api.convertkit.com/v3/forms/${formId}/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, email: check.email }),
      // Never let a slow upstream hold the request open indefinitely.
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("Kit subscribe failed", res.status, detail.slice(0, 500));
      return NextResponse.json(
        { error: "We could not complete the signup just now. Please try again shortly." },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, status: "subscribed" });
  } catch (error) {
    console.error("Kit subscribe threw", error);
    return NextResponse.json(
      { error: "We could not reach the mailing service. Please try again shortly." },
      { status: 502 },
    );
  }
}
