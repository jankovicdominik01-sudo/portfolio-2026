import { NextResponse } from "next/server";
import { apiAuth } from "@/lead-engine/lib/auth";
import { listLeads } from "@/lead-engine/lib/leads";

export async function GET() {
  const user = await apiAuth();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const leads = await listLeads(user);
  return NextResponse.json(
    {
      items: leads.map((l) => ({
        id: l.id,
        name: l.company.name,
        city: l.company.city,
        phone: l.company.phone,
        email: l.company.email,
        category: l.company.category,
        status: l.status,
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
