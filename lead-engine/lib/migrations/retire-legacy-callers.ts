/**
 * Jednorazová migrácia: pôvodní volajúci zmiznú z identity systému, obchodná história ostane.
 *
 *  - username v poliach (assigned_to, by_user, consent.by_user, commission.user, routing)
 *    → LEGACY_OPERATOR_ID; assigned_to → null (nevolané leady → aktívny operátor, ak je zadaný)
 *  - mená vo voľnom texte (eventy, poznámky, notifikácie, dôvody) → „pôvodný operátor“
 *  - odporúčanie radaru na pôvodného volajúceho → null
 *  - PANENKA: hovor aj súhlas urobil Roman. Ak sú uložené pod pôvodným volajúcim,
 *    je to chyba v dátach a opraví sa na Romana.
 *
 * Nič sa nemaže: leady, hovory, eventy, provízie aj sumy ostávajú. Migrácia je idempotentná
 * (druhý beh nič nenájde) a predvolene beží na sucho (iba zoznam zmien).
 *
 * Toto je jediné miesto v kóde, ktoré pôvodné identity pozná, lebo ich musí vedieť nájsť.
 */
import type { Repository } from "../db/types";
import type { CallLog, Commission, Company, Lead, LeadEvent, Notification, Settings } from "../types";

export const LEGACY_OPERATOR_ID = "legacy_operator";
export const LEGACY_OPERATOR_LABEL = "pôvodný operátor";

const LEGACY_USERNAMES = new Set(["sona", "jozo"]);
const LEGACY_NAME = /(?<!\p{L})(?:So[nň]a|So[nň]in\p{L}*|So[nň]i|So[nň]u|So[nň]ou|Jo[zž]o|Jo[zž]a|Jo[zž]ovi|Jo[zž]om|Jo[zž]ov\p{L}*|sona|jozo)(?!\p{L})/gu;

/** Firmy, kde hovor preukázateľne robil Roman (prvá reálna konverzia). */
const ROMAN_CASES = [/panenka/i];
const ROMAN = { id: "roman", name: "Roman" };

export type Snapshot = {
  companies: Company[];
  leads: Lead[];
  calls: CallLog[];
  events: LeadEvent[];
  commissions: Commission[];
  notifications: Notification[];
  settings: Settings;
};

export type Change =
  | { kind: "lead"; id: string; patch: Partial<Lead> }
  | { kind: "company"; id: string; patch: Partial<Company> }
  | { kind: "call"; id: string; patch: Partial<CallLog> }
  | { kind: "event"; id: string; patch: Partial<LeadEvent> }
  | { kind: "commission"; row: Commission }
  | { kind: "notification"; id: string; patch: Partial<Notification> }
  | { kind: "settings"; settings: Settings };

export type Plan = { changes: Change[]; summary: Record<string, number>; roman_cases: string[] };

export const isLegacyUser = (u: string | null | undefined) => !!u && LEGACY_USERNAMES.has(u.toLowerCase());
/** Username v technickom texte radaru („GOLD · … · jozo · skóre 72“, „Podlahy → sona“). Nie mená v URL ani v názvoch firiem. */
const TRACE_USER = /(?<=[·→:] )(sona|jozo)(?=[\s,;)·]|$)/gu;
const hasTraceUser = (t: string | null | undefined) => !!t && new RegExp(TRACE_USER.source, "u").test(t);

