import "server-only";
import { db } from "./db";
import { runAnalysis } from "./ai/analyze";
import { dominikOpening } from "./ai/brief";
import { adminName, allUsers, callers, userName } from "./auth";
import {
  applyCallerOutcome,
  applySalesStep,
  callUser,
  callerCanSee,
  pickCaller,
  reassignUnworked,
  WorkflowError,
  type CallerInput,
  type SalesInput,
  type SalesStep,
} from "./workflow";
import { buildToday } from "./queue";
import { buildCallCard } from "./script";
import { commissionEffects, compensationConfigured, earnings, recompute, type MoneyEvent } from "./money";
import { computePriority, computeTrust, dedupeKeys, isReadyToCall } from "./scoring";
import { endOfDay, addDays } from "./format";
import {
  COMMISSION_STATE_LABEL,
  type Settings,
  ARCHIVE_LABEL,
  DOMINIK_OUTCOME_LABEL,
  OUTCOME_LABEL,
  STATUS_LABEL,
  type ArchiveReason,
  type CallLog,
  type CallOutcome,
  type CallWhen,
  type Company,
  type DominikOutcome,
  type Lead,
  type LeadDetail,
  type LeadEvent,
  type LeadInput,
  type LeadStatus,
  type LeadWithCompany,
  type NextAction,
  type SessionUser,
} from "./types";

/**
 * Obchodná logika (use-cases). UI, API aj ranná rutina volajú iba tieto funkcie.
 * Každá funkcia dostáva používateľa a sama overuje oprávnenie.
 */

