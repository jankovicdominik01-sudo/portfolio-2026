import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./lib/session";

/**
 * Prvá vrstva ochrany: bez platnej session sa na interné stránky nedostaneš.
 * Autorizácia (rola, prístup k leadu) sa overuje znova na serveri v každej akcii.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // API si auth rieši samo (session alebo Bearer kľúč pre automatizáciu).
  if (pathname.startsWith("/leady/api/")) return NextResponse.next();

  const user = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (pathname === "/leady/login") {
    // reauth=1: server odmietol session (napr. deaktivovaný účet) → zmaž cookie, inak by vznikla slučka presmerovaní.
    if (req.nextUrl.searchParams.has("reauth")) {
      const res = NextResponse.next();
      res.cookies.delete({ name: SESSION_COOKIE, path: "/leady" });
      return res;
    }
    return user ? NextResponse.redirect(new URL("/leady", req.url)) : NextResponse.next();
  }
  if (!user) return NextResponse.redirect(new URL("/leady/login", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/leady", "/leady/:path*"],
};
