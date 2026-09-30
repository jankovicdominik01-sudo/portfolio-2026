import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, sessionSecret, timingSafeStringEqual, verifySession } from "./session";
import { accountAllowed, passwordMatches, usersFor, type UsersConfig } from "./users";
import type { Role, SessionUser, UserInfo } from "./types";
import { blobConfigured } from "./db/blob-token";
import { configuredOperators } from "./operators";

/** Účty: LE_USERS, inak predvolený admin (server) alebo demo účty (lokálne). */
export function configuredUsers(): UsersConfig {
  return usersFor(process.env.LE_USERS, process.env.NODE_ENV);
}

/** Všetci používatelia bez hesiel (aj neaktívni — kvôli histórii a filtrom). */
export function allUsers(): UserInfo[] {
  return configuredUsers().users.map(({ username, name, role, active, speech }) => ({ username, name, role, active, speech }));
}

export async function authenticate(username: string, password: string): Promise<SessionUser | null> {
  const { users } = configuredUsers();
  const u = users.find((x) => x.username === username.trim().toLowerCase());
  // Porovnávame aj pri neexistujúcom mene, aby čas odpovede neprezrádzal účty.
  const ok = await passwordMatches(u?.password ?? "__none__", password);
  if (!u || !ok || !u.active || !accountAllowed(u)) return null;
  return { username: u.username, name: u.name, role: u.role };
}

/**
 * Aktívni volajúci = aktívny účet s rolou caller + záznam operátora ACTIVE s kanálom CALL.
 * Účet bez záznamu operátora nový lead nedostane nikdy.
 */
export function callers(): SessionUser[] {
  const all = configuredUsers().users;
  const ops = configuredOperators();
  return all
    .filter((u) => u.role === "caller" && u.active)
    .filter((u) => {
      const op = ops.find((o) => o.operator_id === u.username);
      return !!op && op.status === "ACTIVE" && op.channels.includes("CALL");
    })
    .map(({ username, name, role }) => ({ username, name, role }));
}

/** Meno podľa username. Neznámy účet (napr. pôvodný operátor v histórii) sa zobrazí neutrálne. */
export function userName(username: string | null | undefined): string {
  if (!username) return "nikto";
  return configuredUsers().users.find((u) => u.username === username)?.name ?? "Pôvodný operátor";
}

export function adminName(): string {
  return configuredUsers().users.find((u) => u.role === "admin")?.name ?? "Dominik";
}

/** Je Lead Engine na serveri pripravený (tajný kľúč + trvalé úložisko)? */
export function setupStatus(): { ready: boolean; persistent: boolean } {
  const persistent = !!(
    (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) ||
    blobConfigured()
  );
  if (process.env.NODE_ENV !== "production") return { ready: true, persistent: true };
  // Bez platného LE_USERS sa nikto neprihlási (fail-safe), login ukáže dôvod.
  // Testovací deploy bez úložiska: beží, ale dáta sú iba dočasné (upozornenie v UI).
  const ephemeralOk = process.env.LEADY_ALLOW_EPHEMERAL === "1";
  return { ready: (persistent || ephemeralOk) && !!sessionSecret(), persistent };
}

export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const s = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!s) return null;
  // Deaktivovaný alebo odstránený účet stratí prístup hneď, nie až po vypršaní cookie.
  const u = configuredUsers().users.find((x) => x.username === s.username);
  if (!u || !u.active || u.role !== s.role || !accountAllowed(u)) return null;
  return { username: u.username, name: u.name, role: u.role };
}

/** Pre stránky a server actions — bez session presmeruje na login. */
export async function requireUser(role?: Role): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) redirect("/leady/login?reauth=1");
  if (role && u.role !== role) redirect("/leady");
  return u;
}

/** Pre API — session cookie alebo Bearer LE_API_KEY (automatizácia). */
/** SHA-256 kľúča rannej rutiny. Samotný kľúč je iba v súkromnom prompte rutiny. */
const ROUTINE_KEY_SHA256 = "a52a8590de79e96cd112d1694776871afc286015d2f372a7ec7adeac346d5c2d";

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Buffer.from(buf).toString("hex");
}

export async function apiAuth(): Promise<SessionUser | null> {
  const h = await headers();
  const auth = h.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const given = auth.slice(7).trim();
    const key = process.env.LE_API_KEY;
    const ok =
      (key && key.length >= 24 && (await timingSafeStringEqual(given, key))) ||
      (await timingSafeStringEqual(await sha256Hex(given), process.env.LE_API_KEY_SHA256 || ROUTINE_KEY_SHA256));
    return ok ? { username: "automation", name: "Ranná rutina", role: "admin" } : null;
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
