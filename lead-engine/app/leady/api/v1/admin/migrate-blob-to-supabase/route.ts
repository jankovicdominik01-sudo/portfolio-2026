import { NextResponse } from "next/server";
import { z } from "zod";
import { apiAuth } from "@/lib/auth";
import { runBlobToSupabaseMigration } from "@/lib/migrations/blob-to-supabase-runner";

const Body = z.object({
  apply: z.boolean().optional().default(false),
  allow_nonempty: z.boolean().optional().default(false),
});

/**
 * Jednorazový presun produkčných dát z Vercel Blob do Supabase.
 * Default = DRY RUN. Zdrojový Blob sa nikdy nemení.
 */
export async function POST(req: Request) {
  const user = await apiAuth();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid_body" }, { status: 400 });
  }

  try {
    const result = await runBlobToSupabaseMigration({
      apply: parsed.data.apply,
      allowNonEmpty: parsed.data.allow_nonempty,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "migration_failed" },
      { status: 409 },
    );
  }
}
