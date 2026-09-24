import { NextResponse } from "next/server";
import { apiAuth } from "@/lib/auth";
import { analyzeLead } from "@/lib/leads";

export const maxDuration = 120;

/** AI analysis API — spustí (znova) analýzu jedného leadu. */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await apiAuth();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await analyzeLead(user, (await params).id));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 400 });
  }
}
