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
import { activeCount, buildToday, capacityNeed, DEFAULT_QUEUE_TARGET, freshCount } from "./queue";
import { computeScore, priorityFromScore } from "./score";
import { mergeSources } from "./identity";
import { buildCallCard } from "./script";
import { opportunityCallCard } from "./call-card";
import { analyzeOpportunity, atLeast, buildOpportunity, OPPORTUNITY_ENGINE_VERSION, opportunityLog, readyOpportunity, type Opportunity } from "./opportunity";
import { chooseChannel } from "./channel";
import { configuredOperators } from "./operators";
import { buildDemoPayload, DEMO_CODE_RE, hasDemoTemplate, publicDemoView, type PublicDemo } from "./demo-templates";
import { draftFirstMessage } from "./style";
import { applyFeedback, type FeedbackInput } from "./feedback";
import { effectiveRouting } from "./routing";
import { scoreFromProfile, websiteStatusFromProfile } from "./research";
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
  type RadarProfile,
  type SessionUser, categoryOf, OpportunityFeedbackSchema } from "./types";

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
 * `ownCall`: obrazovka hovoru smie volajúcemu ukázať aj lead, ktorý PRÁVE uzavrel
 * (odovzdal Dominikovi, nevolať…) — inak by po uložení zmizla obrazovka „hotovo“.
 * Platí iba 15 minút po jeho vlastnom poslednom hovore; potom lead z jeho pohľadu zmizne.
 */
