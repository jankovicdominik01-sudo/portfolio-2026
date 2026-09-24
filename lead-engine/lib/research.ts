import "server-only";
import { z } from "zod";
import { db } from "./db";
import { callers } from "./auth";
import { findBannedPhrases } from "./ai/guard";
import { CALL_GOAL, DOMINIK_INTRO, KEY_QUESTION, defaultObjections, matchOffer, offerLine, whatNotToSay } from "./ai/brief";
import { computePriority, dedupeKeys } from "./scoring";
import {
  ARCHIVE_REASONS,
  ClaimSchema,
  LeadInputSchema,
  ObjectionSchema,
  ProductRefSchema,
  type Analysis,
  type CallBrief,
  type Company,
  type Lead,
  type SessionUser,
  type Trust,
} from "./types";

/**
 * Ranná rutina posiela firmy už preskúmané: agent overil katalóg, register aj web,
 * našiel reálny produkt a napísal scenár pre Joza. Tu sa to iba overí a uloží.
 * Firmu, ktorá už v systéme je, NIKDY neprepíše ani nevráti do volania.
 */

const t = (max: number) => z.string().trim().min(2).max(max);
const tn = (max: number) => z.string().trim().max(max).nullable().optional().default(null);

export const ResearchSchema = z.object({
  summary: t(600),
  why_this_lead: t(600),
  evidence: z
    .array(
      z.object({
        id: z.string().regex(/^E\d{1,2}$/),
        source: z.enum(["web", "catalog"]),
        url: z.string().url().max(500).nullable(),
        page: tn(200),
        excerpt: t(400),
      }),
    )
    .min(1)
    .max(20),
  positive_points: z.array(ClaimSchema).max(5).default([]),
  observations: z.array(ClaimSchema).min(1).max(4),
  customer_gap: tn(400),
  opportunity: t(400),
  primary_hook: t(300),
  secondary_hook: tn(300),
  checks: z.object({
    register: z.boolean(),
    phone_on_web: z.boolean(),
    web: z.enum(["weak", "broken", "none"]),
  }),
  brief: z.object({
    praise: t(400),
    observation: t(400),
    reason: t(400),
    opportunity: t(400),
    main_idea: t(300),
    call_opening: t(700),
    natural_pitch: t(900),
    key_question: tn(300),
    remember: t(400),
    what_not_to_say: z.array(t(200)).max(8).default([]),
    objections: z.array(ObjectionSchema).max(8).default([]),
  }),
  product: ProductRefSchema.nullable().optional().default(null),
});

export const ResearchedItemSchema = z.object({
  company: z.record(z.string(), z.unknown()),
  research: z.unknown().optional(),
  reject: z.object({ reason: z.enum(ARCHIVE_REASONS), why: t(300) }).optional(),
});

export type ResearchedResult =
  | { status: "ready"; leadId: string; name: string }
  | { status: "rejected"; leadId: string; name: string }
  | { status: "duplicate"; name: string }
  | { status: "invalid"; name: string; error: string };

