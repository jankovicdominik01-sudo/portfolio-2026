/**
 * Identity resolution: je nový záznam tá istá firma ako existujúca?
 * IČO je najsilnejší signál. Zhoda iba na názve + meste nestačí → UNCERTAIN (manuálne overenie).
 */
import type { Company } from "./types";
import { dedupeKeys } from "./scoring";

export type Identity = { same: boolean | null; confidence: "high" | "medium" | "low"; reason: string };

type Incoming = { name: string; city: string | null; phone: string | null; email: string | null; website: string | null; ico?: string | null };

const icoOf = (v: string | null | undefined) => {
  const d = (v ?? "").replace(/\D/g, "");
  return d.length >= 6 && d.length <= 8 ? d.padStart(8, "0") : null;
};

export function identityMatch(existing: Company, incoming: Incoming): Identity {
  const a = icoOf(existing.ico);
  const b = icoOf(incoming.ico);
  if (a && b) return a === b ? { same: true, confidence: "high", reason: "Rovnaké IČO" } : { same: false, confidence: "high", reason: "Iné IČO" };

  const ek = new Set(existing.dedupe_keys.length ? existing.dedupe_keys : dedupeKeys(existing));
  const ik = dedupeKeys(incoming);
  const hit = (prefix: string) => ik.some((k) => k.startsWith(prefix) && ek.has(k));
  if (hit("phone:")) return { same: true, confidence: "high", reason: "Rovnaký telefón" };
  if (hit("email:")) return { same: true, confidence: "high", reason: "Rovnaký e-mail" };
  if (hit("domain:")) return { same: true, confidence: "medium", reason: "Rovnaká doména webu" };
  if (hit("name:")) return { same: null, confidence: "low", reason: "Zhoda iba v názve a meste — over ručne" };
  return { same: false, confidence: "medium", reason: "Žiadny spoločný identifikátor" };
}

/** Zlúči zdroje (Azet + Zoznam + Bazoš = jedna firma, zdroje ako metadáta). */
export function mergeSources(
  prev: Company["sources"],
  add: { source: string; url: string | null; seen_at: string }[],
): NonNullable<Company["sources"]> {
  const out = [...(prev ?? [])];
  for (const s of add) if (!out.some((x) => x.source === s.source && x.url === s.url)) out.push(s);
  return out;
}