export async function getLead(
  u: SessionUser,
  leadId: string,
  opts: { ownCall?: boolean } = {},
): Promise<LeadDetail | null> {
  const r = await db();
  const lead = await r.getLead(leadId);
  if (!lead) return null;
  const [company, calls, events] = await Promise.all([
    r.getCompany(lead.company_id),
    r.listCalls(lead.id),
    r.listEvents(lead.id),
  ]);
  if (!company) return null;
  const last = calls[0];
  const own =
    opts.ownCall &&
    lead.assigned_to === u.username &&
    !!last &&
    callUser(last, allUsers()) === u.username &&
    Date.now() - new Date(last.created_at).getTime() < 15 * 60_000;
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

export async function saveSettings(u: SessionUser, input: Pick<Settings, "compensation" | "package">) {
  assertAdmin(u);
  const r = await db();
  const next: Settings = { ...(await r.getSettings()), compensation: input.compensation, package: input.package };
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

/** Štatistika operátora za dnes (unikátne leady a hovory). */
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
  // Call Card v3: každý lead s profilom z Lead Radaru. Bez profilu ostáva pôvodná karta.
  const opp = readyOpportunity(lead.opportunity) ?? (lead.company.profile ? buildOpportunity(lead, lead.company.category, lead.company.profile, { leadId: lead.id, companyName: lead.company.name }) : null);
  const opportunityCard = opp
    ? opportunityCallCard({
        company: lead.company,
        categoryLabel: categoryOf(lead.company.category).label,
        profile: lead.company.profile,
        opportunity: opp,
        operatorName: u.name,
        demoReady: !!opp.recommended_system && hasDemoTemplate(opp.recommended_system.id) && atLeast(opp.dimensions.DEMO_POTENTIAL.level, "MEDIUM"),
      })
    : null;
  const q = await callerQueue(u);
  const order = [...q.callbacks, ...q.retries, ...q.fresh].map((l) => l.id);
  const next = order.find((x) => x !== lead.id) ?? null;
  return { lead, card, opportunityCard, feedback: lead.opportunity_feedback ?? [], next, price: settings.package.price };
}

/* ─────────────────────────── Overené fakty (rutina / backfill) ─────────────────────────── */

export type LeadFacts = {
  website_status?: Lead["website_status"];
  website_issue?: string | null;
  website_checked_at?: string | null;
  business_check?: Lead["business_check"];
  register_ok?: boolean;
  phone_on_web?: boolean;
  ico?: string | null;
  sources?: { source: string; url: string | null }[];
};

/**
 * Doplní / aktualizuje overené fakty o firme (stav webu, IČO, zdroje) a prepočíta skóre.
 * Nemení stav leadu ani priradenie.
 */
export async function patchLeadFacts(u: SessionUser, leadId: string, f: LeadFacts) {
  assertAdmin(u);
  const r = await db();
  const lead = await r.getLead(leadId);
  if (!lead) throw new Error("Lead neexistuje.");
  const company = await r.getCompany(lead.company_id);
  if (!company) throw new Error("Firma neexistuje.");
  const cPatch: Partial<Company> = { updated_at: now() };
  if (f.ico !== undefined) cPatch.ico = f.ico;
  if (f.sources) cPatch.sources = mergeSources(company.sources, f.sources.map((s) => ({ ...s, seen_at: now() })));
  const nextCompany = { ...company, ...cPatch };
  cPatch.dedupe_keys = [...new Set([...company.dedupe_keys, ...dedupeKeys(nextCompany)])];
  await r.updateCompany(company.id, cPatch);

  const next = { ...lead, ...f };
  const score = computeScore({
    company: nextCompany,
    website_status: next.website_status ?? null,
    website_issue: next.website_issue ?? null,
    business_check: next.business_check ?? null,
    register_ok: f.register_ok ?? lead.trust.company === "verified",
    phone_on_web: f.phone_on_web ?? lead.trust.phone === "verified",
    offers: await r.listOffers(),
  });
  await r.updateLead(lead.id, {
    website_status: next.website_status ?? null,
    website_issue: next.website_issue ?? null,
    website_checked_at: next.website_checked_at ?? lead.website_checked_at ?? null,
    business_check: next.business_check ?? null,
    score,
    priority: CALLER_PHASE.includes(lead.status) ? priorityFromScore(score) : lead.priority,
    updated_at: now(),
  });
  await event(lead.id, u.name, "analysis", `Fakty aktualizované · skóre ${score.points}`);
  return score;
}
const CALLER_PHASE: LeadStatus[] = ["ready_to_call", "called", "analyzed"];


/* ─────────────────────────── Lead Radar: feedback, recheck, routing, behy ─────────────────────────── */

/** Volajúci nahlási chybu v dátach. Iba na lead, ktorý vidí (svoj). */
export async function addCallerFeedback(u: SessionUser, leadId: string, input: FeedbackInput) {
  const r = await db();
  const lead = await r.getLead(leadId);
  if (!lead) throw new Error("Lead neexistuje.");
  const company = await r.getCompany(lead.company_id);
  if (!company) throw new Error("Firma neexistuje.");
  if (u.role !== "admin" && lead.assigned_to !== u.username) throw new AccessError("Tento lead nie je tvoj.");
  const res = applyFeedback(lead, company, input, u.username, now(), id("fb"));
  if (Object.keys(res.company).length) await r.updateCompany(company.id, { ...res.company, updated_at: now() });
  await r.updateLead(lead.id, res.lead);
  await event(lead.id, u.name, "note", res.event);
}

export async function resolveFeedback(u: SessionUser, leadId: string, feedbackId: string) {
  assertAdmin(u);
  const r = await db();
  const lead = await r.getLead(leadId);
  if (!lead) throw new Error("Lead neexistuje.");
  const feedback = (lead.feedback ?? []).map((f) => (f.id === feedbackId ? { ...f, resolved_at: now() } : f));
  await r.updateLead(lead.id, { feedback, needs_reverify: feedback.some((f) => !f.resolved_at), updated_at: now() });
}

/**
 * Recheck pred hovorom (rutina): nový profil z radaru. Mení stav webu, kvalitu dát a skóre;
 * ak lead už NIE JE bezpečný na volanie (RESEARCH), vyradí ho z fronty — ale iba ak ešte nebol volaný.
 */
export async function patchLeadProfile(u: SessionUser, leadId: string, profile: RadarProfile) {
  assertAdmin(u);
  const r = await db();
  const lead = await r.getLead(leadId);
  if (!lead) throw new Error("Lead neexistuje.");
  const company = await r.getCompany(lead.company_id);
  if (!company) throw new Error("Firma neexistuje.");
  const before = lead.website_resolution ?? null;
  const merged: RadarProfile = {
    ...profile,
    rejected_websites: [...(company.profile?.rejected_websites ?? []), ...(profile.rejected_websites ?? [])],
  };
  const web = merged.website?.status === "confirmed" || merged.website?.status === "probable" ? merged.website?.url ?? null : null;
  await r.updateCompany(company.id, { profile: merged, website: web ?? company.website, updated_at: now() });
  const offers = await r.listOffers();
  const fit = offers.some((o) => o.available && o.category === company.category) ? "fits" : offers.some((o) => o.available) ? "no_fit" : "unknown";
  const score = scoreFromProfile(merged, fit);
  const after = merged.website?.status ?? merged.website_resolution ?? "uncertain";
  const patch: Partial<Lead> = {
    website_resolution: after,
    website_status: websiteStatusFromProfile(merged),
    website_issue: (merged.website?.health?.issues ?? []).slice().sort((a, b) => (b.points ?? 0) - (a.points ?? 0))[0]?.key ?? null,
    website_checked_at: merged.last_verified?.website ?? now(),
    data_quality: merged.data_quality ?? lead.data_quality ?? null,
    commercial_problem: merged.commercial_problems?.[0]?.code ?? null,
    needs_reverify: false,
    score,
    updated_at: now(),
  };
  // Opportunity: obohatenie z webu hotové → READY (alebo FAILED). Stav ani priradenie sa nemení.
  const opp = analyzeOpportunity({ ...lead, ...patch }, { ...company, profile: merged });
  console.info(JSON.stringify(opportunityLog(lead.id, opp)));
  patch.opportunity = opp as unknown as Lead["opportunity"];
  if (merged.data_quality === "research" && lead.status === "ready_to_call" && !(lead.call_attempts ?? 0)) {
    patch.status = "analyzed";
    patch.next_action = "review";
  }
  await r.updateLead(lead.id, patch);
  await event(lead.id, u.name, "analysis", `Recheck pred hovorom: web ${before ?? "?"} → ${after} · ${String(merged.data_quality ?? "").toUpperCase()}`);
  return { before, after };
}

export async function saveRouting(u: SessionUser, routing: Record<string, string | null>) {
  assertAdmin(u);
  const r = await db();
  const s = await r.getSettings();
  await r.saveSettings({ ...s, routing });
}

/** Ranná rutina: koľko potrebuje každý aktívny volajúci + routing + nedávne dopyty (locality engine). */
export async function morningStatus(u: SessionUser) {
  assertAdmin(u);
  const r = await db();
  const [leads, settings] = await Promise.all([r.listLeads(), r.getSettings()]);
  const routing = effectiveRouting(settings);
  const ops = configuredOperators();
  const all = await listLeads(u);
  const list = callers().map((c) => {
    const target = ops.find((o) => o.operator_id === c.username)?.queue_target ?? DEFAULT_QUEUE_TARGET;
    const active = activeCount(all, c.username);
    // need = koľko doplniť do cieľovej kapacity (nevybavené), nie „ďalších 20“
    return { caller: c.username, name: c.name, active, fresh: freshCount(leads, c.username), target, need: capacityNeed(active, target) };
  });
  const cut = new Date(Date.now() - 21 * 86_400_000).toISOString();
  const recent = (settings.radar?.query_log ?? [])
    .filter((q) => String(q.purpose ?? "") === "discovery" && String(q.executed_at ?? "") >= cut)
    .map((q) => String(q.query));
  const reverify = leads.filter((l) => l.needs_reverify).map((l) => l.id);
  return { callers: list, routing, recent_queries: [...new Set(recent)], reverify };
}

/** Uloží report behu radaru (zdravie zdrojov, štatistiky, yield dopytov). Drží 30 behov / 45 dní dopytov. */
export async function saveRadarRun(u: SessionUser, report: Record<string, unknown>) {
  assertAdmin(u);
  const r = await db();
  const s = await r.getSettings();
  const cut = new Date(Date.now() - 45 * 86_400_000).toISOString();
  const log = Array.isArray(report.query_log) ? (report.query_log as Record<string, unknown>[]) : [];
  const { query_log: _q, ...rest } = report;
  void _q;
  const radar = {
    runs: [...(s.radar?.runs ?? []), { ...rest, saved_at: now() }].slice(-30),
    query_log: [...(s.radar?.query_log ?? []), ...log].filter((q) => String(q.executed_at ?? "") >= cut).slice(-3000),
  };
  await r.saveSettings({ ...s, radar });
}

/* ─────────────────────────── Opportunity Engine (Dominik) ─────────────────────────── */

/** Prepočíta príležitosť a kanál z aktuálneho profilu. Nemení stav ani priradenie leadu. */
export async function refreshOpportunity(u: SessionUser, leadId: string) {
  assertAdmin(u);
  const lead = await getLead(u, leadId);
  if (!lead) throw new Error("Lead neexistuje.");
  const result = analyzeOpportunity(lead, lead.company);
  console.info(JSON.stringify(opportunityLog(lead.id, result)));
  if (result.status === "FAILED") {
    await (await db()).updateLead(leadId, { opportunity: result as unknown as Lead["opportunity"], updated_at: now() });
    await event(leadId, u.name, "analysis", `Opportunity FAILED: ${result.error}`);
    throw new Error(`Analýza zlyhala: ${result.error}`);
  }
  const opportunity = result;
  const channel = channelFor(lead, opportunity);
  await (await db()).updateLead(leadId, {
    opportunity: opportunity as unknown as Lead["opportunity"],
    channel_decision: channel as unknown as Lead["channel_decision"],
    updated_at: now(),
  });
  await event(leadId, u.name, "analysis", `Opportunity ${opportunity.priority} · kanál ${channel.channel} · v${opportunity.versions.opportunity_engine}`);
  return { opportunity, channel };
}

function channelFor(lead: LeadWithCompany, opportunity: Opportunity) {
  const active = callers().map((c) => c.username);
  return chooseChannel({
    category: lead.company.category,
    score_band: lead.score?.band,
    opportunity,
    has_phone: !!lead.company.phone,
    phone_verified: lead.company.profile ? lead.company.profile.primary_phone?.confidence === "high" : undefined,
    category_verified: lead.company.profile ? ["high", "medium"].includes(lead.company.profile.category?.confidence ?? "") : undefined,
    has_email: !!lead.company.email,
    do_not_contact: lead.status === "do_not_call" || !!lead.company.do_not_call,
    operators: configuredOperators().filter((o) => active.includes(o.operator_id)),
  });
}

/**
 * Obohatenie z webu na pozadí: lead dostane stav ANALYZING a príznak na preverenie.
 * Ranná rutina (radar --recheck) web znova prečíta, pošle profil a výsledok bude READY.
 */
export async function requestOpportunityEnrichment(u: SessionUser, leadId: string) {
  assertAdmin(u);
  const r = await db();
  const lead = await r.getLead(leadId);
  if (!lead) throw new Error("Lead neexistuje.");
  await r.updateLead(leadId, { opportunity: { version: 2, status: "ANALYZING", requested_at: now() } as unknown as Lead["opportunity"], needs_reverify: true, updated_at: now() });
  await event(leadId, u.name, "analysis", "Opportunity: čaká na obohatenie z webu (ranná rutina)");
}

/**
 * Spätná väzba po hovore: operátor potvrdí / vyvráti predpoklad Opportunity Engine.
 * Iba kontrakt pre Phase 3 (learning loop); pravidlá sa z toho zatiaľ nemenia.
 */
export async function saveOpportunityFeedback(
  u: SessionUser,
  leadId: string,
  input: { signal_code: string; predicted: string; result: "confirmed" | "rejected" | "unknown"; note: string | null },
) {
  const r = await db();
  const lead = await r.getLead(leadId);
  if (!lead) throw new Error("Lead neexistuje.");
  if (u.role !== "admin" && lead.assigned_to !== u.username) throw new AccessError("Tento lead nie je tvoj.");
  const fb = OpportunityFeedbackSchema.parse({
    ...input,
    operator_id: u.username,
    at: now(),
    // karta vznikla z uloženého v2 výsledku, inak ju práve vypočítal aktuálny engine
    engine_version: readyOpportunity(lead.opportunity)?.versions.opportunity_engine ?? OPPORTUNITY_ENGINE_VERSION,
  });
  // posledná odpoveď na ten istý predpoklad od toho istého operátora platí
  const rest = (lead.opportunity_feedback ?? []).filter((x) => !(x.signal_code === fb.signal_code && x.operator_id === fb.operator_id));
  await r.updateLead(leadId, { opportunity_feedback: [...rest, fb], updated_at: now() });
  await event(leadId, u.name, "note", `Predpoklad ${fb.signal_code}: ${fb.result}`);
  return fb;
}

/** Ručná kontrola reklamy (Transparency Center / Ad Library). ACTIVE vyžaduje odkaz. */
export async function saveAdsCheck(u: SessionUser, leadId: string, status: "ACTIVE" | "NOT_FOUND", url: string | null) {
  assertAdmin(u);
  if (status === "ACTIVE" && !url) throw new Error("ACTIVE potrebuje odkaz na reklamu.");
  if (url && !/^https:\/\//.test(url)) throw new Error("Odkaz musí začínať https://");
  await (await db()).updateLead(leadId, { ads_check: { status, url, checked_at: now(), by: u.username }, updated_at: now() });
  await event(leadId, u.name, "note", `Reklama ručne: ${status}${url ? ` (${url})` : ""}`);
  return refreshOpportunity(u, leadId);
}

/** Vytvorí demo pre lead (iba tlačidlom, nič sa neposiela). Firemné údaje berie iba z evidence. */
export async function createDemo(u: SessionUser, leadId: string, opts: { force?: boolean } = {}) {
  assertAdmin(u);
  const lead = await getLead(u, leadId);
  if (!lead) throw new Error("Lead neexistuje.");
  const opp = readyOpportunity(lead.opportunity) ?? (await refreshOpportunity(u, leadId)).opportunity;
  const payload = buildDemoPayload({ company: lead.company, profile: lead.company.profile, opportunity: opp, nowIso: now(), force: opts.force });
  const run = { ...opp.run, demo_generated: true };
  await (await db()).updateLead(leadId, {
    demo: payload as unknown as Lead["demo"],
    opportunity: { ...opp, run } as unknown as Lead["opportunity"],
    updated_at: now(),
  });
  console.info(JSON.stringify({ event: "demo_generated", lead_id: leadId, segment: payload.segment, template: payload.template, expires_at: payload.expires_at }));
  await event(leadId, u.name, "note", `Demo vytvorené (${payload.segment}), platí do ${payload.expires_at.slice(0, 10)}. Nič sa neodoslalo.`);
  return payload;
}

/** Vypne / zapne demo (vypnuté = verejne neexistuje). */
export async function setDemoDisabled(u: SessionUser, leadId: string, disabled: boolean) {
  assertAdmin(u);
  const r = await db();
  const lead = await r.getLead(leadId);
  if (!lead?.demo) throw new Error("Lead nemá demo.");
  await r.updateLead(leadId, { demo: { ...lead.demo, disabled } as Lead["demo"], updated_at: now() });
  await event(leadId, u.name, "note", disabled ? "Demo vypnuté" : "Demo zapnuté");
}

/** Čítanie dema podľa kódu. Vracia iba bezpečnú projekciu, nič z leadu. Expirované / vypnuté = null. */
export async function publicDemo(code: string): Promise<PublicDemo | null> {
  if (!DEMO_CODE_RE.test(code)) return null;
  const leads = await (await db()).listLeads();
  const hit = leads.find((l) => (l.demo as { code?: string } | null | undefined)?.code === code);
  return publicDemoView(hit?.demo, Date.now());
}

/** Návrhy prvej správy (e-mail + SMS) na skopírovanie. Nič sa neodosiela. */
export function leadDrafts(lead: Lead, demoBase: string) {
  const opp = readyOpportunity(lead.opportunity);
  if (!opp) return null;
  const code = (lead.demo as { code?: string } | null | undefined)?.code;
  const url = code ? `${demoBase}/d/${code}` : null;
  return {
    email: draftFirstMessage({ opportunity: opp, channel: "EMAIL", demoUrl: url }),
    sms: draftFirstMessage({ opportunity: opp, channel: "SMS", demoUrl: url ? url.replace(/^https:\/\//, "") : null }),
    demo_url: url,
  };
}

/**
 * Preradí leady čakajúce na async (Opportunity Engine) podľa aktuálnych pravidiel kanála.
 * Lead, ktorý teraz spĺňa podmienky hovoru, ide do fronty operátora. Nič iné sa nemení.
 * Predvolene na sucho.
 */
export async function rerouteAsync(u: SessionUser, apply: boolean) {
  assertAdmin(u);
  const all = await listLeads(u);
  const todo = all.filter((l) => l.status === "analyzed" && l.next_action === "async_message" && !l.company.do_not_call);
  const moved: { id: string; name: string; operator: string }[] = [];
  for (const l of todo) {
    const opportunity = buildOpportunity(l, l.company.category, l.company.profile, { leadId: l.id, companyName: l.company.name });
    const channel = channelFor(l, opportunity);
    if (channel.channel !== "CALL" || !channel.operator_id) continue;
    moved.push({ id: l.id, name: l.company.name, operator: channel.operator_id });
    if (!apply) continue;
    const at = now();
    await (await db()).updateLead(l.id, {
      opportunity: opportunity as unknown as Lead["opportunity"],
      channel_decision: channel as unknown as Lead["channel_decision"],
      status: "ready_to_call",
      assigned_to: channel.operator_id,
      assigned_history: [...(l.assigned_history ?? []), { user: channel.operator_id, at, by: u.name }],
      next_action: "caller_call",
      next_action_at: null,
      updated_at: at,
    });
    await event(l.id, u.name, "assign", `CALL → ${channel.operator_id} (nové pravidlá kanála)`);
  }
  return { checked: todo.length, moved };
}
