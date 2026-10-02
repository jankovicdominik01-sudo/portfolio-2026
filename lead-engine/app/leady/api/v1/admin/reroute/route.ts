import { NextResponse } from "next/server";
import { z } from "zod";
import { apiAuth } from "@/lib/auth";
import { rerouteAsync } from "@/lib/leads";

/** Preradenie ASYNC leadov podľa aktuálnych pravidiel kanála. Iba admin, predvolene na sucho. */
export const maxDuration = 300;
const Body = z.object({ apply: z.boolean().optional().default(false) });

export async function POST(req: Request) {
  const user = await apiAuth();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message }, { status: 400 });
  return NextResponse.json({ applied: body.data.apply, ...(await rerouteAsync(user, body.data.apply)) });
}
