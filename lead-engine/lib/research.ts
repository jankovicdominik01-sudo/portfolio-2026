import "server-only";
import { z } from "zod";
import { db } from "./db";
import { callers } from "./auth";
import { findBannedPhrases } from "./ai/guard";
import { CALL_GOAL, DOMINIK_INTRO, KEY_QUESTION, defaultObjections, matchOffer, offerLine, whatNotToSay } from "./ai/brief";
import { dedupeKeys } from "./scoring";
import { computeScore, priorityFromScore } from "./score";
import { identityMatch, mergeSources } from "./identity";
import { forbiddenClaims, unverifiedWebClaim } from "./script";
import { pickCaller } from "./workflow";
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
    /** none = nenašli sme web; uncertain = nevieme spoľahlivo povedať */
    web: z.enum(["weak", "broken", "none", "uncertain"]),
    /** konkrétny problém zo skriptu: parked, db_error, bad_cert, foreign_redirect, domain_dead, php_error, frames, no_viewport… */
    web_issue: z.string().max(40).nullable().optional().default(null),
    /**
     * Overenie „nemá web“ vyhľadávaním (názov, IČO, mesto, telefón, meno). Bez neho sa „none“
     * uloží ako UNCERTAIN a scenár sa iba pýta.
     */
    web_search: z
      .object({ queries: z.array(z.string().max(200)).max(10), found_url: z.string().max(300).nullable() })
      .nullable()
      .optional()
      .default(null),
    /** Robí firma dnes naozaj tento odbor? changed = register/web hovorí o inom odbore. */
    business: z.enum(["confirmed", "changed", "uncertain"]).optional().default("uncertain"),
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
  | { status: "review"; leadId: string; name: string; why: string }
  | { status: "duplicate"; name: string }
  | { status: "invalid"; name: string; error: string };

/** Mapa výsledku kontroly webu na stav leadu. „Nemá web“ bez overenia vyhľadávaním = UNCERTAIN. */
export function websiteStatusFrom(checks: z.infer<typeof ResearchSchema>["checks"]): NonNullable<Lead["website_status"]> {
  if (checks.web === "broken") return "broken";
  if (checks.web === "weak") return "weak";
  if (checks.web === "none") {
    const s = checks.web_search;
    if (s?.found_url) return "uncertain"; // vyhľadávanie niečo našlo → netvrdíme „nemá web“
    return s && s.queries.length >= 2 ? "no_website" : "uncertain";
  }
  return "uncertain";
}

const newId = (p: string) => `${p}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
const now = () => new Date().toISOString();

export async function ingestResearched(actor: SessionUser, raw: z.infer<typeof ResearchedItemSchema>): Promise<ResearchedResult> {
  const parsedCompany = LeadInputSchema.safeParse({ ...raw.company, source: "routine" });
  const name = String(raw.company.name ?? "?");
  if (!parsedCompany.success) return { status: "invalid", name, error: parsedCompany.error.issues[0]?.message ?? "firma" };
  const input = parsedCompany.data;
  const ico = typeof raw.company.ico === "string" && /^\d{6,8}$/.test(raw.company.ico.trim()) ? raw.company.ico.trim() : null;
  const sources = (Array.isArray(raw.company.sources) ? raw.company.sources : [])
    .filter((x): x is { source: string; url?: string | null } => !!x && typeof x === "object" && typeof (x as { source?: unknown }).source === "string")
    .map((x) => ({ source: x.source.slice(0, 40), url: typeof x.url === "string" ? x.url.slice(0, 500) : null, seen_at: now() }));

  const r = await db();
  const keys = dedupeKeys({ ...input, ico });
  const existing = await r.findCompanyByKeys(keys);
  let reviewWhy: string | null = null;
  if (existing) {
    const idm = identityMatch(existing, { ...input, ico });
    if (idm.same === true) {
      // Tá istá firma z ďalšieho zdroja: iba doplníme zdroje / IČO, nový lead nevzniká.
      await r.updateCompany(existing.id, {
        sources: mergeSources(existing.sources, sources),
        ico: existing.ico ?? ico,
        dedupe_keys: [...new Set([...existing.dedupe_keys, ...keys])],
        updated_at: now(),
      });
      return { status: "duplicate", name: input.name };
    }
    if (idm.same === null) reviewWhy = `Možná duplicita s „${existing.name}“ (${idm.reason}).`;
  }

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
    const texts = [b.call_opening, b.natural_pitch, b.main_idea, b.observation, b.reason, b.praise];
    const banned = [...findBannedPhrases(texts), ...forbiddenClaims(texts)];
    if (banned.length) return { status: "invalid", name, error: `Zakázané frázy / tvrdenia: ${banned.join(", ")}` };
    const ws = websiteStatusFrom(research.checks);
    if (unverifiedWebClaim(texts, ws === "broken" || ws === "no_website"))
      return { status: "invalid", name, error: "Scenár tvrdí „nemáte web / nefunguje“, ale stav webu nie je overený" };
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
    ico,
    sources,
    do_not_call: false,
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
  const website_status = websiteStatusFrom(research.checks);
  const score = computeScore({
    company,
    website_status,
    website_issue: research.checks.web_issue,
    business_check: research.checks.business,
    register_ok: research.checks.register,
    phone_on_web: research.checks.phone_on_web,
    offers,
  });
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
  const caller = pickCaller(callers());
  const common = {
    ...base,
    priority: priorityFromScore(score),
    priority_reasons: [...score.factors, ...score.risks].map((f) => `${f.points > 0 ? "+" : ""}${f.points} ${f.label}`),
    analysis,
    call_brief: brief,
    trust,
    website_status,
    website_issue: research.checks.web_issue,
    website_checked_at: now(),
    business_check: research.checks.business,
    score,
  };
  if (reviewWhy || research.checks.business === "changed") {
    // MANUAL VERIFICATION — do fronty volajúceho nejde, kým to Dominik neoverí.
    const why = reviewWhy ?? "Firma dnes zrejme robí iný odbor — over pred volaním.";
    await r.insertLead({ ...common, status: "analyzed", next_action: "review", notes: why });
    await ev("created", "Lead pridaný (rannej rutiny)");
    await ev("analysis", `Na overenie: ${why}`);
    return { status: "review", leadId: base.id, name: input.name, why };
  }
  await r.insertLead({
    ...common,
    status: "ready_to_call",
    assigned_to: caller,
    assigned_history: caller ? [{ user: caller, at: now(), by: "Ranná rutina" }] : [],
    next_action: "caller_call",
  });
  await ev("created", "Lead pridaný (rannej rutiny)");
  await ev("analysis", `Výskum rannej rutiny · skóre ${score.points} · ${caller ? `pridelené: ${caller}` : "bez volajúceho"}`);
  return { status: "ready", leadId: base.id, name: input.name };
}
