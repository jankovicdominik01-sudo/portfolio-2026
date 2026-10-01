import { NextResponse } from "next/server";
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
