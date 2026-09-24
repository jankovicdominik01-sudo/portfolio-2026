import { NextResponse } from "next/server";
import { apiAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { claudeAvailable } from "@/lib/ai/claude";
import { blobEnvNames } from "@/lib/db/blob-token";

export async function GET() {
  const user = await apiAuth();
  if (!user) return NextResponse.json({ ok: true });
  return NextResponse.json({
    ok: true,
    storage: (await db()).kind,
    ai: claudeAvailable() ? "claude" : "rules",
    blob_env: blobEnvNames(),
    vercel_env: process.env.VERCEL_ENV ?? null,
  });
}
