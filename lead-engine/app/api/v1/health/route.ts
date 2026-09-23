import { NextResponse } from "next/server";
import { apiAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { claudeAvailable } from "@/lib/ai/claude";

export async function GET() {
  const user = await apiAuth();
  if (!user) return NextResponse.json({ ok: true });
  return NextResponse.json({
    ok: true,
    storage: (await db()).kind,
    ai: claudeAvailable() ? "claude" : "rules",
  });
}
