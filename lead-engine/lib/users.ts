/**
 * Účty Lead Engine: parsovanie LE_USERS, overenie hesla a pravidlo prístupu.
 * Čistý modul bez Next.js, aby sa dal testovať (lib/auth.ts ho používa).
 *
 * Žiadna logika nie je viazaná na konkrétne meno: volajúci = rola "caller" + záznam
 * operátora (lib/operators.ts). Bez záznamu operátora sa volajúci neprihlási.
 */
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { configuredOperators, type Operator } from "./operators";
import type { Role, UserInfo } from "./types";

export type UserRecord = UserInfo & { password: string };

/**
 * DEV / DEMO účty iba pre lokálny vývoj bez LE_USERS (heslo v čistom texte, nikdy na serveri).
 * Nie sú to produkčné účty. Produkčné účty a ich hashe sú výhradne vo Vercel env LE_USERS.
 * `roman` je tu iba preto, aby lokálne sedel na predvolený záznam operátora.
 */
export const DEV_USERS: UserRecord[] = [
  { username: "dev-admin", name: "DEV admin", role: "admin", active: true, password: "dev-admin" },
  { username: "roman", name: "Roman (DEV)", role: "caller", active: true, speech: "m", password: "dev-roman" },
];

/**
 * LE_USERS: riadky oddelené „;“, polia „|“, voliteľne na konci „inactive“ a „f“/„m“:
 *   "dominik|Dominik Jankovič|admin|scrypt$…;roman|Roman|caller|scrypt$…|m"
 * Hash hesla: `npm run hash-password`. Heslo v čistom texte do env nedávaj.
 */
export function parseUsers(raw: string): UserRecord[] {
  return raw
    .split(";")
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => {
      const parts = row.split("|");
      const flags: string[] = [];
      while (parts.length > 4 && /^(active|inactive|f|m)$/i.test(parts[parts.length - 1].trim())) {
        flags.push(parts.pop()!.trim().toLowerCase());
      }
      const [username = "", name = "", role = "", ...pw] = parts;
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
}

export type UsersConfig = { users: UserRecord[]; demo: boolean; error: string | null };

/**
 * Účty podľa prostredia. Produkcia je fail-safe:
 *  - bez LE_USERS sa nikto neprihlási (žiadny zabudnutý predvolený účet v kóde),
 *  - heslo musí byť scrypt hash (čistý text sa v produkcii odmietne),
 *  - musí existovať aspoň jeden admin, inak sa neprihlási nikto.
 */
export function usersFor(raw: string | undefined, nodeEnv: string | undefined): UsersConfig {
  const prod = nodeEnv === "production";
  if (!raw?.trim()) {
    return prod ? { users: [], demo: false, error: "LE_USERS nie je nastavené." } : { users: DEV_USERS, demo: true, error: null };
  }
  const parsed = parseUsers(raw);
  if (!prod) return { users: parsed, demo: false, error: null };
  const users = parsed.filter((u) => u.password.startsWith("scrypt$"));
  if (users.length !== parsed.length) return { users: [], demo: false, error: "LE_USERS obsahuje heslo v čistom texte. V produkcii iba scrypt hash." };
  if (!users.some((u) => u.role === "admin" && u.active)) return { users: [], demo: false, error: "LE_USERS nemá aktívneho admina." };
  return { users, demo: false, error: null };
}

/**
 * Volajúci smie do systému iba so záznamom operátora ACTIVE alebo PAUSED.
 * Účet s rolou caller bez operátora (alebo INACTIVE) sa neprihlási a jeho session neplatí.
 */
export function accountAllowed(u: Pick<UserRecord, "username" | "role" | "active">, ops: Operator[] = configuredOperators()): boolean {
  if (!u.active) return false;
  if (u.role === "admin") return true;
  const op = ops.find((o) => o.operator_id === u.username);
  return !!op && op.status !== "INACTIVE";
}

const scryptAsync = promisify(scrypt) as (pw: string, salt: string, len: number) => Promise<Buffer>;

export async function passwordMatches(stored: string, given: string): Promise<boolean> {
  if (stored.startsWith("scrypt$")) {
    const [, salt, hash] = stored.split("$");
    const expected = Buffer.from(hash ?? "", "base64url");
    if (!salt || !expected.length) return false;
    const actual = await scryptAsync(given, salt, expected.length);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
  // Heslo v čistom texte (iba lokálne): porovnanie v konštantnom čase cez hash.
  const a = createHash("sha256").update(stored).digest();
  const b = createHash("sha256").update(given).digest();
  return timingSafeEqual(a, b);
}

/** scrypt$salt$hash, rovnaký formát ako overuje passwordMatches. */
export async function hashPassword(password: string, salt = randomSalt()): Promise<string> {
  const h = await scryptAsync(password, salt, 32);
  return `scrypt$${salt}$${h.toString("base64url")}`;
}

function randomSalt(): string {
  return randomBytes(16).toString("base64url");
}