/** Hlboká úprava JSON hodnoty: reťazce aj kľúče; pri zlúčení kľúčov sa čísla sčítajú. */
function deepMap(v: unknown, str: (s: string) => string, key: (k: string) => string): unknown {
  if (typeof v === "string") return str(v);
  if (Array.isArray(v)) return v.map((x) => deepMap(x, str, key));
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) {
      const nk = key(k);
      const nx = deepMap(x, str, key);
      out[nk] = nk in out && typeof out[nk] === "number" && typeof nx === "number" ? (out[nk] as number) + nx : nx;
    }
    return out;
  }
  return v;
}
const hasLegacyDeep = (v: unknown): boolean =>
  JSON.stringify(v ?? null).split(/"/).some((part) => isLegacyUser(part) || hasLegacyName(part));
export const hasLegacyName = (t: string | null | undefined) => !!t && new RegExp(LEGACY_NAME.source, "u").test(t);

export function planMigration(s: Snapshot, opts: { reassignUnworkedTo?: string | null } = {}): Plan {
  const changes: Change[] = [];
  const summary: Record<string, number> = {};
  const bump = (k: string) => (summary[k] = (summary[k] ?? 0) + 1);
  const companyById = new Map(s.companies.map((c) => [c.id, c]));

  const romanLeads = new Set(
    s.leads.filter((l) => ROMAN_CASES.some((re) => re.test(companyById.get(l.company_id)?.name ?? ""))).map((l) => l.id),
  );
  const who = (leadId: string | null | undefined) =>
    leadId && romanLeads.has(leadId) ? { id: ROMAN.id, name: ROMAN.name, text: ROMAN.name } : { id: LEGACY_OPERATOR_ID, name: capital(LEGACY_OPERATOR_LABEL), text: LEGACY_OPERATOR_LABEL };
  const text = (t: string, leadId?: string | null) => t.replace(new RegExp(LEGACY_NAME.source, "gu"), who(leadId).text);
  const textOrNull = (t: string | null | undefined, leadId?: string | null) => (t && hasLegacyName(t) ? text(t, leadId) : null);

  /* ── leady ── */
  for (const l of s.leads) {
    const patch: Partial<Lead> = {};
    const w = who(l.id);
    if (isLegacyUser(l.assigned_to)) {
      const unworked = l.status === "ready_to_call" && (l.call_attempts ?? 0) === 0;
      patch.assigned_to = romanLeads.has(l.id) ? ROMAN.id : unworked ? (opts.reassignUnworkedTo ?? null) : null;
      bump(romanLeads.has(l.id) ? "leads_fixed_to_roman" : unworked && opts.reassignUnworkedTo ? "leads_reassigned_to_active_operator" : "leads_unassigned");
    }
    if (l.assigned_history?.some((h) => isLegacyUser(h.user) || hasLegacyName(h.by))) {
      patch.assigned_history = l.assigned_history.map((h) => ({ ...h, user: isLegacyUser(h.user) ? w.id : h.user, by: hasLegacyName(h.by) ? text(h.by, l.id) : h.by }));
    }
    if (l.consent && (isLegacyUser(l.consent.by_user) || hasLegacyName(l.consent.by_name))) {
      patch.consent = { ...l.consent, by_user: w.id, by_name: w.name };
      bump(romanLeads.has(l.id) ? "consent_fixed_to_roman" : "consent_anonymized");
    }
    if (isLegacyUser(l.recommended_caller)) patch.recommended_caller = null;
    if (l.caller_fit?.reasons.some((r) => hasLegacyName(r))) patch.caller_fit = { ...l.caller_fit, reasons: l.caller_fit.reasons.map((r) => text(r, l.id)) };
    if (l.priority_reasons.some((r) => hasLegacyName(r))) patch.priority_reasons = l.priority_reasons.map((r) => text(r, l.id));
    const notes = textOrNull(l.notes, l.id);
    if (notes !== null) patch.notes = notes;
    // Call brief je scenár na ďalší hovor, nie história: meno pôvodného volajúceho → aktívny operátor.
    if (l.call_brief && hasLegacyDeep(l.call_brief)) {
      // Skutočné mená z firmy (napr. majiteľka s rovnakým krstným menom) sa nikdy nemenia.
      const co = companyById.get(l.company_id);
      const keep = [co?.contact_person, co?.name].filter((x): x is string => !!x && x.length > 2);
      const swap = (t: string) => {
        const masked = keep.reduce((acc, k, i) => acc.split(k).join(`\u0000${i}\u0000`), t);
        return keep.reduce((acc, k, i) => acc.split(`\u0000${i}\u0000`).join(k), masked.replace(new RegExp(LEGACY_NAME.source, "gu"), ROMAN.name));
      };
      patch.call_brief = deepMap(l.call_brief, swap, (k) => k) as Lead["call_brief"];
    }
    if (Object.keys(patch).length) {
      changes.push({ kind: "lead", id: l.id, patch });
      bump("leads");
    }
  }

  /* ── firmy: odporúčanie radaru ── */
  for (const c of s.companies) {
    const p = c.profile;
    if (!p) continue;
    const rec = isLegacyUser(p.recommended_caller);
    const reasons = p.caller_fit?.reasons.some((r) => hasLegacyName(r));
    const trace = (p.trace ?? []).some((t) => hasTraceUser(t.detail));
    if (rec || reasons || trace) {
      const traceName = s.leads.some((l) => l.company_id === c.id && romanLeads.has(l.id)) ? ROMAN.id : LEGACY_OPERATOR_LABEL;
      changes.push({
        kind: "company",
        id: c.id,
        patch: {
          profile: {
            ...p,
            recommended_caller: rec ? null : p.recommended_caller,
            caller_fit: p.caller_fit ? { ...p.caller_fit, reasons: p.caller_fit.reasons.map((r) => text(r)) } : p.caller_fit,
            trace: (p.trace ?? []).map((t) => ({ ...t, detail: t.detail.replace(new RegExp(TRACE_USER.source, "gu"), traceName) })),
          },
        },
      });
      bump("companies");
    }
  }

  /* ── hovory ── */
  for (const c of s.calls) {
    if (!isLegacyUser(c.by_user) && !hasLegacyName(c.by) && !hasLegacyName(c.note) && !hasLegacyName(c.company_said)) continue;
    const w = who(c.lead_id);
    const patch: Partial<CallLog> = {};
    if (isLegacyUser(c.by_user) || hasLegacyName(c.by)) Object.assign(patch, { by_user: w.id, by: w.name });
    const note = textOrNull(c.note, c.lead_id);
    if (note !== null) patch.note = note;
    const said = textOrNull(c.company_said, c.lead_id);
    if (said !== null) patch.company_said = said;
    changes.push({ kind: "call", id: c.id, patch });
    bump(romanLeads.has(c.lead_id) ? "calls_fixed_to_roman" : "calls_anonymized");
  }

  /* ── eventy ── */
  for (const e of s.events) {
    if (!hasLegacyName(e.actor) && !hasLegacyName(e.label)) continue;
    const patch: Partial<LeadEvent> = {};
    if (hasLegacyName(e.actor)) patch.actor = who(e.lead_id).name;
    if (hasLegacyName(e.label)) patch.label = text(e.label, e.lead_id);
    changes.push({ kind: "event", id: e.id, patch });
    bump(romanLeads.has(e.lead_id) ? "events_fixed_to_roman" : "events_anonymized");
  }

  /* ── provízie: suma aj stav ostávajú, mení sa iba identita ── */
  for (const c of s.commissions) {
    if (!isLegacyUser(c.user) && !hasLegacyName(c.reason)) continue;
    changes.push({ kind: "commission", row: { ...c, user: isLegacyUser(c.user) ? who(c.lead_id).id : c.user, reason: text(c.reason, c.lead_id) } });
    bump("commissions");
  }

  /* ── notifikácie ── */
  for (const n of s.notifications) {
    if (!hasLegacyName(n.title) && !hasLegacyName(n.body)) continue;
    changes.push({ kind: "notification", id: n.id, patch: { title: text(n.title, n.lead_id), body: text(n.body, n.lead_id) } });
    bump("notifications");
  }

  /* ── nastavenia: routing + história behov radaru ── */
  const routing = s.settings.routing ?? {};
  const legacyRouting = Object.values(routing).some((v) => isLegacyUser(v));
  const legacyRadar = hasLegacyDeep(s.settings.radar);
  if (legacyRouting || legacyRadar) {
    const clean = Object.fromEntries(Object.entries(routing).filter(([, v]) => !isLegacyUser(v)));
    const radar = legacyRadar
      ? (deepMap(
          s.settings.radar,
          (t) => (isLegacyUser(t) ? LEGACY_OPERATOR_LABEL : t.replace(new RegExp(LEGACY_NAME.source, "gu"), LEGACY_OPERATOR_LABEL)),
          (k) => (isLegacyUser(k) ? LEGACY_OPERATOR_LABEL : k),
        ) as Settings["radar"])
      : s.settings.radar;
    changes.push({ kind: "settings", settings: { ...s.settings, routing: clean, radar } });
    if (legacyRouting) bump("settings_routing");
    if (legacyRadar) bump("settings_radar_history");
  }

  return { changes, summary, roman_cases: [...romanLeads] };
}

export async function loadSnapshot(r: Repository): Promise<Snapshot> {
  const [companies, leads, calls, events, commissions, notifications, settings] = await Promise.all([
    r.listCompanies(),
    r.listLeads(),
    r.listAllCalls(),
    r.listAllEvents(),
    r.listCommissions(),
    r.listNotifications(),
    r.getSettings(),
  ]);
  return { companies, leads, calls, events, commissions, notifications, settings };
}

export async function applyMigration(r: Repository, plan: Plan): Promise<void> {
  for (const c of plan.changes) {
    if (c.kind === "lead") await r.updateLead(c.id, c.patch);
    else if (c.kind === "company") await r.updateCompany(c.id, c.patch);
    else if (c.kind === "call") await r.updateCall(c.id, c.patch);
    else if (c.kind === "event") await r.updateEvent(c.id, c.patch);
    else if (c.kind === "commission") await r.upsertCommission(c.row);
    else if (c.kind === "notification") await r.updateNotification(c.id, c.patch);
    else if (c.kind === "settings") await r.saveSettings(c.settings);
  }
}

function capital(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
