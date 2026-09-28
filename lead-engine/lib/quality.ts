/**
 * DATA QUALITY + SOURCE QUALITY + CALLER TRUST RATE — zlepšuje sa scraper naozaj?
 * Počíta sa na unikátnych leadoch (jedna firma nájdená v 4 zdrojoch = 1 lead).
 */
import { countLeads, type LC } from "./analytics";
import type { CallLog, FeedbackKind } from "./types";

/** Spätné väzby, ktoré znamenajú „volajúci musel opravovať dáta“. */
export const DATA_FIX: FeedbackKind[] = ["has_other_web", "wrong_web", "wrong_category", "wrong_description", "business_gone", "wrong_phone", "duplicate", "not_target"];

export const isRadar = (l: LC) => !!l.company.profile;
export const countryOf = (l: LC) => l.company.country ?? l.company.profile?.country ?? "SK";

/** Discovery zdroj (odkiaľ firmu radar objavil) — kombinované identity sa počítajú raz, pod prvým zdrojom. */
export function discoverySource(l: LC): string {
  const s = l.company.profile?.sources?.[0]?.source ?? l.company.sources?.[0]?.source ?? l.source;
  const v = String(s);
  if (v.startsWith("search:instagram")) return "instagram";
  if (v.startsWith("search:facebook")) return "facebook";
  if (v.startsWith("search:web")) return "google/search";
  if (v === "google_business") return "google business";
  return v;
}

export type Quality = {
  radarLeads: number;
  resolution: Record<string, number>;
  tiers: Record<string, number>;
  feedback: Record<string, number>;
  descriptionUnknown: number;
  categoryLow: number;
  duplicateRisk: number;
  duplicateRate: number | null;
  rejectedBeforeQueue: number;
  review: number;
  callerTrust: { num: number; den: number; value: number | null };
};

export function dataQuality(leads: LC[], calls: CallLog[]): Quality {
  const radar = leads.filter(isRadar);
  const inc = (o: Record<string, number>, k: string) => (o[k] = (o[k] ?? 0) + 1);
  const resolution: Record<string, number> = {};
  const tiers: Record<string, number> = {};
  const feedback: Record<string, number> = {};
  let descriptionUnknown = 0;
  let categoryLow = 0;
  let duplicateRisk = 0;
  let rejectedBeforeQueue = 0;
  let review = 0;
  for (const l of radar) {
    const p = l.company.profile!;
    if (l.archive_reason && !l.assigned_to) rejectedBeforeQueue++;
    if (l.status === "analyzed" && l.next_action === "review") review++;
    if (l.archive_reason) continue;
    inc(resolution, l.website_resolution ?? p.website?.status ?? "uncertain");
    inc(tiers, l.data_quality ?? p.data_quality ?? "research");
    if (!p.description || p.description.confidence === "unknown") descriptionUnknown++;
    if (!["high", "medium"].includes(p.category?.confidence ?? "")) categoryLow++;
    if ((p.possible_duplicates ?? []).length) duplicateRisk++;
  }
  for (const l of leads) for (const f of l.feedback ?? []) inc(feedback, f.kind);
  const called = new Set(calls.filter((c) => c.role === "caller").map((c) => c.lead_id));
  const trustLeads = radar.filter((l) => called.has(l.id));
  const fixed = trustLeads.filter((l) => (l.feedback ?? []).some((f) => DATA_FIX.includes(f.kind)));
  const kept = radar.filter((l) => !l.archive_reason).length;
  return {
    radarLeads: radar.length,
    resolution,
    tiers,
    feedback,
    descriptionUnknown,
    categoryLow,
    duplicateRisk,
    duplicateRate: kept ? ((feedback.duplicate ?? 0) + duplicateRisk) / kept : null,
    rejectedBeforeQueue,
    review,
    callerTrust: {
      num: trustLeads.length - fixed.length,
      den: trustLeads.length,
      value: trustLeads.length ? (trustLeads.length - fixed.length) / trustLeads.length : null,
    },
  };
}

/** source → leads → calls → conversations → interested → demo → won (unikátne leady). */
export function sourceFunnel(leads: LC[], calls: CallLog[], users: { username: string; name: string }[]) {
  const groups = new Map<string, LC[]>();
  for (const l of leads) {
    const k = discoverySource(l);
    groups.set(k, [...(groups.get(k) ?? []), l]);
  }
  return [...groups.entries()]
    .map(([source, ls]) => {
      const k = countLeads(ls, calls, users);
      const demo = ls.filter((l) => l.stage_at?.demo).length;
      return { source, leads: ls.length, called: k.attempted, conversation: k.conversation, consent: k.consent, interest: k.interest, demo, won: k.sale };
    })
    .sort((a, b) => b.leads - a.leads);
}

/** caller × kategória × krajina × výsledok — podklad pre routing (NIE rebríček ľudí). */
export function routingMatrix(leads: LC[], calls: CallLog[], users: { username: string; name: string }[]) {
  const groups = new Map<string, LC[]>();
  for (const l of leads) {
    const who = l.assigned_to ?? l.assigned_history?.at(-1)?.user;
    if (!who) continue;
    const key = `${who}|${l.company.category}|${countryOf(l)}`;
    groups.set(key, [...(groups.get(key) ?? []), l]);
  }
  return [...groups.entries()]
    .map(([key, ls]) => {
      const [caller, category, country] = key.split("|");
      const k = countLeads(ls, calls, users, caller);
      const demo = ls.filter((l) => l.stage_at?.demo).length;
      return { caller, category, country, calls: k.calls, called: k.attempted, conversation: k.conversation, consent: k.consent, interest: k.interest, demo, won: k.sale };
    })
    .sort((a, b) => a.caller.localeCompare(b.caller) || b.called - a.called);
}
