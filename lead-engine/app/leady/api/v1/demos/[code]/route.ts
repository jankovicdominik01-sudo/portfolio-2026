import { NextResponse } from "next/server";
import { publicDemo } from "@/lib/leads";
import { DEMO_NOINDEX_HEADER } from "@/lib/demo-templates";

/**
 * Verejné údaje dema pre djweby.sk/d/<kód>. Bez prihlásenia, lebo ho otvára firma.
 * Vracia iba verejnú projekciu (publicDemoView): meno, mesto, služby, dopyt, dashboard. Nič z leadu ani hovorov.
 * Vypnuté demo sa správa ako neexistujúce.
 * Neexistujúci aj expirovaný kód = 404, aby sa kódy nedali rozlíšiť.
 */
export async function GET(_: Request, { params }: { params: Promise<{ code: string }> }) {
  const demo = await publicDemo((await params).code);
  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": DEMO_NOINDEX_HEADER };
  if (!demo) return NextResponse.json({ error: "not_found" }, { status: 404, headers });
  return NextResponse.json({ demo }, { headers });
}
