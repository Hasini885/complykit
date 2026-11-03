import { auth } from "@clerk/nextjs/server";
import { get, put } from "@vercel/blob";

import { isAccountData } from "@/lib/sync-plan";

/**
 * The signed-in user's saved data, so the same login shows the same
 * companies on any computer. Kept on the server in a PRIVATE Vercel Blob
 * store (encrypted at rest by Vercel), one file per account. The account
 * comes from the login on the server, never from the request, so a user can
 * reach only their own file.
 */

const MAX_BYTES = 4_000_000;
const pathFor = (userId: string) => `accounts/${userId}.json`;
const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in first." }, { status: 401, headers: noStore });
  try {
    const found = await get(pathFor(userId), { access: "private", useCache: false });
    if (!found || found.statusCode !== 200) return Response.json({ data: null }, { headers: noStore });
    const data: unknown = JSON.parse(await new Response(found.stream).text());
    return Response.json({ data: isAccountData(data) ? data : null }, { headers: noStore });
  } catch (error) {
    console.error("account data read failed", error);
    return Response.json({ error: "Could not load your saved data." }, { status: 503, headers: noStore });
  }
}

export async function PUT(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in first." }, { status: 401, headers: noStore });
  const text = await request.text();
  if (text.length > MAX_BYTES) {
    return Response.json({ error: "That is more data than can be saved." }, { status: 413, headers: noStore });
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return Response.json({ error: "Unreadable upload." }, { status: 400, headers: noStore });
  }
  if (!isAccountData(data)) {
    return Response.json({ error: "That is not ComplyKit data." }, { status: 400, headers: noStore });
  }
  try {
    await put(pathFor(userId), JSON.stringify(data), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return Response.json({ ok: true, updatedAt: data.updatedAt }, { headers: noStore });
  } catch (error) {
    console.error("account data write failed", error);
    return Response.json({ error: "Could not save your data." }, { status: 503, headers: noStore });
  }
}
