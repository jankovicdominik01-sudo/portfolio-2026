import { NextResponse } from "next/server";
import { apiAuth } from "@/lib/auth";
import { z } from "zod";
import { getLead, patchLeadFacts } from "@/lib/leads";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await apiAuth();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const lead = await getLead(user, (await params).id);
  if (!lead) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ lead });
}

const Facts = z.object({
  website_status: z.enum(["no_website", "broken", "weak", "working", "uncertain"]).optional(),
  website_issue: z.string().max(40).nullable().optional(),
  website_checked_at: z.string().datetime().nullable().optional(),
  business_check: z.enum(["confirmed", "changed", "uncertain"]).optional(),
  register_ok: z.boolean().optional(),
  phone_on_web: z.boolean().optional(),
  ico: z.string().regex(/^\d{6,8}$/).nullable().optional(),
  sources: z.array(z.object({ source: z.string().max(40), url: z.string().max(500).nullable() })).max(10).optional(),
});

/** PATCH: overené fakty o firme (rutina pri opakovanom overení webu / backfill starších leadov). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await apiAuth();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const p = Facts.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message }, { status: 400 });
  try {
    const score = await patchLeadFacts(user, (await params).id, p.data);
    return NextResponse.json({ ok: true, score });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 400 });
  }
}
