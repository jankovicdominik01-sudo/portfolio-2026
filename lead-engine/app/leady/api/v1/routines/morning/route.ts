import { NextResponse } from "next/server";
import { z } from "zod";
import { apiAuth } from "@/lib/auth";
import { runMorningRoutine } from "@/lib/routine";

export const maxDuration = 300;

/**
 * Ranná rutina (07:00). Volá ju scheduler (Vercel Cron / Claude routine / n8n)
 * s Bearer LE_API_KEY. Discovery firiem robí externý agent a pošle ich v `candidates`.
 */
const Body = z.object({
  query: z.string().max(300).optional(),
  candidates: z.array(z.record(z.string(), z.unknown())).max(200).optional().default([]),
});

export async function POST(req: Request) {
  const user = await apiAuth();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message }, { status: 400 });
  return NextResponse.json(await runMorningRoutine(user, body.data));
}
