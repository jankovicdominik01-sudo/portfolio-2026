import { NextResponse } from "next/server";
import { z } from "zod";
import { apiAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { applyMigration, loadSnapshot, planMigration } from "@/lib/migrations/retire-legacy-callers";

/**
 * Jednorazová migrácia histórie (lib/migrations/retire-legacy-callers.ts). Iba admin.
 * Predvolene na sucho: vráti zoznam zmien. Zapíše iba s {"apply": true}.
 * Idempotentná: druhý beh nič nenájde.
 */
/** Veľa jednotlivých zápisov do úložiska; beh je idempotentný, pri prerušení stačí spustiť znova. */
export const maxDuration = 300;

const Body = z.object({
  apply: z.boolean().optional().default(false),
  /** Nevolané leady pôvodných volajúcich dostane tento aktívny operátor (inak ostanú nepriradené). */
  reassign_unworked_to: z.string().regex(/^[a-z0-9_-]{2,40}$/).nullable().optional().default(null),
});

export async function POST(req: Request) {
  const user = await apiAuth();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message }, { status: 400 });
  const r = await db();
  const plan = planMigration(await loadSnapshot(r), { reassignUnworkedTo: body.data.reassign_unworked_to });
  if (body.data.apply) await applyMigration(r, plan);
  return NextResponse.json({ applied: body.data.apply, summary: plan.summary, roman_cases: plan.roman_cases, changes: plan.changes.length });
}
