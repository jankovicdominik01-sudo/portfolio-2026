import { NextResponse } from "next/server";
import { apiAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { claudeAvailable } from "@/lib/ai/claude";
import { blobEnvNames } from "@/lib/db/blob-token";
import { get, head, list, put } from "@vercel/blob";

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
  const seq: string[] = [];
  if (new URL(req.url).searchParams.get("probe") === "seq") {
    const P = "lead-engine/__seq.json";
    const o = { access: "private" as const, addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" };
    try {
      let et = (await put(P, JSON.stringify({ n: 0 }), o)).etag;
      seq.push(`put0 ${et}`);
      for (let i = 1; i <= 5; i++) {
        const t = Date.now();
        const h = await head(P);
        const g = await get(P, { access: "private", useCache: false });
        const gt = g ? await new Response(g.stream).text() : "";
        seq.push(`#${i} head=${h.etag === et ? "=" : h.etag} get=${g?.blob.etag === et ? "=" : g?.blob.etag} body=${gt}`);
        try {
          et = (await put(P, JSON.stringify({ n: i }), { ...o, ifMatch: h.etag })).etag;
          seq.push(`  put ok ${et} ${Date.now() - t}ms`);
        } catch (e) {
          seq.push(`  put FAIL ${e instanceof Error ? e.constructor.name + " " + e.message.slice(0, 80) : ""}`);
        }
      }
    } catch (e) {
      seq.push("ERR " + (e instanceof Error ? e.message : ""));
    }
  }
  return NextResponse.json({
    ok: true,
    seq,
    probe,
    storage: (await db()).kind,
    ai: claudeAvailable() ? "claude" : "rules",
    blob_env: blobEnvNames(),
    vercel_env: process.env.VERCEL_ENV ?? null,
  });
}
