/**
 * Analytika na UNIKÁTNYCH leadoch (nie na počte hovorov). Každá metrika má čitateľa a menovateľa.
 * Definície (zobrazujú sa aj v UI):
 *  assigned      = leady, ktoré mal volajúci niekedy priradené
 *  attempted     = leady s ≥1 hovorom volajúceho
 *  contact       = leady, kde niekto zdvihol (každý výsledok okrem „nezdvihol“)
 *  conversation  = contact bez „zlé číslo“
 *  consent       = leady so súhlasom s kontaktom (alebo žiadosťou o info)
 *  dom_contacted = Dominik sa dovolal (stage_at.contacted)
 *  interest / demo / offer / sale (won) / paid = najvyššia dosiahnutá fáza (stage_at)
 */
import type { CallLog, Company, Lead } from "./types";
import { callUser } from "./workflow";

export type LC = Lead & { company: Company };

const LEGACY_CONSENT = new Set(["dominik_may_call", "wants_demo", "wants_price", "wants_email"]);
const NO_PICKUP = new Set(["no_answer"]);
const NO_CONVERSATION = new Set(["no_answer", "wrong_number"]);

export type Counts = {
  leads: number;
  assigned: number;
  attempted: number;
  calls: number;
  contact: number;
  conversation: number;
  consent: number;
  dom_contacted: number;
  interest: number;
  offer: number;
  sale: number;
  paid: number;
  revenue: number;
};

export type Rate = { key: string; label: string; num: number; den: number; value: number | null };

export function leadSource(l: LC): string {
  const s = l.company.sources?.[0]?.source;
  if (s) return s;
  const u = l.source_url ?? "";
  if (/azet\.sk/.test(u)) return "azet";
  if (/zoznam\.sk/.test(u)) return "zoznam";
  if (/bazos\.sk/.test(u)) return "bazos";
  if (/zlatestranky\.sk/.test(u)) return "zlatestranky";
  if (/google\./.test(u)) return "google";
  return l.source; // manual / import / routine / api
}

export function websiteProblem(l: LC): string {
  if (l.website_issue) return l.website_issue;
  if (l.website_status) return l.website_status;
  return "unknown";
}

type Users = { username: string; name: string }[];

export function countLeads(leads: LC[], calls: CallLog[], users: Users, caller: string | null = null): Counts {
  const callsByLead = new Map<string, CallLog[]>();
  for (const c of calls) {
    if (c.role !== "caller") continue;
    if (caller && callUser(c, users) !== caller) continue;
    const a = callsByLead.get(c.lead_id) ?? [];
    a.push(c);
    callsByLead.set(c.lead_id, a);
  }
  const k: Counts = {
    leads: leads.length,
    assigned: 0,
    attempted: 0,
    calls: 0,
    contact: 0,
    conversation: 0,
    consent: 0,
    dom_contacted: 0,
    interest: 0,
    offer: 0,
    sale: 0,
    paid: 0,
    revenue: 0,
  };
  for (const l of leads) {
    const everAssigned =
      (caller ? l.assigned_to === caller : !!l.assigned_to) ||
      (l.assigned_history ?? []).some((h) => (caller ? h.user === caller : !!h.user));
    const cs = callsByLead.get(l.id) ?? [];
    if (!everAssigned && !cs.length) continue;
    k.assigned++;
    if (!cs.length) continue;
    k.attempted++;
    k.calls += cs.length;
    if (cs.some((c) => !NO_PICKUP.has(c.outcome))) k.contact++;
    if (cs.some((c) => !NO_CONVERSATION.has(c.outcome))) k.conversation++;
    // Kto získal súhlas: nový záznam consent, alebo starší hovor s výsledkom handoffu.
    const legacy = cs.find((c) => LEGACY_CONSENT.has(c.outcome));
    const consentBy = l.consent?.by_user ?? (legacy ? callUser(legacy, users) : null);
    if (!consentBy || (caller && consentBy !== caller)) continue;
    k.consent++;
    const at = l.stage_at ?? {};
    if (at.contacted) k.dom_contacted++;
    if (at.interested) k.interest++;
    if (at.offer_sent) k.offer++;
    if (at.won) k.sale++;
    if (at.paid) {
      k.paid++;
      k.revenue += l.sale?.paid_amount ?? l.sale?.price ?? 0;
    }
  }
  return k;
}

const rate = (key: string, label: string, num: number, den: number): Rate => ({
  key,
  label,
  num,
  den,
  value: den ? num / den : null,
});

export function rates(k: Counts): Rate[] {
  return [
    rate("contact_rate", "Contact rate (zdvihli / skúšané leady)", k.contact, k.attempted),
    rate("conversation_rate", "Conversation rate (rozhovor / skúšané leady)", k.conversation, k.attempted),
    rate("consent_rate", "Súhlas s kontaktom (súhlasy / rozhovory)", k.consent, k.conversation),
    rate("handoff_to_conversation", "Handoff → Dominik sa dovolal", k.dom_contacted, k.consent),
    rate("conversation_to_interest", "Dominikov rozhovor → skutočný záujem", k.interest, k.dom_contacted),
    rate("interest_to_offer", "Záujem → ponuka", k.offer, k.interest),
    rate("offer_to_sale", "Ponuka → predaj", k.sale, k.offer),
    rate("lead_to_paid", "Lead → zaplatený predaj (zaplatené / pridelené)", k.paid, k.assigned),
  ];
}

/** Rozpad podľa kľúča (zdroj, problém webu, segment, pásmo skóre…). */
export function breakdown(
  leads: LC[],
  calls: CallLog[],
  users: Users,
  keyOf: (l: LC) => string[] | string,
): { key: string; counts: Counts }[] {
  const groups = new Map<string, LC[]>();
  for (const l of leads) {
    const ks = keyOf(l);
    for (const key of Array.isArray(ks) ? ks : [ks]) {
      const a = groups.get(key) ?? [];
      a.push(l);
      groups.set(key, a);
    }
  }
  return [...groups.entries()]
    .map(([key, ls]) => ({ key, counts: countLeads(ls, calls, users) }))
    .sort((a, b) => b.counts.assigned - a.counts.assigned);
}

/**
 * Learning loop: pre každý faktor skóre porovná leady S faktorom a BEZ neho
 * (súhlasy / rozhovory, zaplatené / pridelené). Pri malej vzorke to UI povie.
 */
export const MIN_SAMPLE = 20;
export function factorLift(leads: LC[], calls: CallLog[], users: Users) {
  const keys = new Set<string>();
  for (const l of leads) for (const f of [...(l.score?.factors ?? []), ...(l.score?.risks ?? [])]) keys.add(f.key);
  const has = (l: LC, k: string) => [...(l.score?.factors ?? []), ...(l.score?.risks ?? [])].some((f) => f.key === k);
  return [...keys].map((key) => {
    const w = countLeads(leads.filter((l) => has(l, key)), calls, users);
    const wo = countLeads(leads.filter((l) => l.score && !has(l, key)), calls, users);
    const cr = (k: Counts) => (k.conversation ? k.consent / k.conversation : null);
    return { key, with: w, without: wo, consentWith: cr(w), consentWithout: cr(wo), enough: w.conversation >= MIN_SAMPLE };
  });
}