const id = (p: string) => `${p}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
const now = () => new Date().toISOString();

export class AccessError extends Error {}

function assertAdmin(u: SessionUser) {
  if (u.role !== "admin") throw new AccessError("Na toto nemáš oprávnenie.");
}

async function event(leadId: string, actor: string, kind: LeadEvent["kind"], label: string) {
  await (await db()).insertEvent({ id: id("ev"), lead_id: leadId, at: now(), actor, kind, label });
}

/* ─────────────────────────── Čítanie ─────────────────────────── */

export async function listLeads(u: SessionUser): Promise<LeadWithCompany[]> {
  const r = await db();
  const [leads, companies] = await Promise.all([r.listLeads(), r.listCompanies()]);
  const byId = new Map(companies.map((c) => [c.id, c]));
  return leads
    .map((l) => ({ ...l, company: byId.get(l.company_id)! }))
    .filter((l) => !!l.company && callerCanSee(u, l, l.company));
}

/**
 * `ownCall`: obrazovka hovoru smie kamarátovi ukázať aj lead, ktorý práve
 * odovzdal Dominikovi (inak by po uložení zmizla obrazovka „hotovo“).
 */
export async function getLead(
  u: SessionUser,
  leadId: string,
  opts: { ownCall?: boolean } = {},
): Promise<LeadDetail | null> {
  const r = await db();
  const lead = await r.getLead(leadId);
  if (!lead) return null;
  const own = opts.ownCall && lead.assigned_to === u.username;
  const [company, calls, events] = await Promise.all([
    r.getCompany(lead.company_id),
    r.listCalls(lead.id),
    r.listEvents(lead.id),
  ]);
  if (!company) return null;
  if (u.role !== "admin" && !callerCanSee(u, lead, company) && !own) return null;
  return { ...lead, company, calls, events };
}

/* ─────────────────────────── Vytvorenie / merge ─────────────────────────── */

export type CreateResult = { leadId: string; merged: boolean; created: boolean };

/**
 * Ingestion: validovaný vstup → deduplikácia → nová firma alebo MERGE.
 * Pri merge sa doplnia iba chýbajúce údaje a zapíše sa to do histórie.
 */
export async function createOrMergeLead(actor: SessionUser, input: LeadInput): Promise<CreateResult> {
  assertAdmin(actor);
  const r = await db();
  const keys = dedupeKeys(input);
  const existing = await r.findCompanyByKeys(keys);

  if (existing) {
    const patch: Partial<Company> = {};
    const fill = <K extends keyof Company>(k: K, v: Company[K] | null | undefined) => {
      if (v && !existing[k]) patch[k] = v as Company[K];
    };
    fill("phone", input.phone);
    fill("email", input.email);
    fill("website", input.website);
    fill("city", input.city);
    fill("region", input.region);
    fill("address", input.address);
    fill("contact_person", input.contact_person);
    if (existing.category === "ine" && input.category !== "ine") patch.category = input.category;
    const social = [...new Set([...existing.social_profiles, ...input.social_profiles])];
    if (social.length !== existing.social_profiles.length) patch.social_profiles = social;
    const mergedKeys = [...new Set([...existing.dedupe_keys, ...keys])];
    await r.updateCompany(existing.id, { ...patch, dedupe_keys: mergedKeys, updated_at: now() });

    const leads = (await r.listLeads()).filter((l) => l.company_id === existing.id);
    const lead = leads[0];
    if (lead) {
      const changed = Object.keys(patch);
      await event(
        lead.id,
        actor.name,
        "merged",
        changed.length
          ? `Nový záznam z ${sourceLabel(input.source)} zlúčený — doplnené: ${changed.join(", ")}`
          : `Duplicitný záznam z ${sourceLabel(input.source)} zlúčený, bez nových údajov`,
      );
      if (input.note) await r.updateLead(lead.id, { notes: appendNote(lead.notes, input.note), updated_at: now() });
      return { leadId: lead.id, merged: true, created: false };
    }
    return { leadId: await insertLead(actor, existing.id, input), merged: true, created: true };
  }

  const company: Company = {
    id: id("co"),
    name: input.name,
    category: input.category,
    city: input.city,
    region: input.region,
    contact_person: input.contact_person,
    phone: input.phone,
    email: input.email,
    address: input.address,
    website: input.website,
    social_profiles: input.social_profiles,
    dedupe_keys: keys,
    created_at: now(),
    updated_at: now(),
  };
  await r.insertCompany(company);
  return { leadId: await insertLead(actor, company.id, input), merged: false, created: true };
}

async function insertLead(actor: SessionUser, companyId: string, input: LeadInput) {
  const lead: Lead = {
    id: id("ld"),
    company_id: companyId,
    status: "new",
    priority: "check",
    priority_reasons: ["Firma ešte nebola analyzovaná."],
    source: input.source,
    source_url: input.source_url,
    assigned_to: null,
    analysis: null,
    call_brief: null,
    trust: { web: "unverified", phone: "unverified", company: "unverified", hook: "unverified" },
    qualification: null,
    next_action: "analyze",
    next_action_at: null,
    last_contact: null,
    call_attempts: 0,
    archive_reason: null,
    notes: input.note ?? "",
    created_at: now(),
    updated_at: now(),
  };
  await (await db()).insertLead(lead);
  await event(lead.id, actor.name, "created", `Lead pridaný (${sourceLabel(input.source)})`);
  return lead.id;
}

const sourceLabel = (s: LeadInput["source"]) =>
  ({ manual: "manuálne", import: "importu", api: "API", routine: "rannej rutiny" })[s];

const appendNote = (prev: string, note: string) => (prev ? `${prev}\n\n${note}` : note);

/* ─────────────────────────── Analýza ─────────────────────────── */

export async function analyzeLead(actor: SessionUser, leadId: string) {
  assertAdmin(actor);
  const r = await db();
  const lead = await r.getLead(leadId);
  if (!lead) throw new Error("Lead neexistuje.");
  const [company, offers] = await Promise.all([r.getCompany(lead.company_id), r.listOffers()]);
  if (!company) throw new Error("Firma neexistuje.");

  const { analysis, brief, signals } = await runAnalysis(company, offers);
  const trust = computeTrust(company, signals, analysis);
  const { priority, reasons } = computePriority(company, trust, analysis, offers);
  const ready = isReadyToCall(trust, analysis);

  // Po analýze nemeníme stav leadu, ktorý je už ďalej v procese.
  const early = lead.status === "new" || lead.status === "analyzed" || lead.status === "ready_to_call";
  const status: LeadStatus = early ? (ready ? "ready_to_call" : "analyzed") : lead.status;
  const assigned = status === "ready_to_call" ? (lead.assigned_to ?? pickCaller(callers())) : lead.assigned_to;
  const nextAction: NextAction | null = early ? (ready ? "caller_call" : "review") : (lead.next_action as NextAction);

  await r.updateLead(lead.id, {
    analysis,
    call_brief: brief,
    trust,
    priority,
    priority_reasons: reasons,
    status,
    assigned_to: assigned,
    next_action: nextAction,
    updated_at: now(),
  });
  await event(
    lead.id,
    actor.name,
    "analysis",
    analysis.nothing_found
      ? "AI analýza: nenájdený výrazný problém"
      : `AI analýza vytvorená${analysis.engine === "claude" ? "" : " (pravidlá)"}${ready ? " · lead pripravený na telefonát" : " · treba skontrolovať"}`,
  );
  return { ready, nothingFound: analysis.nothing_found };
}

/* ─────────────────────────── Hovor volajúceho ─────────────────────────── */

export type { CallerInput } from "./workflow";

export async function logCallerCall(u: SessionUser, leadId: string, input: CallerInput) {
  const r = await db();
  const lead = await r.getLead(leadId);
  if (!lead) throw new Error("Lead neexistuje.");
  const company = await r.getCompany(lead.company_id);
  if (!company) throw new Error("Firma neexistuje.");
  if (!callerCanSee(u, lead, company)) throw new AccessError("Tento lead ti nie je priradený.");

  let res;
  try {
    res = applyCallerOutcome(lead, u, input, now());
  } catch (e) {
    if (e instanceof WorkflowError) throw new AccessError(e.message);
    throw e;
  }
  const call: CallLog = { id: id("call"), ...res.call };
  await r.insertCall(call);
  await r.updateLead(lead.id, res.leadPatch);
  if (res.companyPatch) await r.updateCompany(company.id, res.companyPatch);
  await event(lead.id, u.name, "call", `${u.name} volala/volal — ${OUTCOME_LABEL[input.outcome]} (${call.attempt}. pokus)`);

  if (res.handoff) {
    const updated = { ...lead, ...res.leadPatch } as Lead;
    await applyMoney(updated, "consent");
    await event(lead.id, u.name, "handoff", `Súhlas s kontaktom — lead odovzdaný ${adminName()}ovi`);
    const c = res.leadPatch.consent!;
    await r.insertNotification({
      id: id("nt"),
      at: now(),
      lead_id: lead.id,
      kind: "qualified",
      title: `${c.kind === "info" ? "Chce informácie" : "Súhlas s kontaktom"} — ${company.name}`,
      body: `${u.name}${c.company_said ? `: „${c.company_said}“` : ""}${c.call_on ? ` · volať ${c.call_on}` : ""}`,
      read: false,
    });
  }
  return { handoff: res.handoff, closed: res.closed };
}

/* ─────────────────────────── Dominikov pipeline ─────────────────────────── */

const STEP_MONEY: Partial<Record<SalesStep, MoneyEvent>> = {
  contacted: "contacted",
  interested: "interested",
  deal: "deal",
  paid: "paid",
  bad_fit: "lost",
  not_interested: "lost",
};

export async function logSalesStep(u: SessionUser, leadId: string, step: SalesStep, input: SalesInput) {
  assertAdmin(u);
  const r = await db();
  const lead = await r.getLead(leadId);
  if (!lead) throw new Error("Lead neexistuje.");
  const settings = await r.getSettings();
  let patch: Partial<Lead>;
  try {
    patch = applySalesStep(lead, step, input, now(), settings.package.price);
  } catch (e) {
    if (e instanceof WorkflowError) throw new AccessError(e.message);
    throw e;
  }
  await r.insertCall({
    id: id("call"),
    lead_id: lead.id,
    created_at: now(),
    by: u.name,
    by_user: u.username,
    role: "admin",
    outcome: step,
    note: input.note,
    company_said: null,
    dominik_may_call: false,
    preferred_time: null,
    email: null,
  });
  await r.updateLead(lead.id, patch);
  const updated = { ...lead, ...patch } as Lead;
  // Pri predaji a platbe sa zároveň spĺňajú aj skoršie podmienky (kontakt, záujem).
  const ev = STEP_MONEY[step];
  if (ev === "deal" || ev === "paid") {
    await applyMoney(updated, "contacted");
    await applyMoney(updated, "interested");
  }
  if (ev) await applyMoney(updated, ev);
  await event(lead.id, u.name, "dominik_call", `${u.name} — ${DOMINIK_OUTCOME_LABEL[step]}${input.note ? `: ${input.note}` : ""}`);
}

/** Starý vstup (hovor Dominika) — ostáva kvôli kompatibilite, mapuje sa na nové kroky. */
export async function logDominikCall(u: SessionUser, leadId: string, outcome: DominikOutcome, note: string | null) {
  const map: Partial<Record<DominikOutcome, SalesStep>> = { send_offer: "offer", send_demo: "demo", no_answer: "unreachable" };
  const step = (map[outcome] ?? outcome) as SalesStep;
  return logSalesStep(u, leadId, step, { note, date: step === "follow_up" ? endOfDay(7).slice(0, 10) : null, price: null });
}

/* ─────────────────────────── Peniaze ─────────────────────────── */

async function applyMoney(lead: Lead, ev: MoneyEvent) {
  const r = await db();
  const [all, settings] = await Promise.all([r.listCommissions(), r.getSettings()]);
  const changes = commissionEffects(lead, ev, all, settings, now());
  for (const c of changes) {
    await r.upsertCommission(c);
    await event(
      lead.id,
      "Systém",
      "money",
      `Odmena ${userName(c.user)} (${c.kind === "handoff" ? "handoff" : "predaj"}): ${COMMISSION_STATE_LABEL[c.state]}${c.amount !== null ? ` · ${c.amount} €` : " · suma nenastavená"}`,
    );
  }
}

export async function saveSettings(u: SessionUser, next: Settings) {
  assertAdmin(u);
  const r = await db();
  await r.saveSettings(next);
  const [all, leads] = await Promise.all([r.listCommissions(), r.listLeads()]);
  const updated = recompute(all, next, leads);
  for (let i = 0; i < all.length; i++) {
    if (JSON.stringify(all[i]) !== JSON.stringify(updated[i])) await r.upsertCommission(updated[i]);
  }
}

export async function markCommissionPaid(u: SessionUser, commissionId: string) {
  assertAdmin(u);
  const r = await db();
  const c = (await r.listCommissions()).find((x) => x.id === commissionId);
  if (!c) throw new Error("Záznam neexistuje.");
  if (c.state !== "confirmed") throw new AccessError("Vyplatiť sa dá iba potvrdená odmena.");
  if (c.amount === null) throw new AccessError("Odmena nemá sumu — najprv nastav pravidlo odmeny.");
  await r.upsertCommission({ ...c, state: "paid", paid_at: now() });
  await event(c.lead_id, u.name, "money", `Odmena ${userName(c.user)} vyplatená · ${c.amount} €`);
}

export async function myEarnings(u: SessionUser) {
  const r = await db();
  const [all, settings] = await Promise.all([r.listCommissions(), r.getSettings()]);
  return { ...earnings(all, u.username, now()), configured: compensationConfigured(settings.compensation), settings };
}

/** Volajúci vidí svoje handoffy len v skrátenej podobe (firma, dátum, stav) — bez Dominikových poznámok. */
export async function myHandoffs(u: SessionUser) {
  const r = await db();
  const [leads, companies] = await Promise.all([r.listLeads(), r.listCompanies()]);
  const byId = new Map(companies.map((c) => [c.id, c]));
  return leads
    .filter((l) => l.consent?.by_user === u.username)
    .map((l) => ({
      id: l.id,
      name: byId.get(l.company_id)?.name ?? "?",
      at: l.consent!.at,
      kind: l.consent!.kind,
      status: l.status,
      price: l.sale?.price ?? null,
    }));
}

/** Soňina štatistika za dnes (unikátne leady a hovory). */
export async function myToday(u: SessionUser) {
  const r = await db();
  const calls = (await r.listAllCalls()).filter((c) => c.role === "caller" && callUser(c, allUsers()) === u.username);
  const day = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bratislava" }).format(new Date(iso));
  const today = day(now());
  const t = calls.filter((c) => day(c.created_at) === today);
  return {
    calls: t.length,
    conversations: new Set(t.filter((c) => !["no_answer", "wrong_number"].includes(c.outcome)).map((c) => c.lead_id)).size,
    consents: t.filter((c) => c.dominik_may_call).length,
  };
}

/* ─────────────────────────── Priradenia ─────────────────────────── */

/** Nevolané leady neaktívnych volajúcich presunie na aktívneho (história ostáva). */
export async function reassignFromInactive(u: SessionUser) {
  assertAdmin(u);
  const to = pickCaller(callers());
  if (!to) throw new AccessError("Nie je žiadny aktívny volajúci.");
  const r = await db();
  const leads = await r.listLeads();
  const inactive = allUsers().filter((x) => x.role === "caller" && !x.active).map((x) => x.username);
  let n = 0;
  for (const from of inactive) {
    for (const m of reassignUnworked(leads, from, to, now(), u.name)) {
      await r.updateLead(m.id, m.patch);
      await event(m.id, u.name, "assign", `Preradené z ${userName(from)} na ${userName(to)} (nevolaný lead)`);
      n++;
    }
  }
  return { moved: n, to };
}

const STATUS_NEXT: Partial<Record<LeadStatus, { next: NextAction | null; days: number | null }>> = {
  ready_to_call: { next: "caller_call", days: null },
  offer_sent: { next: "follow_up", days: 3 },
  negotiation: { next: "follow_up", days: 5 },
  won: { next: null, days: null },
  lost: { next: null, days: null },
};

export async function setStatus(u: SessionUser, leadId: string, status: LeadStatus) {
  assertAdmin(u);
  const r = await db();
  const lead = await r.getLead(leadId);
  if (!lead) throw new Error("Lead neexistuje.");
  const cfg = STATUS_NEXT[status];
  const patch: Partial<Lead> = { status, updated_at: now(), archive_reason: null };
  if (cfg) {
    patch.next_action = cfg.next;
    patch.next_action_at = cfg.days ? addDays(cfg.days) : null;
  }
  if (status === "ready_to_call" && !lead.assigned_to) patch.assigned_to = pickCaller(callers());
  await r.updateLead(lead.id, patch);
  await event(lead.id, u.name, "status", `Stav → ${STATUS_LABEL[status]}`);
}

export async function archiveLead(u: SessionUser, leadId: string, reason: ArchiveReason) {
  assertAdmin(u);
  const r = await db();
  await r.updateLead(leadId, {
    status: "archived",
    archive_reason: reason,
    next_action: null,
    next_action_at: null,
    updated_at: now(),
  });
  await event(leadId, u.name, "archive", `Vyradený — ${ARCHIVE_LABEL[reason]}`);
}

export async function saveNotes(u: SessionUser, leadId: string, notes: string) {
  assertAdmin(u);
  await (await db()).updateLead(leadId, { notes: notes.slice(0, 5000), updated_at: now() });
}

export async function assignLead(u: SessionUser, leadId: string, username: string | null) {
  assertAdmin(u);
  const valid = username === null || callers().some((c) => c.username === username);
  if (!valid) throw new Error("Neznámy volajúci.");
  await (await db()).updateLead(leadId, { assigned_to: username, updated_at: now() });
  await event(leadId, u.name, "status", username ? `Priradené: ${username}` : "Priradenie zrušené");
}

export async function updateCompany(u: SessionUser, leadId: string, patch: Partial<Company>) {
  assertAdmin(u);
  const r = await db();
  const lead = await r.getLead(leadId);
  if (!lead) throw new Error("Lead neexistuje.");
  const company = await r.getCompany(lead.company_id);
  if (!company) throw new Error("Firma neexistuje.");
  const next = { ...company, ...patch };
  await r.updateCompany(company.id, {
    ...patch,
    dedupe_keys: [...new Set([...company.dedupe_keys, ...dedupeKeys(next)])],
    updated_at: now(),
  });
}

function whenToDate(w: CallWhen): string {
  if (w === "today") return endOfDay(0);
  if (w === "tomorrow") return endOfDay(1);
  return addDays(7);
}

/* ─────────────────────────── Volajúci: fronta a karta hovoru ─────────────────────────── */

/** Dnešná fronta: callbacky → ďalšie pokusy → nové. */
export async function callerQueue(u: SessionUser) {
  const leads = await listLeads(u);
  return buildToday(leads, u.username, now());
}

/** Všetko, čo volajúci potrebuje k jednému hovoru — analýzu urobil systém. */
export async function callerLeadView(u: SessionUser, leadId: string) {
  const lead = await getLead(u, leadId, { ownCall: true });
  if (!lead) return null;
  const r = await db();
  const [offers, settings] = await Promise.all([r.listOffers(), r.getSettings()]);
  const me = allUsers().find((x) => x.username === u.username);
  const card = buildCallCard({
    lead,
    company: lead.company,
    callerName: u.name,
    speech: me?.speech,
    offers,
    nowIso: now(),
  });
  const q = await callerQueue(u);
  const order = [...q.callbacks, ...q.retries, ...q.fresh].map((l) => l.id);
  const next = order.find((x) => x !== lead.id) ?? null;
  return { lead, card, next, price: settings.package.price };
}
