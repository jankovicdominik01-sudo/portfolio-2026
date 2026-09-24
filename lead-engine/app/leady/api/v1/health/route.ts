import { NextResponse } from "next/server";
import { apiAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { claudeAvailable } from "@/lib/ai/claude";
import { blobEnvNames } from "@/lib/db/blob-token";
import { get, list } from "@vercel/blob";

export async function GET(req: Request) {
  const user = await apiAuth();
  if (!user) return NextResponse.json({ ok: true });
  const probe: Record<string, string> = {};
  if (new URL(req.url).searchParams.has("probe")) {
    for (const access of ["private", "public"] as const) {
      try {
        const r = await get("lead-engine/__probe.json", { access, useCache: false });
        probe[access] = r ? `ok ${r.statusCode}` : "ok (nenájdené)";
      } catch (e) {
        probe[access] = e instanceof Error ? e.message.slice(0, 160) : "chyba";
      }
    }
    try {
      const l = await list({ limit: 3 });
      probe.list = `ok ${l.blobs.length} · ${l.blobs.map((b) => b.url.split("/")[2]).join(",")}`;
    } catch (e) {
      probe.list = e instanceof Error ? e.message.slice(0, 160) : "chyba";
    }
  }
  return NextResponse.json({
    ok: true,
    probe,
    storage: (await db()).kind,
    ai: claudeAvailable() ? "claude" : "rules",
    blob_env: blobEnvNames(),
    vercel_env: process.env.VERCEL_ENV ?? null,
  });
}
