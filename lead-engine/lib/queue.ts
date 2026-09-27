/**
 * Denná fronta volajúceho a výber nových leadov.
 * Poradie: 1. dohodnuté callbacky, 2. ďalšie pokusy (nezdvihol), 3. nové leady.
 */
import type { Company, Lead } from "./types";

type L = Lead & { company?: Company };

const TZ = "Europe/Bratislava";
const endOfToday = (nowIso: string) => {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(nowIso));
  return new Date(`${ymd}T21:59:59.999Z`).getTime();
};
const due = (l: Lead, nowIso: string) => !l.next_action_at || new Date(l.next_action_at).getTime() <= endOfToday(nowIso);

const PRIO = { hot: 0, ready: 1, check: 2, low: 3 } as const;
const byScore = (a: Lead, b: Lead) =>
  (b.score?.points ?? -999) - (a.score?.points ?? -999) || PRIO[a.priority] - PRIO[b.priority] || a.created_at.localeCompare(b.created_at);

export type Today<T extends L = L> = { callbacks: T[]; retries: T[]; fresh: T[]; later: T[] };

export function buildToday<T extends L>(leads: T[], username: string, nowIso: string): Today<T> {
  const mine = leads.filter(
    (l) =>
      l.assigned_to === username &&
      (l.status === "ready_to_call" || l.status === "called") &&
      !l.company?.do_not_call,
  );
  const callbacks = mine.filter((l) => l.next_action === "callback" && due(l, nowIso));
  const retries = mine.filter((l) => l.next_action === "caller_call" && (l.call_attempts ?? 0) > 0 && due(l, nowIso));
  const fresh = mine.filter((l) => (l.call_attempts ?? 0) === 0 && l.next_action !== "callback" && due(l, nowIso));
  const shown = new Set([...callbacks, ...retries, ...fresh].map((l) => l.id));
  const later = mine.filter((l) => !shown.has(l.id));
  const byTime = (a: Lead, b: Lead) => (a.next_action_at ?? "").localeCompare(b.next_action_at ?? "");
  return {
    callbacks: callbacks.sort(byTime),
    retries: retries.sort(byScore),
    fresh: fresh.sort(byScore),
    later: later.sort(byTime),
  };
}

/** Koľko nových (ešte nevolaných) leadov má volajúci — ranná rutina dopĺňa do DAILY_NEW. */
export const DAILY_NEW = 10;
export function freshCount(leads: Lead[], username: string) {
  return leads.filter((l) => l.assigned_to === username && l.status === "ready_to_call" && (l.call_attempts ?? 0) === 0)
    .length;
}

/** Firma, ktorú už máme / volali sme — nesmie sa vrátiť ako nový lead. */
export const COOLDOWN_DAYS = 90;
export function inCooldown(company: Company, leads: Lead[], nowIso: string): string | null {
  if (company.do_not_call) return "Firma nechce, aby sme volali.";
  const own = leads.filter((l) => l.company_id === company.id);
  if (own.some((l) => !["lost", "archived"].includes(l.status))) return "Firma už je v systéme.";
  const last = own.map((l) => l.last_contact ?? l.updated_at).sort().at(-1);
  if (last && new Date(nowIso).getTime() - new Date(last).getTime() < COOLDOWN_DAYS * 86_400_000)
    return `Firme sme volali pred menej ako ${COOLDOWN_DAYS} dňami.`;
  return null;
}

/**
 * Výber najlepších N nových kandidátov: najvyššie skóre, max. 2 z jedného mesta,
 * bez firiem „nevolať“ a v cooldowne.
 */
export function selectDaily<T extends { score: { points: number }; city: string | null; blocked?: string | null }>(
  candidates: T[],
  n: number,
  perCity = 2,
): T[] {
  const out: T[] = [];
  const cities = new Map<string, number>();
  for (const c of [...candidates].filter((x) => !x.blocked).sort((a, b) => b.score.points - a.score.points)) {
    const k = (c.city ?? "").toLowerCase();
    if (k && (cities.get(k) ?? 0) >= perCity) continue;
    cities.set(k, (cities.get(k) ?? 0) + 1);
    out.push(c);
    if (out.length >= n) break;
  }
  return out;
}
