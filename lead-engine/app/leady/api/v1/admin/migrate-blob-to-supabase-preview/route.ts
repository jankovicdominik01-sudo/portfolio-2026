import { NextResponse } from "next/server";
import { runBlobToSupabaseMigration } from "@/lib/migrations/blob-to-supabase-runner";

const SUPABASE_URL = "https://ozdyutypgzqqkycdggjp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Ei03gbdR7jqvq4dRlyxMcg_xIEqafdq";

/**
 * Dočasná preview-only routa na jednorazový presun Blob → Supabase.
 * Token nie je v repozitári; overuje ho RLS migration gate v Supabase.
 * Pred merge do production sa táto routa odstráni.
 */
export async function GET(req: Request) {
  if (process.env.VERCEL_ENV !== "preview" || process.env.VERCEL_GIT_COMMIT_REF !== "phase1-supabase-migration") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const mode = url.searchParams.get("mode") ?? "dry";
  const allowNonEmpty = url.searchParams.get("allow_nonempty") === "1";

  if (!token || token.length < 32) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (mode !== "dry" && mode !== "apply") {
    return NextResponse.json({ error: "invalid_mode" }, { status: 400 });
  }

  try {
    const result = await runBlobToSupabaseMigration({
      apply: mode === "apply",
      allowNonEmpty,
      supabase: {
        url: SUPABASE_URL,
        key: SUPABASE_PUBLISHABLE_KEY,
        migrationToken: token,
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "migration_failed" },
      { status: 409 },
    );
  }
}
