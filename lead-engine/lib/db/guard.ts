import type { Repository } from "./types";

/**
 * Zápis do úložiska je povolený iba v produkcii (VERCEL_ENV=production) a lokálne (mimo Vercelu).
 * Preview / development deploy na Verceli je fail-closed iba na čítanie: žiadne výsledky hovorov,
 * spätná väzba, prepočty, demá, nastavenia ani rutina. Chýbajúci VERCEL_ENV na Verceli = zákaz.
 */
export function writesAllowed(env: Record<string, string | undefined> = process.env): boolean {
  const v = env.VERCEL_ENV;
  if (!v) return env.VERCEL !== "1";
  return v === "production";
}

export class ReadOnlyEnvironmentError extends Error {
  constructor(op: string) {
    super(`Toto prostredie (${process.env.VERCEL_ENV ?? "neznáme"}) je iba na čítanie. Zápis „${op}“ je povolený iba v produkcii.`);
  }
}

export function assertWritable(op: string, env?: Record<string, string | undefined>) {
  if (!writesAllowed(env)) throw new ReadOnlyEnvironmentError(op);
}

const MUTATION = /^(insert|update|upsert|delete|save|mark)/;

/** Obal repository: čítanie prejde, každá zápisová metóda vyhodí chybu ešte pred volaním úložiska. */
export function readOnlyRepository(repo: Repository): Repository {
  return new Proxy(repo, {
    get(target, prop, receiver) {
      const v = Reflect.get(target, prop, receiver);
      if (typeof prop === "string" && typeof v === "function" && MUTATION.test(prop)) {
        return () => Promise.reject(new ReadOnlyEnvironmentError(prop));
      }
      return v;
    },
  });
}
