/**
 * Podpísaná session v cookie (HMAC-SHA256, Web Crypto).
 * Beží v proxy aj v server komponentoch — žiadne Node-only API.
 */
import type { Role, SessionUser } from "./types";

export const SESSION_COOKIE = "le_session";
export const SESSION_TTL_S = 60 * 60 * 24 * 14; // 14 dní

const enc = new TextEncoder();

/**
 * Kľúč na podpis session. Poradie: SESSION_SECRET → token úložiska (Blob/Supabase).
 * Token úložiska je tajný server-side env, ktorý Vercel doplní pri pripojení Blob
 * store — netreba teda nastavovať nič navyše. Bez neho sa v produkcii neprihlási nikto.
 */
export function sessionSecret(): string | null {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  const storage = process.env.BLOB_READ_WRITE_TOKEN || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (storage && storage.length >= 24) return `le-session:${storage}`;
  if (process.env.NODE_ENV !== "production") return "dev-only-secret-dev-only-secret-dev-only";
  return null;
}

function secret(): string {
  const s = sessionSecret();
  if (!s) throw new Error("Lead Engine nemá nastavené úložisko ani SESSION_SECRET.");
  return s;
}

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmac(data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

function safeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

type Payload = { u: string; n: string; r: Role; exp: number };

export async function signSession(user: SessionUser): Promise<string> {
  const payload: Payload = {
    u: user.username,
    n: user.name,
    r: user.role,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_S,
  };
  const body = b64url(enc.encode(JSON.stringify(payload)));
  return `${body}.${b64url(await hmac(body))}`;
}

export async function verifySession(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token || !sessionSecret()) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    if (!safeEqual(fromB64url(sig), await hmac(body))) return null;
    const p = JSON.parse(new TextDecoder().decode(fromB64url(body))) as Payload;
    if (!p.exp || p.exp < Date.now() / 1000) return null;
    if (p.r !== "admin" && p.r !== "caller") return null;
    return { username: p.u, name: p.n, role: p.r };
  } catch {
    return null;
  }
}

/** Porovnanie reťazcov bez časového úniku (cez HMAC oboch strán). */
export async function timingSafeStringEqual(a: string, b: string) {
  return safeEqual(await hmac(`cmp:${a}`), await hmac(`cmp:${b}`));
}
