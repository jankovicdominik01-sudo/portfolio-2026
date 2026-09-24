import "server-only";
import { db } from "./db";
import { runAnalysis } from "./ai/analyze";
import { dominikOpening } from "./ai/brief";
import { adminName, callers } from "./auth";
import { computePriority, computeTrust, dedupeKeys, isReadyToCall } from "./scoring";
import { endOfDay, addDays } from "./format";
import {
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

/** Caller vidí iba leady priradené jemu, ktoré sú v jeho časti procesu. */
function callerCanSee(u: SessionUser, l: Lead) {
  return l.assigned_to === u.username && (l.status === "ready_to_call" || l.status === "called");
}

export async function listLeads(u: SessionUser): Promise<LeadWithCompany[]> {
  const r = await db();
  const [leads, companies] = await Promise.all([r.listLeads(), r.listCompanies()]);
  const byId = new Map(companies.map((c) => [c.id, c]));
  return leads
    .filter((l) => u.role === "admin" || callerCanSee(u, l))
    .map((l) => ({ ...l, company: byId.get(l.company_id)! }))
    .filter((l) => !!l.company);
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
  if (u.role !== "admin" && !callerCanSee(u, lead) && !own) return null;
  const [company, calls, events] = await Promise.all([
    r.getCompany(lead.company_id),
    r.listCalls(lead.id),
    r.listEvents(lead.id),
  ]);
  if (!company) return null;
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
  const assigned = status === "ready_to_call" ? (lead.assigned_to ?? callers()[0]?.username ?? null) : lead.assigned_to;
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

/* ─────────────────────────── Hovor kamaráta ─────────────────────────── */

const HANDOFF: CallOutcome[] = ["dominik_may_call", "wants_demo", "wants_price", "wants_email"];

export type CallerCallInput = {
  outcome: CallOutcome;
  note: string | null;
  company_said: string | null;
  preferred_time: CallWhen | null;
  email: string | null;
};

export async function logCallerCall(u: SessionUser, leadId: string, input: CallerCallInput) {
  const r = await db();
  const lead = await r.getLead(leadId);
  if (!lead) throw new Error("Lead neexistuje.");
  if (u.role !== "admin" && !callerCanSee(u, lead)) throw new AccessError("Tento lead ti nie je priradený.");
  const company = await r.getCompany(lead.company_id);
  if (!company) throw new Error("Firma neexistuje.");

  const call: CallLog = {
    id: id("call"),
    lead_id: lead.id,
    created_at: now(),
    by: u.name,
    role: "caller",
    outcome: input.outcome,
    note: input.note,
    company_said: input.company_said,
    dominik_may_call: HANDOFF.includes(input.outcome),
    preferred_time: input.preferred_time,
    email: input.email,
  };
  await r.insertCall(call);

  const patch: Partial<Lead> = {
    last_contact: call.created_at,
    call_attempts: lead.call_attempts + 1,
    updated_at: now(),
  };

  if (call.dominik_may_call) {
    const { opening, goal } = dominikOpening({ adminName: adminName(), callerName: u.name, company, lead, call });
    patch.status = "dominik_call";
    patch.next_action = input.outcome === "wants_email" ? "send_email" : "dominik_call";
    patch.next_action_at = whenToDate(input.preferred_time ?? "today");
    patch.qualification = {
      call_id: call.id,
      called_at: call.created_at,
      caller: u.name,
      company_said: input.company_said ?? input.note,
      preferred_time: input.preferred_time,
      email: input.email,
      dominik_opening: opening,
      dominik_goal: goal,
    };
    if (input.email && !company.email) await r.updateCompany(company.id, { email: input.email, updated_at: now() });
    await r.insertNotification({
      id: id("nt"),
      at: now(),
      lead_id: lead.id,
      kind: "qualified",
      title: `Nový kvalifikovaný lead — ${company.name}`,
      body: `${u.name}: ${OUTCOME_LABEL[input.outcome]}${input.company_said ? ` · „${input.company_said}“` : ""}`,
      read: false,
    });
  } else {
    switch (input.outcome) {
      case "call_later":
        patch.status = "called";
        patch.next_action = "caller_call";
        patch.next_action_at = whenToDate(input.preferred_time ?? "later");
        break;
      case "no_answer":
        patch.status = "called";
        patch.next_action = "caller_call";
        patch.next_action_at = whenToDate("tomorrow");
        if (lead.call_attempts + 1 >= 3) {
          patch.priority = "low";
          patch.priority_reasons = ["3× nezdvihli."];
        }
        break;
      case "wrong_number":
        patch.status = "analyzed";
        patch.next_action = "verify_phone";
        patch.trust = { ...lead.trust, phone: "unverified" };
        patch.priority = "check";
        patch.priority_reasons = ["Nesprávne číslo — treba overiť kontakt."];
        break;
      case "not_interested":
      case "has_web":
        patch.status = "lost";
        patch.next_action = null;
        patch.next_action_at = null;
        break;
      case "not_exists":
        patch.status = "archived";
        patch.archive_reason = "inactive";
        patch.next_action = null;
        break;
      default:
        patch.status = "called";
        patch.next_action = "review";
    }
  }

  await r.updateLead(lead.id, patch);
  await event(lead.id, u.name, "call", `${u.name} volal — ${OUTCOME_LABEL[input.outcome]}`);
  if (call.dominik_may_call) await event(lead.id, u.name, "handoff", `Lead odovzdaný ${adminName()}ovi`);
  return { handoff: call.dominik_may_call };
}

/* ─────────────────────────── Dominikov hovor a pipeline ─────────────────────────── */

export async function logDominikCall(u: SessionUser, leadId: string, outcome: DominikOutcome, note: string | null) {
  assertAdmin(u);
  const r = await db();
  const lead = await r.getLead(leadId);
  if (!lead) throw new Error("Lead neexistuje.");
  await r.insertCall({
    id: id("call"),
    lead_id: lead.id,
    created_at: now(),
    by: u.name,
    role: "admin",
    outcome,
    note,
    company_said: null,
    dominik_may_call: false,
    preferred_time: null,
    email: null,
  });
  const patch: Partial<Lead> = { last_contact: now(), updated_at: now() };
  if (outcome === "send_offer") Object.assign(patch, { next_action: "send_offer", next_action_at: whenToDate("today") });
  if (outcome === "send_demo") Object.assign(patch, { next_action: "send_demo", next_action_at: whenToDate("today") });
  if (outcome === "follow_up") Object.assign(patch, { next_action: "follow_up", next_action_at: addDays(7) });
  if (outcome === "no_answer") Object.assign(patch, { next_action: "dominik_call", next_action_at: whenToDate("tomorrow") });
  if (outcome === "not_interested") Object.assign(patch, { status: "lost", next_action: null, next_action_at: null });
  await r.updateLead(lead.id, patch);
  await event(lead.id, u.name, "dominik_call", `${u.name} volal — ${DOMINIK_OUTCOME_LABEL[outcome]}`);
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
  if (status === "ready_to_call" && !lead.assigned_to) patch.assigned_to = callers()[0]?.username ?? null;
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
