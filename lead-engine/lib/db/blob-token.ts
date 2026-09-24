/**
 * Token k Vercel Blob. Vercel ho pri pripojení úložiska niekedy uloží s vlastným
 * prefixom (napr. LEAD_ENGINE_READ_WRITE_TOKEN), preto hľadáme aj podľa hodnoty.
 */
export function blobToken(): string | undefined {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  for (const [k, v] of Object.entries(process.env)) {
    if (v && k.endsWith("READ_WRITE_TOKEN") && v.startsWith("vercel_blob_rw_")) return v;
  }
  return undefined;
}

/** Iba názvy premenných (nikdy hodnoty) — na diagnostiku, prečo sa Blob nenašiel. */
export function blobEnvNames(): string[] {
  return Object.keys(process.env).filter((k) => /BLOB|READ_WRITE_TOKEN|STORE_ID/i.test(k));
}
