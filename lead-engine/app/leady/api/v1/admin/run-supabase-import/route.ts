
import { NextResponse } from "next/server";

/** Dočasný jednorazový proxy endpoint pre Supabase import; po použití sa odstráni. */
export async function GET(req: Request) {
  if (process.env.VERCEL_ENV !== "production" || process.env.VERCEL_GIT_COMMIT_REF !== "main") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const token = new URL(req.url).searchParams.get("token");
  if (!token || token.length < 32) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const target =
    "https://ozdyutypgzqqkycdggjp.supabase.co/functions/v1/lead-engine-one-time-import?token=" +
    encodeURIComponent(token);
  const r = await fetch(target, { cache: "no-store" });
  const body = await r.text();
  return new NextResponse(body, {
    status: r.status,
    headers: { "content-type": r.headers.get("content-type") || "application/json" },
  });
}
