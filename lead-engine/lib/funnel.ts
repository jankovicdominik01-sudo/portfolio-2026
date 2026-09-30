/**
 * Lievik akvizičného kanála. Nie je to monitoring človeka: meria, či hovory fungujú
 * lepšie než async správy, a kde sa leady strácajú. Počíta UNIKÁTNE leady.
 *
 *   assigned     lead mal operátor niekedy priradený
 *   attempted    operátor aspoň raz volal
 *   answered     niekto zdvihol (čokoľvek okrem „nezdvihol“)
 *   callback     dohodnutý ďalší hovor (zavolať neskôr / záujem s termínom)
 *   interested   firma prejavila záujem (záujem alebo Dominik follow-up)
 *   dominik      Dominik follow-up (súhlas, aby sa Dominik ozval)
 *   offer        ponuka odoslaná (stage_at.offer_sent)
 *   won          dohoda alebo zaplatené
 */
import type { CallLog, Lead } from "./types";

export const FUNNEL_STEPS = ["assigned", "attempted", "answered", "callback", "interested", "dominik", "offer", "won"] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];
export const FUNNEL_LABEL: Record<FunnelStep, string> = {
  assigned: "Priradené",
  attempted: "Volané",
  answered: "Dovolal sa",
  callback: "Callback",
  interested: "Záujem",
  dominik: "Dominik follow-up",
  offer: "Ponuka",
  won: "Výhra",
};
export type Funnel = Record<FunnelStep, number>;

const reached = (l: Lead, stage: string) => !!l.stage_at?.[stage] || l.status === stage;
const won = (l: Lead) => reached(l, "won") || reached(l, "paid") || l.status === "won" || l.status === "paid";
const offered = (l: Lead) => reached(l, "offer_sent") || won(l);

export function operatorFunnel(leads: Lead[], calls: CallLog[], operatorId: string): Funnel {
  const f = Object.fromEntries(FUNNEL_STEPS.map((s) => [s, 0])) as Funnel;
  const mine = new Map<string, CallLog[]>();
  for (const c of calls) {
    if (c.role !== "caller" || c.by_user !== operatorId) continue;
    mine.set(c.lead_id, [...(mine.get(c.lead_id) ?? []), c]);
  }
  for (const l of leads) {
    const cs = mine.get(l.id) ?? [];
    const assigned = l.assigned_to === operatorId || (l.assigned_history ?? []).some((h) => h.user === operatorId) || cs.length > 0;
    if (!assigned) continue;
    f.assigned++;
    if (!cs.length) continue;
    f.attempted++;
    if (cs.some((c) => c.outcome !== "no_answer")) f.answered++;
    if (cs.some((c) => c.outcome === "call_later" || (c.outcome === "interested" && l.next_action === "callback"))) f.callback++;
    const handoff = cs.some((c) => c.outcome === "consent" || c.dominik_may_call) || l.consent?.by_user === operatorId;
    if (handoff || cs.some((c) => c.outcome === "interested")) f.interested++;
    if (!handoff) continue;
    f.dominik++;
    if (offered(l)) f.offer++;
    if (won(l)) f.won++;
  }
  return f;
}

/** CALL vs ASYNC na rovnakých krokoch po kontakte: leady → kontakt s Dominikom → ponuka → výhra. */
export function channelComparison(leads: Lead[], calls: CallLog[]) {
  const called = new Set(calls.filter((c) => c.role === "caller").map((c) => c.lead_id));
  const channel = (l: Lead) =>
    called.has(l.id) ? "CALL" : (l.channel_decision as { channel?: string } | null | undefined)?.channel === "ASYNC" || l.next_action === "async_message" ? "ASYNC" : null;
  const rows = { CALL: { leads: 0, contact: 0, offer: 0, won: 0 }, ASYNC: { leads: 0, contact: 0, offer: 0, won: 0 } };
  for (const l of leads) {
    const ch = channel(l);
    if (!ch) continue;
    const r = rows[ch];
    r.leads++;
    if (l.consent || reached(l, "contacted") || offered(l)) r.contact++;
    if (offered(l)) r.offer++;
    if (won(l)) r.won++;
  }
  return rows;
}

/** Konverzia medzi susednými krokmi (null = menovateľ 0). */
export function stepRates(f: Funnel): { from: FunnelStep; to: FunnelStep; rate: number | null }[] {
  return FUNNEL_STEPS.slice(1).map((to, i) => {
    const from = FUNNEL_STEPS[i];
    return { from, to, rate: f[from] ? f[to] / f[from] : null };
  });
}
