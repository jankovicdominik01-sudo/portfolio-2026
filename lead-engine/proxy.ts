import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./lib/session";

/**
 * Prvá vrstva ochrany: bez platnej session sa na interné stránky nedostaneš.
 * Autorizácia (rola, prístup k leadu) sa overuje znova na serveri v každej akcii.
 */
export async function proxy(req: NextRequest) {
  const user = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    // API si auth rieši samo (session alebo Bearer kľúč pre automatizáciu).
    return NextResponse.next();
  }
  if (pathname === "/login") {
    return user ? NextResponse.redirect(new URL("/", req.url)) : NextResponse.next();
  }
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)"],
};
