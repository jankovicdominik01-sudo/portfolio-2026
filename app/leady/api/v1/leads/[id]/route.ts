import { NextResponse } from "next/server";
import { apiAuth } from "@/lead-engine/lib/auth";
import { getLead } from "@/lead-engine/lib/leads";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await apiAuth();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const lead = await getLead(user, (await params).id);
  if (!lead) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ lead });
}
