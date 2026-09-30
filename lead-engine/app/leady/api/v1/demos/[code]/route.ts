import { NextResponse } from "next/server";
import { publicDemo } from "@/lib/leads";

/**
 * Verejné údaje dema pre djweby.sk/d/<kód>. Bez prihlásenia, lebo ho otvára firma.
 * Vracia iba DemoPayload (meno, mesto, služby s evidence), nič z leadu ani hovorov.
 * Neexistujúci aj expirovaný kód = 404, aby sa kódy nedali rozlíšiť.
 */
export async function GET(_: Request, { params }: { params: Promise<{ code: string }> }) {
  const demo = await publicDemo((await params).code);
  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
  if (!demo) return NextResponse.json({ error: "not_found" }, { status: 404, headers });
  return NextResponse.json({ demo }, { headers });
}