const newId = (p: string) => `${p}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
const now = () => new Date().toISOString();

export async function ingestResearched(actor: SessionUser, raw: z.infer<typeof ResearchedItemSchema>): Promise<ResearchedResult> {
  const parsedCompany = LeadInputSchema.safeParse({ ...raw.company, source: "routine" });
  const name = String(raw.company.name ?? "?");
  if (!parsedCompany.success) return { status: "invalid", name, error: parsedCompany.error.issues[0]?.message ?? "firma" };
  const input = parsedCompany.data;

  const r = await db();
  const keys = dedupeKeys(input);
  if (await r.findCompanyByKeys(keys)) return { status: "duplicate", name: input.name };

  let research: z.infer<typeof ResearchSchema> | null = null;
  if (!raw.reject) {
    const p = ResearchSchema.safeParse(raw.research);
    if (!p.success) {
      const i = p.error.issues[0];
      return { status: "invalid", name, error: `${i?.path.join(".")}: ${i?.message}` };
    }
    research = p.data;
    const ids = new Set(research.evidence.map((e) => e.id));
    const claims = [...research.observations, ...research.positive_points];
    const orphan = claims.find((c) => !c.evidence_ids.length || c.evidence_ids.some((x) => !ids.has(x)));
    if (orphan) return { status: "invalid", name, error: `Tvrdenie bez platného zdroja: „${orphan.text}“` };
    const b = research.brief;
    const banned = findBannedPhrases([b.call_opening, b.natural_pitch, b.main_idea, b.observation, b.reason, b.praise]);
    if (banned.length) return { status: "invalid", name, error: `Zakázané frázy: ${banned.join(", ")}` };
    if (!input.phone) return { status: "invalid", name, error: "Bez telefónu sa nedá volať" };
  }

  const company: Company = {
    id: newId("co"),
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

  const base: Lead = {
    id: newId("ld"),
    company_id: company.id,
    status: "archived",
    priority: "low",
    priority_reasons: [],
    source: "routine",
    source_url: input.source_url,
    assigned_to: null,
    analysis: null,
    call_brief: null,
    trust: { web: "unverified", phone: "unverified", company: "unverified", hook: "unverified" },
    qualification: null,
    next_action: null,
    next_action_at: null,
    last_contact: null,
    call_attempts: 0,
    archive_reason: null,
    notes: input.note ?? "",
    created_at: now(),
    updated_at: now(),
  };
  const ev = (kind: "created" | "analysis" | "archive", label: string) =>
    r.insertEvent({ id: newId("ev"), lead_id: base.id, at: now(), actor: actor.name, kind, label });

  if (raw.reject || !research) {
    const why = raw.reject?.why ?? "";
    await r.insertLead({
      ...base,
      archive_reason: raw.reject?.reason ?? "nothing_found",
      priority_reasons: [why],
      notes: base.notes ? `${base.notes}\n\n${why}` : why,
    });
    await ev("archive", `Ranná rutina firmu preverila a vyradila: ${why}`);
    return { status: "rejected", leadId: base.id, name: input.name };
  }

  const offers = await r.listOffers();
  const offer = matchOffer(offers, company.category);
  const analysis: Analysis = {
    engine: "routine",
    model: null,
    analyzed_at: now(),
    company_summary: research.summary,
    why_this_lead: research.why_this_lead,
    positive_points: research.positive_points,
    observations: research.observations,
    customer_risk: null,
    customer_gap: research.customer_gap,
    opportunity: research.opportunity,
    primary_hook: research.primary_hook,
    secondary_hook: research.secondary_hook,
    nothing_found: false,
    confidence: research.checks.register && research.evidence.length >= 2 ? "high" : "medium",
    evidence: research.evidence.map((e) => ({ ...e, page: e.page ?? null, checked_at: now() })),
    warnings: research.checks.register ? [] : ["Firmu sa nepodarilo overiť v registri."],
  };
  const b = research.brief;
  const brief: CallBrief = {
    praise: b.praise,
    observation: b.observation,
    reason: b.reason,
    opportunity: b.opportunity,
    main_idea: b.main_idea,
    call_opening: b.call_opening,
    natural_pitch: b.natural_pitch,
    dominik_intro: DOMINIK_INTRO,
    offer: offer ? offerLine(offer) : null,
    offer_id: offer?.id ?? null,
    estimated_price: offer?.estimated_price ?? null,
    key_question: b.key_question ?? KEY_QUESTION,
    goal: CALL_GOAL,
    remember: b.remember,
    what_not_to_say: [...new Set([...b.what_not_to_say, ...whatNotToSay(company.category, !!offer)])],
    objections: b.objections.length ? b.objections : defaultObjections(!!offer, offer?.estimated_price ?? null),
    product: research.product,
  };
  const trust: Trust = {
    web: research.checks.web === "none" ? "partial" : "verified",
    phone: research.checks.phone_on_web ? "verified" : "partial",
    company: research.checks.register ? "verified" : "partial",
    hook: "verified",
  };
  const { priority, reasons } = computePriority(company, trust, analysis, offers);
  await r.insertLead({
    ...base,
    status: "ready_to_call",
    priority,
    priority_reasons: reasons,
    assigned_to: callers()[0]?.username ?? null,
    analysis,
    call_brief: brief,
    trust,
    next_action: "caller_call",
  });
  await ev("created", "Lead pridaný (rannej rutiny)");
  await ev("analysis", "Výskum rannej rutiny · lead pripravený na telefonát");
  return { status: "ready", leadId: base.id, name: input.name };
}
