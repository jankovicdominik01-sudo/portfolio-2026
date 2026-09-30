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
 * Predvolený účet na serveri bez LE_USERS: iba admin. Repozitár je verejný, preto
 * tu je iba scrypt hash (heslo má Dominik). Operátorov pridáva env LE_USERS, nie kód.
 */
export const DEFAULT_USERS: UserRecord[] = [
  {
    username: "dominik",
    name: "Dominik Jankovič",
    role: "admin",
    active: true,
    password: "scrypt$xkYE-gY_9dUibtGstpqi1Q$7dOACQLDdF-ViIlnG2lTz8BkZaHZqXW0_TDfw5uMqq0",
  },
];

/** Lokálny vývoj bez LE_USERS (heslo = meno). Nikdy na serveri. */
export const DEMO_USERS: UserRecord[] = [
  { username: "dominik", name: "Dominik Jankovič", role: "admin", active: true, password: "dominik" },
  { username: "roman", name: "Roman", role: "caller", active: true, speech: "m", password: "roman" },
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

export function usersFor(raw: string | undefined, nodeEnv: string | undefined): { users: UserRecord[]; demo: boolean } {
  if (raw) return { users: parseUsers(raw), demo: false };
  if (nodeEnv === "production") return { users: DEFAULT_USERS, demo: false };
  return { users: DEMO_USERS, demo: true };
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
