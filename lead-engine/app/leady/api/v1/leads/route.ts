import { NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { apiAuth } from "@/lib/auth";
import { analyzeLead, listLeads } from "@/lib/leads";
import { importRows } from "@/lib/import";

export const maxDuration = 300;

/** Lead ingestion API — GET zoznam, POST nové firmy (deduplikácia + voliteľná analýza). */
export async function GET(req: Request) {
  const user = await apiAuth();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const status = new URL(req.url).searchParams.get("status");
  const leads = (await listLeads(user)).filter((l) => !status || l.status === status);
  return NextResponse.json({ leads });
}

const Body = z.object({
  leads: z.array(z.record(z.string(), z.unknown())).min(1).max(500),
  analyze: z.boolean().optional().default(true),
  source: z.enum(["api", "routine"]).optional().default("api"),
});

export async function POST(req: Request) {
  const user = await apiAuth();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message }, { status: 400 });

  const res = await importRows(user, body.data.leads, body.data.source);
  if (body.data.analyze && res.leadIds.length) {
    after(async () => {
      for (const id of res.leadIds) {
        try {
          await analyzeLead(user, id);
        } catch {
          /* pokračuj */
        }
      }
    });
  }
  return NextResponse.json(res, { status: 201 });
}
