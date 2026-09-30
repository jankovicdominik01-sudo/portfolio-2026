import "server-only";
import { scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, sessionSecret, timingSafeStringEqual, verifySession } from "./session";
import type { Role, SessionUser, UserInfo } from "./types";
import { blobConfigured } from "./db/blob-token";
import { configuredOperators, isLegacy } from "./operators";

type UserRecord = UserInfo & { password: string };

/**
 * Predvolené účty Lead Engine. Repozitár je verejný, preto tu sú iba
 * scrypt hashe (heslá má Dominik). Prepíše ich env LE_USERS.
 *
 * Žiadna logika nie je viazaná na konkrétne meno: volajúci = rola "caller".
 * Nové leady rozdeľuje routing (segment → volajúci, Nastavenia → Routing) medzi AKTÍVNYCH volajúcich.
 * Aktívni sú Soňa aj Jozo; história Joza z 1.0 ostáva nedotknutá.
 */
const DEFAULT_USERS: UserRecord[] = [
  {
    username: "dominik",
    name: "Dominik Jankovič",
    role: "admin",
    active: true,
    password: "scrypt$xkYE-gY_9dUibtGstpqi1Q$7dOACQLDdF-ViIlnG2lTz8BkZaHZqXW0_TDfw5uMqq0",
  },
  {
    username: "sona",
    name: "Soňa",
    role: "caller",
    active: true,
    speech: "f",
    password: "scrypt$KQFspmMlTon9wgYg8J3R2g$Dbt4UsEyhbwWR3JY1HFRiBNpsFmE1KvlmFCLhN0QPPI",
  },
  {
    username: "jozo",
    name: "Jozo",
    role: "caller",
    active: true,
    speech: "m",
    password: "scrypt$OM_JJ5aWWF8JoyQlPhu4pQ$TKc6Uc8l3gG6KxOE-t_7yZzM8vNZOHLvoOHnSNXjRJo",
  },
];

/**
 * Používatelia z env LE_USERS (heslo môže byť aj scrypt$salt$hash), voliteľne na konci „inactive“ a „f“/„m“:
 *   "dominik|Dominik|admin|heslo;sona|Soňa|caller|heslo2|f;jozo|Jozo|caller|heslo3|m|inactive"
 * Bez LE_USERS: lokálne demo účty (heslo = meno), na serveri DEFAULT_USERS.
 */
export function configuredUsers(): { users: UserRecord[]; demo: boolean } {
  const raw = process.env.LE_USERS;
  if (!raw) {
    if (process.env.NODE_ENV === "production") return { users: DEFAULT_USERS, demo: false };
    return {
      demo: true,
      users: [
        { username: "dominik", name: "Dominik Jankovič", role: "admin", active: true, password: "dominik" },
        { username: "roman", name: "Roman", role: "caller", active: true, speech: "m", password: "roman" },
        // Legacy: účty ostávajú kvôli histórii, nové leady nedostávajú (lib/operators.ts).
        { username: "sona", name: "Soňa", role: "caller", active: false, speech: "f", password: "sona" },
        { username: "jozo", name: "Jozo", role: "caller", active: false, speech: "m", password: "jozo" },
      ],
    };
  }
  const users = raw
    .split(";")
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => {
      const parts = row.split("|");
      // Voliteľné príznaky na konci: active|inactive a f|m (tvar slovies v scenári).
      const flags: string[] = [];
      while (parts.length > 4 && /^(active|inactive|f|m)$/i.test(parts[parts.length - 1].trim())) {
        flags.push(parts.pop()!.trim().toLowerCase());
      }
      const [username, name, role, ...pw] = parts;
      return {
        username: username.trim().toLowerCase(),
        name: name.trim(),
        role: (role.trim() === "admin" ? "admin" : "caller") as Role,
        active: !flags.includes("inactive"),
        speech: flags.includes("f") ? ("f" as const) : flags.includes("m") ? ("m" as const) : undefined,
        password: pw.join("|"),
      };
    })
    .filter((u) => u.username && u.password.length >= 6);
  return { users, demo: false };
}

/** Všetci používatelia bez hesiel (aj neaktívni — kvôli histórii a filtrom). */
export function allUsers(): UserInfo[] {
  return configuredUsers().users.map(({ username, name, role, active, speech }) => ({ username, name, role, active, speech }));
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
  if (!u || !ok || !u.active) return null;
  return { username: u.username, name: u.name, role: u.role };
}

/**
 * Aktívni volajúci = aktívny účet + operátor ACTIVE s kanálom CALL. Dostávajú nové leady.
 * Legacy operátori (Soňa, Jozo) sem nepatria nikdy, aj keby mali aktívny účet.
 */
export function callers(): SessionUser[] {
  const all = configuredUsers().users;
  const ops = configuredOperators(all);
  return all
    .filter((u) => u.role === "caller" && u.active && !isLegacy(u.username))
    .filter((u) => {
      const op = ops.find((o) => o.operator_id === u.username);
      return !!op && op.status === "ACTIVE" && op.channels.includes("CALL");
    })
    .map(({ username, name, role }) => ({ username, name, role }));
}

/** Meno podľa username (aj neaktívneho) — pre históriu. */
export function userName(username: string | null | undefined): string {
  if (!username) return "—";
  return configuredUsers().users.find((u) => u.username === username)?.name ?? username;
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
  if (!u || !u.active || u.role !== s.role) return null;
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
