import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const r = await db();
    const leads = await r.listLeads();
    return NextResponse.json({ ok: true, storage: r.kind, leads: leads.length });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "storage_error" },
      { status: 500 },
    );
  }
}
