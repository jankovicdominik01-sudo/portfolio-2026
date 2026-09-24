import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./lead-engine/lib/session";

/**
 * Proxy sa týka iba interného Lead Engine na /leady — verejný web djweby.sk ide mimo.
 * Prvá vrstva ochrany: bez platnej session sa na interné stránky nedostaneš.
 * Autorizácia (rola, prístup k leadu) sa overuje znova na serveri v každej akcii.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // API si auth rieši samo (session alebo Bearer kľúč pre automatizáciu).
  if (pathname.startsWith("/leady/api/")) return NextResponse.next();

  const user = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (pathname === "/leady/login") {
    return user ? NextResponse.redirect(new URL("/leady", req.url)) : NextResponse.next();
  }
  if (!user) return NextResponse.redirect(new URL("/leady/login", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/leady", "/leady/:path*"],
};
