import { NextResponse } from "next/server";
import { z } from "zod";
import { apiAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { runMorningRoutine } from "@/lib/routine";
import { ResearchedItemSchema, ingestResearched, type ResearchedResult } from "@/lib/research";
import { morningStatus, saveRadarRun } from "@/lib/leads";

/**
 * GET: čo má ranná rutina dnes doplniť, PER OPERÁTOR (každý aktívny CALL operátor má vlastnú frontu),
 * routing kategória → volajúci, nedávne discovery dopyty (aby sa lokality neopakovali) a leady na preverenie.
 * Staré polia (caller / fresh / target / need) ostávajú pre spätnú kompatibilitu = prvý volajúci.
 */
export async function GET() {
  const user = await apiAuth();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const m = await morningStatus(user);
  const first = m.callers[0];
  return NextResponse.json({ ...m, caller: first?.caller ?? null, fresh: first?.fresh ?? 0, target: first?.target ?? 10, need: first?.need ?? 0 });
}

export const maxDuration = 300;

/**
 * Ranná rutina. Volá ju naplánovaný agent s Bearer kľúčom.
 *  - `researched`: firmy, ktoré agent už preskúmal (fakty so zdrojmi + podklady pre operátora),
 *    alebo preveril a vyradil (`reject`) — tie sa uložia ako vyradené, aby sa zajtra neopakovali.
 *  - `candidates`: surové firmy na analýzu priamo v appke.
 */
const Body = z.object({
  query: z.string().max(300).optional(),
  candidates: z.array(z.record(z.string(), z.unknown())).max(200).optional().default([]),
  researched: z.array(ResearchedItemSchema).max(120).optional().default([]),
  /** Lead Radar: zdravie zdrojov, štatistiky behu, yield dopytov. */
  radar_report: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request) {
  const user = await apiAuth();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    const i = body.error.issues[0];
    return NextResponse.json({ error: `${i?.path.join(".")}: ${i?.message}` }, { status: 400 });
  }

  if (body.data.radar_report) await saveRadarRun(user, body.data.radar_report);
  const results: ResearchedResult[] = [];
  for (const item of body.data.researched) {
    try {
      results.push(await ingestResearched(user, item));
    } catch (e) {
      results.push({ status: "invalid", name: String(item.company.name ?? "?"), error: e instanceof Error ? e.message : "chyba" });
    }
  }
  const ready = results.filter((r) => r.status === "ready");
  if (ready.length) {
    await (await db()).insertNotification({
      id: `nt_${crypto.randomUUID().slice(0, 12)}`,
      at: new Date().toISOString(),
      lead_id: null,
      kind: "new_leads",
      title: `Dnes pribudlo ${ready.length} firiem na volanie`,
      body: ready.map((r) => r.name).join(", "),
      read: false,
    });
  }

  const legacy = body.data.candidates.length || body.data.query ? await runMorningRoutine(user, body.data) : null;
  return NextResponse.json({
    ready: ready.length,
    rejected: results.filter((r) => r.status === "rejected").length,
    review: results.filter((r) => r.status === "review"),
    duplicate: results.filter((r) => r.status === "duplicate").map((r) => r.name),
    invalid: results.filter((r) => r.status === "invalid"),
    results,
    legacy,
  });
}
