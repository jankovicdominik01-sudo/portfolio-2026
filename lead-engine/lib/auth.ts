import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, timingSafeStringEqual, verifySession } from "./session";
import type { Role, SessionUser } from "./types";

type UserRecord = SessionUser & { password: string };

/**
 * Používatelia z env LE_USERS:
 *   "dominik|Dominik|admin|heslo;jozo|Jozo|caller|heslo2"
 * Lokálne (bez LE_USERS) platia demo účty dominik/dominik a jozo/jozo.
 */
export function configuredUsers(): { users: UserRecord[]; demo: boolean } {
  const raw = process.env.LE_USERS;
  if (!raw) {
    if (process.env.NODE_ENV === "production") return { users: [], demo: false };
    return {
      demo: true,
      users: [
        { username: "dominik", name: "Dominik", role: "admin", password: "dominik" },
        { username: "jozo", name: "Jozo", role: "caller", password: "jozo" },
      ],
    };
  }
  const users = raw
    .split(";")
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => {
      const [username, name, role, ...pw] = row.split("|");
      return {
        username: username.trim().toLowerCase(),
        name: name.trim(),
        role: (role.trim() === "admin" ? "admin" : "caller") as Role,
        password: pw.join("|"),
      };
    })
    .filter((u) => u.username && u.password.length >= 6);
  return { users, demo: false };
}

export async function authenticate(username: string, password: string): Promise<SessionUser | null> {
  const { users } = configuredUsers();
  const u = users.find((x) => x.username === username.trim().toLowerCase());
  // Porovnávame aj pri neexistujúcom mene, aby čas odpovede neprezrádzal účty.
  const ok = await timingSafeStringEqual(u?.password ?? "__none__", password);
  if (!u || !ok) return null;
  return { username: u.username, name: u.name, role: u.role };
}

export function callers(): SessionUser[] {
  return configuredUsers()
    .users.filter((u) => u.role === "caller")
    .map(({ username, name, role }) => ({ username, name, role }));
}

export function adminName(): string {
  return configuredUsers().users.find((u) => u.role === "admin")?.name ?? "Dominik";
}

export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

/** Pre stránky a server actions — bez session presmeruje na login. */
export async function requireUser(role?: Role): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) redirect("/login");
  if (role && u.role !== role) redirect("/");
  return u;
}

/** Pre API — session cookie alebo Bearer LE_API_KEY (automatizácia). */
export async function apiAuth(): Promise<SessionUser | null> {
  const h = await headers();
  const auth = h.get("authorization");
  const key = process.env.LE_API_KEY;
  if (auth?.startsWith("Bearer ") && key && key.length >= 24) {
    if (await timingSafeStringEqual(auth.slice(7).trim(), key)) {
      return { username: "automation", name: "Ranná rutina", role: "admin" };
    }
    return null;
  }
  return currentUser();
}

/* Jednoduchý rate-limit na login (v rámci inštancie). */
const attempts = new Map<string, { n: number; until: number }>();
export function loginRateLimited(ip: string): boolean {
  const now = Date.now();
  const a = attempts.get(ip);
  if (!a || a.until < now) {
    attempts.set(ip, { n: 1, until: now + 10 * 60_000 });
    return false;
  }
  a.n++;
  return a.n > 10;
}

export function loginSucceeded(ip: string) {
  attempts.delete(ip);
}
