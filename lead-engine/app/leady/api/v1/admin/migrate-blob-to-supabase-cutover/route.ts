import { NextResponse } from "next/server";
import { get, head, list } from "@vercel/blob";
import { blobEnvNames, blobToken } from "@/lib/db/blob-token";
import {
  blobStorageFingerprint,
  runBlobToSupabaseMigration,
} from "@/lib/migrations/blob-to-supabase-runner";

/**
 * Dočasná produkčná routa na jednorazový presun Blob → Supabase.
 * Funguje iba na production deployi z main a iba s jednorazovým migration tokenom.
 * Po úspešnom cutovere sa odstráni.
 */
export async function GET(req: Request) {
  if (process.env.VERCEL_ENV !== "production" || process.env.VERCEL_GIT_COMMIT_REF !== "main") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const supabaseUrl = url.searchParams.get("supabase_url");
  const supabaseKey = url.searchParams.get("supabase_key");
  const mode = url.searchParams.get("mode") ?? "dry";
  const allowNonEmpty = url.searchParams.get("allow_nonempty") === "1";

  if (!token || token.length < 32) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (mode === "debug") {
    const path = process.env.LEAD_ENGINE_BLOB_PATH || "lead-engine/db-v2.json";
    const probe: Record<string, unknown> = {
      blob_env: blobEnvNames(),
      token_present: !!blobToken(),
      blob_store_id_present: !!process.env.BLOB_STORE_ID,
      oidc_present: !!process.env.VERCEL_OIDC_TOKEN,
      path,
    };
    try {
      const meta = await head(path);
      probe.head_default = { ok: true, etag: meta.etag, size: meta.size };
    } catch (error) {
      probe.head_default = { ok: false, error: error instanceof Error ? error.message.slice(0, 240) : "error" };
    }
    try {
      const tokenValue = blobToken();
      const meta = await head(path, { token: tokenValue });
      probe.head_explicit = { ok: true, etag: meta.etag, size: meta.size };
    } catch (error) {
      probe.head_explicit = { ok: false, error: error instanceof Error ? error.message.slice(0, 240) : "error" };
    }
    try {
      const result = await get(path, { access: "private", useCache: false });
      if (!result) probe.get_default = { ok: true, found: false };
      else {
        await result.stream.cancel().catch(() => {});
        probe.get_default = { ok: true, found: true, status: result.statusCode };
      }
    } catch (error) {
      probe.get_default = { ok: false, error: error instanceof Error ? error.message.slice(0, 240) : "error" };
    }
    try {
      const result = await list({ prefix: "lead-engine/", limit: 3 });
      probe.list_default = { ok: true, count: result.blobs.length };
    } catch (error) {
      probe.list_default = { ok: false, error: error instanceof Error ? error.message.slice(0, 240) : "error" };
    }
    return NextResponse.json(probe);
  }

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "missing_supabase_connection" }, { status: 400 });
  }
  if (mode !== "dry" && mode !== "apply") {
    return NextResponse.json({ error: "invalid_mode" }, { status: 400 });
  }

  try {
    const result = await runBlobToSupabaseMigration({
      apply: mode === "apply",
      allowNonEmpty,
      supabase: {
        url: supabaseUrl,
        key: supabaseKey,
        migrationToken: token,
      },
    });
    return NextResponse.json({
      ...result,
      storage_fingerprint: await blobStorageFingerprint(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "migration_failed" },
      { status: 409 },
    );
  }
}
