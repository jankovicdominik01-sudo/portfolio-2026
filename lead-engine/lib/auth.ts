import "server-only";
import { scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, sessionSecret, timingSafeStringEqual, verifySession } from "./session";
import type { Role, SessionUser } from "./types";

type UserRecord = SessionUser & { password: string };

/**
 * Predvolené účty Lead Engine. Repozitár je verejný, preto tu sú iba
 * scrypt hashe (heslá má Dominik). Prepíše ich env LE_USERS.
 */
const DEFAULT_USERS: UserRecord[] = [
  {
    username: "dominik",
    name: "Dominik Jankovič",
    role: "admin",
    password: "scrypt$xkYE-gY_9dUibtGstpqi1Q$7dOACQLDdF-ViIlnG2lTz8BkZaHZqXW0_TDfw5uMqq0",
  },
  {
    username: "jozo",
    name: "Jozo",
    role: "caller",
    password: "scrypt$OM_JJ5aWWF8JoyQlPhu4pQ$TKc6Uc8l3gG6KxOE-t_7yZzM8vNZOHLvoOHnSNXjRJo",
  },
];

/**
 * Používatelia z env LE_USERS (heslo môže byť aj scrypt$salt$hash):
 *   "dominik|Dominik|admin|heslo;jozo|Jozo|caller|heslo2"
 * Bez LE_USERS: lokálne demo účty dominik/dominik a jozo/jozo, na serveri DEFAULT_USERS.
 */
export function configuredUsers(): { users: UserRecord[]; demo: boolean } {
  const raw = process.env.LE_USERS;
  if (!raw) {
    if (process.env.NODE_ENV === "production") return { users: DEFAULT_USERS, demo: false };
    return {
      demo: true,
      users: [
        { username: "dominik", name: "Dominik Jankovič", role: "admin", password: "dominik" },
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

const scryptAsync = promisify(scrypt) as (pw: string, salt: string, len: number) => Promise<Buffer>;

async function passwordMatches(stored: string, given: string): Promise<boolean> {
  if (stored.startsWith("scrypt$")) {
    const [, salt, hash] = stored.split("$");
    const expected = Buffer.from(hash, "base64url");
    const actual = await scryptAsync(given, salt, expected.length);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
  return timingSafeStringEqual(stored, given);
}

export async function authenticate(username: string, password: string): Promise<SessionUser | null> {
  const { users } = configuredUsers();
  const u = users.find((x) => x.username === username.trim().toLowerCase());
  // Porovnávame aj pri neexistujúcom mene, aby čas odpovede neprezrádzal účty.
  const ok = await passwordMatches(u?.password ?? "__none__", password);
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

/** Je Lead Engine na serveri pripravený (tajný kľúč + trvalé úložisko)? */
export function setupStatus(): { ready: boolean; persistent: boolean } {
  const persistent = !!(
    (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) ||
    process.env.BLOB_READ_WRITE_TOKEN
  );
  if (process.env.NODE_ENV !== "production") return { ready: true, persistent: true };
  // Testovací deploy bez úložiska: beží, ale dáta sú iba dočasné (upozornenie v UI).
  const ephemeralOk = process.env.LEADY_ALLOW_EPHEMERAL === "1";
  return { ready: (persistent || ephemeralOk) && !!sessionSecret(), persistent };
}

export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

/** Pre stránky a server actions — bez session presmeruje na login. */
export async function requireUser(role?: Role): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) redirect("/leady/login");
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
