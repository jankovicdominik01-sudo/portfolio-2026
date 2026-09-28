import { NextResponse } from "next/server";
import { z } from "zod";
import { apiAuth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Golden dataset Lead Radaru — ručne overené reálne firmy (SK/CZ, Soňa/Jozo, web/bez webu, social-first…).
 * Obsahuje firemné kontakty, preto NIE JE v (verejnom) repozitári, ale v súkromnom úložisku Lead Engine.
 * Používa ho routine/radar_golden.py na meranie presnosti resolvera (identita, web, kategória, telefón).
 */
const Entry = z.object({
  id: z.string().max(40),
  country: z.enum(["SK", "CZ"]),
  seed: z.record(z.string(), z.unknown()),
  expect: z.object({
    ico: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    category: z.string(),
    caller: z.string().nullable().optional(),
    website_domain: z.string().nullable(),
    website_status: z.enum(["confirmed", "probable", "no_website_found", "uncertain"]),
    socials: z.array(z.string()).optional().default([]),
    note: z.string().max(400).optional(),
  }),
  verified_at: z.string(),
  verified_by: z.string().max(60),
});
const Body = z.object({ entries: z.array(Entry).max(200) });

export async function GET() {
  const user = await apiAuth();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const s = await (await db()).getSettings();
  return NextResponse.json({ entries: (s.radar as { golden?: unknown[] } | undefined)?.golden ?? [] });
}

export async function PUT(req: Request) {
  const user = await apiAuth();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: `${p.error.issues[0]?.path.join(".")}: ${p.error.issues[0]?.message}` }, { status: 400 });
  const r = await db();
  const s = await r.getSettings();
  await r.saveSettings({ ...s, radar: { ...(s.radar ?? { runs: [], query_log: [] }), golden: p.data.entries } as typeof s.radar });
  return NextResponse.json({ ok: true, entries: p.data.entries.length });
}
