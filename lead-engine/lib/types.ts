/**
 * Doménový model Lead Engine.
 *
 * Company  = kto firma je (identita + kontakt, deduplikácia)
 * Lead     = obchodný prípad nad firmou (stav, analýza, brief, kvalifikácia)
 * CallLog  = jeden telefonát (oddelený od leadu)
 * LeadEvent = položka timeline
 * Offer    = reálne existujúci rozpracovaný web (existing_offer)
 */
import { z } from "zod";

/* ─────────────────────────── Enums ─────────────────────────── */

/**
 * Stavy leadu. Dve fázy:
 *  - volajúci (opener): ready_to_call → called (pokusy / callback) → dominik_call (= SÚHLAS S KONTAKTOM)
 *  - Dominik (sales):   dominik_call → contacted → interested → demo → offer_sent → won (dohoda) → paid
 * Súhlas s kontaktom NIE JE záujem. Záujem zapisuje iba Dominik po vlastnom hovore.
 * `negotiation` ostáva kvôli starším dátam.
 */
export const LEAD_STATUSES = [
  "new",
  "analyzed",
  "ready_to_call",
  "called",
  "dominik_call",
  "contacted",
  "interested",
  "demo",
  "offer_sent",
  "negotiation",
  "won",
  "paid",
  "lost",
  "do_not_call",
  "archived",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "Nový",
  analyzed: "Analyzovaný",
  ready_to_call: "Na volanie",
  called: "Volané",
  dominik_call: "Súhlas s kontaktom",
  contacted: "Kontaktovaný",
  interested: "Skutočný záujem",
  demo: "Ukážka",
  offer_sent: "Ponuka",
  negotiation: "Rokovanie",
  won: "Dohoda",
  paid: "Zaplatené",
  lost: "Stratené",
  do_not_call: "Nevolať",
  archived: "Vyradené",
};

/** Dominikov sales pipeline po handoffe (poradie = postup). */
export const SALES_STAGES = ["dominik_call", "contacted", "interested", "demo", "offer_sent", "won", "paid"] as const;
export type SalesStage = (typeof SALES_STAGES)[number];

export const PRIORITIES = ["hot", "ready", "check", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const TRUST_LEVELS = ["verified", "partial", "unverified"] as const;
export type TrustLevel = (typeof TRUST_LEVELS)[number];

/**
 * Výsledky hovoru volajúceho. Prvých 8 je aktuálna sada (obrazovka po hovore),
 * zvyšok ostáva kvôli histórii (Jozove hovory).
 */
export const CALLER_OUTCOMES = [
  "no_answer",
  "wrong_number",
  "not_interested",
  "has_web",
  "call_later",
  "wants_info",
  "consent",
  "do_not_call",
] as const;
export type CallerOutcome = (typeof CALLER_OUTCOMES)[number];

export const CALL_OUTCOMES = [
  ...CALLER_OUTCOMES,
  "dominik_may_call",
  "call_later",
  "not_interested",
  "wants_email",
  "no_answer",
  "wants_demo",
  "wants_price",
  "has_web",
  "wrong_number",
  "not_exists",
  "other",
] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export const OUTCOME_LABEL: Record<CallOutcome, string> = {
  consent: "Súhlasí s kontaktom od Dominika",
  wants_info: "Chce informácie",
  do_not_call: "Nevolať znova",
  dominik_may_call: "Dominik môže zavolať",
  call_later: "Ozvať sa neskôr",
  not_interested: "Nemá záujem",
  wants_email: "Chce e-mail",
  no_answer: "Nezdvihol",
  wants_demo: "Chce ukážku",
  wants_price: "Chce cenu",
  has_web: "Má nový / iný web",
  wrong_number: "Nesprávne číslo",
  not_exists: "Firma neexistuje",
  other: "Iné",
};

/**
 * Dominikove kroky po handoffe. Posun v pipeline (contacted…paid) alebo
 * alternatíva (nedovolaný, follow-up, nevyhovuje, nemá záujem).
 * Staré hodnoty (send_offer, send_demo) ostávajú kvôli histórii.
 */
export const DOMINIK_OUTCOMES = [
  "contacted",
  "interested",
  "demo",
  "offer",
  "deal",
  "paid",
  "unreachable",
  "follow_up",
  "bad_fit",
  "not_interested",
] as const;
export type DominikOutcome = (typeof DOMINIK_OUTCOMES)[number] | "send_offer" | "send_demo" | "no_answer";

export const DOMINIK_OUTCOME_LABEL: Record<DominikOutcome, string> = {
  contacted: "Dovolal som sa",
  interested: "Skutočný záujem",
  demo: "Ukážka poslaná / ukázaná",
  offer: "Ponuka poslaná",
  deal: "Dohoda (predané)",
  paid: "Zaplatené",
  unreachable: "Nedovolal som sa",
  follow_up: "Follow-up neskôr",
  bad_fit: "Nevyhovuje",
  not_interested: "Nemá záujem",
  send_offer: "Poslať ponuku",
  send_demo: "Poslať ukážku",
  no_answer: "Nezdvihol",
};

export const CALL_WHEN = ["today", "tomorrow", "later"] as const;
export type CallWhen = (typeof CALL_WHEN)[number];

export const ARCHIVE_REASONS = [
  "quality_web",
  "irrelevant_segment",
  "inactive",
  "bad_contact",
  "unverifiable",
  "duplicate",
  "bad_fit",
  "existing_deal",
  "no_contact_wanted",
  "nothing_found",
  "unreachable",
] as const;
export type ArchiveReason = (typeof ARCHIVE_REASONS)[number];

export const ARCHIVE_LABEL: Record<ArchiveReason, string> = {
  quality_web: "Už má kvalitný web",
  irrelevant_segment: "Nerelevantný segment",
  inactive: "Neaktívna firma",
  bad_contact: "Zlý kontakt",
  unverifiable: "Nedá sa overiť",
  duplicate: "Duplicita",
  bad_fit: "Nevhodná ponuka",
  existing_deal: "Už existuje obchod",
  no_contact_wanted: "Firma nechce kontakt",
  nothing_found: "Nenašli sme nič zaujímavé",
  unreachable: "Nedovolali sme sa (3 pokusy)",
};

export const LEAD_SOURCES = ["manual", "import", "api", "routine"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

/* ─────────────────────────── Vertikály ─────────────────────────── */

export const CATEGORIES = [
  /* ── Jozo (remeslá, stavba, auto) — pôvodné id ostávajú kvôli dátam ── */
  { id: "zahradnictvo", label: "Záhrady / záhradníctvo", emoji: "🌱", gallery: true, code: "GARDEN", caller: "jozo" },
  { id: "stolarstvo", label: "Stolárstvo / nábytok na mieru", emoji: "🪵", gallery: true, code: "CUSTOM_FURNITURE", caller: "jozo" },
  { id: "kuchyne", label: "Kuchyne na mieru", emoji: "🍽️", gallery: true, code: "KITCHENS", caller: "jozo" },
  { id: "kovovyroba", label: "Kovovýroba / zváranie", emoji: "⚙️", gallery: true, code: "OTHER_LOCAL_SERVICE", caller: "jozo" },
  { id: "brany-ploty", label: "Brány, ploty, pergoly", emoji: "🚧", gallery: true, code: "GATES_FENCES", caller: "jozo" },
  { id: "stavebnictvo", label: "Stavebníctvo / rekonštrukcie", emoji: "🏗️", gallery: true, code: "CONSTRUCTION", caller: "jozo" },
  { id: "murari", label: "Murári", emoji: "🧱", gallery: true, code: "CONSTRUCTION", caller: "jozo" },
  { id: "tesari", label: "Tesári", emoji: "🪚", gallery: true, code: "CONSTRUCTION", caller: "jozo" },
  { id: "strechy", label: "Strechy / pokrývači / klampiari", emoji: "🏠", gallery: true, code: "ROOFING", caller: "jozo" },
  { id: "fasady", label: "Fasády / zatepľovanie", emoji: "🧱", gallery: true, code: "FACADE", caller: "jozo" },
  { id: "maliar", label: "Maliar / natierač", emoji: "🎨", gallery: true, code: "PAINTER", caller: "jozo" },
  { id: "podlahy", label: "Podlahy", emoji: "🪟", gallery: true, code: "FLOORING", caller: "jozo" },
  { id: "obklady", label: "Obklady a dlažby", emoji: "🔲", gallery: true, code: "CONSTRUCTION", caller: "jozo" },
  { id: "vodoinstalater", label: "Vodoinštalatér", emoji: "🚰", gallery: false, code: "PLUMBER", caller: "jozo" },
  { id: "kurenie", label: "Kúrenie / tepelné čerpadlá", emoji: "🔥", gallery: false, code: "HEATING", caller: "jozo" },
  { id: "elektrikar", label: "Elektrikár", emoji: "⚡", gallery: false, code: "ELECTRICIAN", caller: "jozo" },
  { id: "kominarstvo", label: "Kominárstvo", emoji: "🔥", gallery: false, code: "OTHER_LOCAL_SERVICE", caller: "jozo" },
  { id: "autoservis", label: "Autoservis", emoji: "🔧", gallery: false, code: "CAR_SERVICE", caller: "jozo" },
  { id: "pneuservis", label: "Pneuservis", emoji: "🛞", gallery: false, code: "TIRE_SERVICE", caller: "jozo" },
  { id: "detailing", label: "Auto detailing", emoji: "✨", gallery: true, code: "DETAILING", caller: "jozo" },
  /* ── Soňa (vizuálne a osobné služby, reality, interiér) ── */
  { id: "kadernictvo", label: "Kaderníctvo", emoji: "💇", gallery: true, code: "HAIR", caller: "sona" },
  { id: "barber", label: "Barber", emoji: "💈", gallery: true, code: "BARBER", caller: "sona" },
  { id: "makeup", label: "Make-up / vizáž", emoji: "💄", gallery: true, code: "MAKEUP", caller: "sona" },
  { id: "nechty", label: "Nechty / manikúra", emoji: "💅", gallery: true, code: "NAILS", caller: "sona" },
  { id: "mihalnice", label: "Mihalnice / obočie", emoji: "👁️", gallery: true, code: "LASHES", caller: "sona" },
  { id: "kozmetika", label: "Kozmetika / beauty", emoji: "🧴", gallery: false, code: "BEAUTY", caller: "sona" },
  { id: "fotograf", label: "Fotograf", emoji: "📷", gallery: true, code: "PHOTOGRAPHY", caller: "sona" },
  { id: "video", label: "Video / kameraman", emoji: "🎬", gallery: true, code: "VIDEO", caller: "sona" },
  { id: "svadby", label: "Svadobné služby", emoji: "💍", gallery: true, code: "WEDDING", caller: "sona" },
  { id: "reality", label: "Reality / makléri", emoji: "🏡", gallery: true, code: "REAL_ESTATE", caller: "sona" },
  { id: "developer", label: "Developer", emoji: "🏢", gallery: true, code: "DEVELOPER", caller: "sona" },
  { id: "interier", label: "Interiérový dizajn", emoji: "🛋️", gallery: true, code: "INTERIOR_DESIGN", caller: "sona" },
  { id: "architekt", label: "Architekt", emoji: "📐", gallery: true, code: "ARCHITECTURE", caller: "sona" },
  { id: "ine", label: "Iná lokálna služba", emoji: "🛠️", gallery: false, code: "OTHER_LOCAL_SERVICE", caller: null },
] as const;
export type CategoryId = (typeof CATEGORIES)[number]["id"];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]];

export function categoryOf(id: string | null | undefined) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}

/* ─────────────────────────── Evidence ─────────────────────────── */

export const EvidenceSchema = z.object({
  id: z.string(),
  /** web = vlastný web firmy, catalog = katalóg/register, manual = zadal človek, call = z telefonátu */
  source: z.enum(["web", "catalog", "manual", "call"]),
  url: z.string().nullable(),
  page: z.string().nullable(),
  /** Doslovný text/element, z ktorého tvrdenie vychádza. */
  excerpt: z.string(),
  checked_at: z.string(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

/** Tvrdenie + odkazy na evidence. Tvrdenie bez evidence sa v UI označí ako neoverené. */
export const ClaimSchema = z.object({
  text: z.string(),
  evidence_ids: z.array(z.string()),
});
export type Claim = z.infer<typeof ClaimSchema>;

/* ─────────────────────────── Lead Radar (overená business entita) ─────────────────────────── */

/** Fakt s pôvodom: odkiaľ ho vieme, ako isto, kedy overený. */
export const FactSchema = z.object({
  value: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  sources: z.array(z.string()),
  evidence: z.array(z.string()).optional().default([]),
  verified_at: z.string().nullable().optional(),
});
export type Fact = z.infer<typeof FactSchema>;

/**
 * Stav webu z pohľadu IDENTITY (patrí web firme?). „Firma nemá web“ neexistuje:
 * confirmed = dôkaz (telefón/IČO/e-mail/odkaz), probable = stredné signály, no_website_found = hľadali sme a nenašli,
 * uncertain = nevieme (nehľadalo sa dosť / web sa nenačítal / iba podobný názov).
 */
export const WEBSITE_RESOLUTIONS = ["confirmed", "probable", "no_website_found", "uncertain"] as const;
export type WebsiteResolution = (typeof WEBSITE_RESOLUTIONS)[number];
export const WEBSITE_RESOLUTION_LABEL: Record<WebsiteResolution, string> = {
  confirmed: "Web potvrdený",
  probable: "Web pravdepodobne ich",
  no_website_found: "Web sme nenašli",
  uncertain: "Web neistý",
};
export const DATA_QUALITY = ["gold", "silver", "research"] as const;
export type DataQuality = (typeof DATA_QUALITY)[number];
export const DATA_QUALITY_LABEL: Record<DataQuality, string> = { gold: "GOLD", silver: "SILVER", research: "RESEARCH" };

const loose = z.array(z.record(z.string(), z.unknown())).optional().default([]);
export const RadarProfileSchema = z
  .object({
    version: z.number(),
    entity_id: z.string().nullable().optional(),
    country: z.enum(["SK", "CZ"]),
    legal_name: z.string().nullable().optional(),
    brand_names: z.array(z.string()).optional().default([]),
    historical_names: z.array(z.string()).optional().default([]),
    city: z.string().nullable().optional(),
    addresses: z.array(FactSchema).optional().default([]),
    company_ids: z.array(FactSchema).optional().default([]),
    phones: z.array(FactSchema).optional().default([]),
    emails: z.array(FactSchema).optional().default([]),
    primary_phone: z.object({ value: z.string(), confidence: z.string(), sources: z.array(z.string()) }).nullable().optional(),
    website: z
      .object({
        url: z.string().nullable(),
        domain: z.string().nullable(),
        status: z.enum(WEBSITE_RESOLUTIONS),
        confidence: z.string().nullable().optional(),
        evidence: z.array(z.string()).optional().default([]),
        health: z
          .object({
            state: z.string(),
            issues: z.array(z.object({ key: z.string(), text: z.string(), excerpt: z.string().optional(), points: z.number().optional() })).optional().default([]),
          })
          .passthrough()
          .nullable()
          .optional(),
      })
      .nullable()
      .optional(),
    website_resolution: z.enum(WEBSITE_RESOLUTIONS).optional(),
    websites: loose,
    historical_websites: loose,
    rejected_websites: loose,
    socials: z
      .array(
        z
          .object({
            platform: z.string(),
            url: z.string().nullable().optional(),
            handle: z.string().nullable().optional(),
            display_name: z.string().nullable().optional(),
            bio: z.string().nullable().optional(),
            website: z.string().nullable().optional(),
            match: z.string().nullable().optional(),
            evidence: z.array(z.string()).optional().default([]),
            activity: z.string().nullable().optional(),
            source: z.string().nullable().optional(),
          })
          .passthrough(),
      )
      .optional()
      .default([]),
    category: z
      .object({ id: z.string(), code: z.string(), subcategory: z.string().nullable().optional(), confidence: z.string(), evidence: z.array(z.string()) })
      .passthrough()
      .nullable()
      .optional(),
    services: z.array(z.string()).optional().default([]),
    description: z.object({ text: z.string(), confidence: z.string(), sources: z.array(z.string()) }).nullable().optional(),
    business_status: z.object({ value: z.string(), evidence: z.array(z.string()) }).nullable().optional(),
    commercial_problems: z
      .array(z.object({ code: z.string(), label: z.string(), evidence: z.array(z.string()), heuristic: z.boolean().optional() }))
      .optional()
      .default([]),
    social_first: z.boolean().optional().default(false),
    identity: z.object({ confidence: z.string(), evidence: z.array(z.string()) }).optional(),
    data_quality: z.enum(DATA_QUALITY).nullable().optional(),
    data_quality_why: z.array(z.string()).optional().default([]),
    recommended_caller: z.string().nullable().optional(),
    caller_fit: z.object({ score: z.number(), reasons: z.array(z.string()) }).nullable().optional(),
    score: z
      .object({ points: z.number(), reasons: z.array(z.object({ key: z.string(), points: z.number(), label: z.string() })) })
      .nullable()
      .optional(),
    sources: loose,
    possible_duplicates: loose,
    source_unavailable: z.array(z.string()).optional().default([]),
    register: z.record(z.string(), z.unknown()).nullable().optional(),
    last_verified: z.record(z.string(), z.string()).optional().default({}),
    trace: z.array(z.object({ step: z.string(), detail: z.string(), at: z.string().optional() })).optional().default([]),
    exploration: z.boolean().optional().default(false),
    web_search_queries: z.array(z.string()).optional().default([]),
    /* ── Opportunity Engine: procesné signály a tagy z webu (routine/radar/signals.py) ── */
    process_signals: z
      .array(z.object({ key: z.string(), level: z.string(), text: z.string(), excerpt: z.string(), source: z.string() }))
      .optional()
      .default([]),
    tags: z
      .object({
        ads_status: z.enum(["TAG_PRESENT", "NOT_FOUND", "UNKNOWN"]),
        spend: z.literal("UNKNOWN"),
        google_ads: z.string().nullable(),
        ga4: z.string().nullable(),
        gtm: z.string().nullable(),
        meta_pixel: z.string().nullable(),
      })
      .nullable()
      .optional(),
  })
  .passthrough();
export type RadarProfile = z.infer<typeof RadarProfileSchema>;

/** Spätná väzba volajúceho — senzor kvality dát. */
export const FEEDBACK_KINDS = [
  "has_other_web",
  "wrong_web",
  "wrong_category",
  "wrong_description",
  "business_gone",
  "wrong_phone",
  "duplicate",
  "not_target",
  "bad_opportunity",
] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
export const FEEDBACK_LABEL: Record<FeedbackKind, string> = {
  has_other_web: "Má web, systém ho nenašiel",
  wrong_web: "Zlý web priradený",
  wrong_category: "Zlá kategória",
  wrong_description: "Zlý popis",
  business_gone: "Firma už neexistuje",
  wrong_phone: "Zlý telefón",
  duplicate: "Duplicitný lead",
  not_target: "Nie je cieľový segment",
  bad_opportunity: "Dôvod hovoru nesedí",
};
export const FeedbackSchema = z.object({
  id: z.string(),
  kind: z.enum(FEEDBACK_KINDS),
  note: z.string().nullable(),
  url: z.string().nullable(),
  by: z.string(),
  at: z.string(),
  resolved_at: z.string().nullable().optional(),
});
export type Feedback = z.infer<typeof FeedbackSchema>;

/* ─────────────────────────── Company ─────────────────────────── */

export const CompanySchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(CATEGORY_IDS),
  city: z.string().nullable(),
  region: z.string().nullable(),
  contact_person: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  website: z.string().nullable(),
  social_profiles: z.array(z.string()),
  /** Normalizované kľúče pre deduplikáciu (ico:, email:, phone:, domain:, name:) */
  dedupe_keys: z.array(z.string()),
  created_at: z.string(),
  updated_at: z.string(),
  /** IČO z registra — najsilnejší identifikátor firmy. */
  ico: z.string().nullable().optional(),
  /** Odkiaľ firmu poznáme (azet, zoznam, bazos, …). Jedna firma = jeden záznam, zdroje sú metadáta. */
  sources: z.array(z.object({ source: z.string(), url: z.string().nullable(), seen_at: z.string() })).optional(),
  /** Firma povedala „už nám nevolajte“ — nikdy sa nevráti do fronty. */
  do_not_call: z.boolean().optional(),
  /** SK | CZ — súčasť identity (rovnaký názov v Brne a v Bratislave = dve firmy). */
  country: z.enum(["SK", "CZ"]).nullable().optional(),
  /** Lead Radar: overená entita s evidenciou ku každému údaju. */
  profile: RadarProfileSchema.nullable().optional(),
});
export type Company = z.infer<typeof CompanySchema>;

/* ─────────────────────────── Analysis ─────────────────────────── */

export const AnalysisSchema = z.object({
  /** routine = výskum pripravila ranná rutina (agent overil web, katalóg aj register) */
  engine: z.enum(["claude", "rules", "routine"]),
  model: z.string().nullable(),
  analyzed_at: z.string(),
  company_summary: z.string(),
  /** Prečo bola firma vybraná — konkrétne, nie frázy. */
  why_this_lead: z.string(),
  positive_points: z.array(ClaimSchema),
  observations: z.array(ClaimSchema),
  /** Čo môže brzdiť dôveru / kontakt. */
  customer_risk: z.string().nullable(),
  /** Čo môže chýbať zákazníkovi firmy. */
  customer_gap: z.string().nullable(),
  /** Čo Dominik realisticky vyrieši jednoduchým webom. */
  opportunity: z.string().nullable(),
  primary_hook: z.string().nullable(),
  secondary_hook: z.string().nullable(),
  /** Keď AI nič podstatné nenašla, povie to. */
  nothing_found: z.boolean(),
  confidence: z.enum(["high", "medium", "low"]),
  evidence: z.array(EvidenceSchema),
  warnings: z.array(z.string()),
});
export type Analysis = z.infer<typeof AnalysisSchema>;

/* ─────────────────────────── Call brief ─────────────────────────── */

export const ObjectionSchema = z.object({ objection: z.string(), answer: z.string() });

/** Reálny produkt/služba z ich webu — Jozo si ho pred hovorom otvorí. */
export const ProductRefSchema = z.object({
  name: z.string().min(2).max(160),
  url: z.string().url().max(500),
  price: z.string().max(40).nullable().optional().default(null),
  note: z.string().max(300).nullable().optional().default(null),
});
export type ProductRef = z.infer<typeof ProductRefSchema>;

export const CallBriefSchema = z.object({
  /** POCHVALA → POZOROVANIE → DÔVOD → PRÍLEŽITOSŤ */
  praise: z.string(),
  observation: z.string(),
  reason: z.string(),
  opportunity: z.string(),
  main_idea: z.string(),
  call_opening: z.string(),
  natural_pitch: z.string(),
  dominik_intro: z.string(),
  /** Iba ak je k dispozícii reálna ponuka (existing_offer.available). */
  offer: z.string().nullable(),
  offer_id: z.string().nullable(),
  estimated_price: z.number().nullable(),
  key_question: z.string(),
  goal: z.string(),
  remember: z.string(),
  what_not_to_say: z.array(z.string()),
  objections: z.array(ObjectionSchema),
  product: ProductRefSchema.nullable().optional(),
});
export type CallBrief = z.infer<typeof CallBriefSchema>;

/* ─────────────────────────── Trust ─────────────────────────── */

export const TrustSchema = z.object({
  web: z.enum(TRUST_LEVELS),
  phone: z.enum(TRUST_LEVELS),
  company: z.enum(TRUST_LEVELS),
  hook: z.enum(TRUST_LEVELS),
});
export type Trust = z.infer<typeof TrustSchema>;

/* ─────────────────────────── Qualification ─────────────────────────── */

export const QualificationSchema = z.object({
  call_id: z.string(),
  called_at: z.string(),
  caller: z.string(),
  company_said: z.string().nullable(),
  preferred_time: z.enum(CALL_WHEN).nullable(),
  email: z.string().nullable(),
  /** Odporúčaný začiatok Dominikovho hovoru (3–5 viet). */
  dominik_opening: z.array(z.string()),
  dominik_goal: z.array(z.string()),
});
export type Qualification = z.infer<typeof QualificationSchema>;

/* ─────────────────────────── Lead ─────────────────────────── */

export const LeadSchema = z.object({
  id: z.string(),
  company_id: z.string(),
  status: z.enum(LEAD_STATUSES),
  priority: z.enum(PRIORITIES),
  priority_reasons: z.array(z.string()),
  source: z.enum(LEAD_SOURCES),
  source_url: z.string().nullable(),
  assigned_to: z.string().nullable(),
  analysis: AnalysisSchema.nullable(),
  call_brief: CallBriefSchema.nullable(),
  trust: TrustSchema,
  qualification: QualificationSchema.nullable(),
  next_action: z.string().nullable(),
  next_action_at: z.string().nullable(),
  last_contact: z.string().nullable(),
  call_attempts: z.number(),
  archive_reason: z.enum(ARCHIVE_REASONS).nullable(),
  notes: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  /* ── 2.0 (voliteľné kvôli starším záznamom) ── */
  website_status: z.enum(["no_website", "broken", "weak", "working", "uncertain"]).nullable().optional(),
  /** Konkrétny problém webu (parked, db_error, bad_cert, foreign_redirect, domain_dead, http_error, frames, php_error, no_viewport…). */
  website_issue: z.string().nullable().optional(),
  /** Kedy sme stav webu naposledy overili. */
  website_checked_at: z.string().nullable().optional(),
  business_check: z.enum(["confirmed", "changed", "uncertain"]).nullable().optional(),
  score: z.lazy(() => ScoreSchema).nullable().optional(),
  consent: z.lazy(() => ConsentSchema).nullable().optional(),
  sale: z.lazy(() => SaleSchema).nullable().optional(),
  lost_reason: z.string().nullable().optional(),
  /** Kedy lead prvýkrát dosiahol fázu Dominikovho pipeline (contacted, interested, …) — pre funnely aj po strate. */
  stage_at: z.record(z.string(), z.string()).optional(),
  assigned_history: z.array(z.object({ user: z.string().nullable(), at: z.string(), by: z.string() })).optional(),
  /* ── 3.0 Lead Radar ── */
  website_resolution: z.enum(WEBSITE_RESOLUTIONS).nullable().optional(),
  data_quality: z.enum(DATA_QUALITY).nullable().optional(),
  recommended_caller: z.string().nullable().optional(),
  caller_fit: z.object({ score: z.number(), reasons: z.array(z.string()) }).nullable().optional(),
  /** Hlavný obchodný problém (SOCIAL_FIRST_BUSINESS, BROKEN_WEBSITE, SOCIAL_WEB_GAP, …). */
  commercial_problem: z.string().nullable().optional(),
  exploration: z.boolean().optional(),
  feedback: z.array(FeedbackSchema).optional(),
  /** Volajúci nahlásil chybu v dátach → preveriť (rutina / Dominik). */
  needs_reverify: z.boolean().optional(),
  /* ── Opportunity Engine (lib/opportunity.ts) a routing kanála (lib/channel.ts) ── */
  opportunity: z.record(z.string(), z.unknown()).nullable().optional(),
  channel_decision: z.record(z.string(), z.unknown()).nullable().optional(),
  /** Demo (Demo Engine). Vytvára ho iba Dominik tlačidlom, nikdy automaticky. */
  demo: z.record(z.string(), z.unknown()).nullable().optional(),
  /** Ručne overená reklama (Transparency Center / Ad Library). Jediný spôsob, ako vznikne ACTIVE. */
  ads_check: z
    .object({ status: z.enum(["ACTIVE", "NOT_FOUND"]), url: z.string().nullable(), checked_at: z.string(), by: z.string() })
    .nullable()
    .optional(),
});
export type Lead = z.infer<typeof LeadSchema>;

export const WEBSITE_STATUS_LABEL: Record<NonNullable<Lead["website_status"]>, string> = {
  // „Bez webu“ netvrdíme nikdy — vieme iba, že sme ho nenašli.
  no_website: "Web sme nenašli",
  broken: "Nefunkčný web",
  weak: "Slabý / zastaraný web",
  working: "Funkčný web",
  uncertain: "Neisté",
};

/** Vysvetliteľné skóre: body = súčet faktorov. Žiadne „AI 94 %“. */
export const ScoreSchema = z.object({
  version: z.number(),
  points: z.number(),
  band: z.enum(["high", "medium", "low"]),
  factors: z.array(z.object({ key: z.string(), label: z.string(), points: z.number() })),
  risks: z.array(z.object({ key: z.string(), label: z.string(), points: z.number() })),
  offer_fit: z.enum(["fits", "unknown", "no_fit"]),
});
export type Score = z.infer<typeof ScoreSchema>;

/**
 * SÚHLAS S KONTAKTOM (Sonin hlavný výsledok). Firma dovolila, aby sa Dominik ozval.
 * Nie je to záujem o web — ten zapisuje až Dominik.
 */
export const ConsentSchema = z.object({
  at: z.string(),
  by_user: z.string(),
  by_name: z.string(),
  /** consent = „nech sa ozve“, info = firma si vyžiadala informácie */
  kind: z.enum(["consent", "info"]),
  contact_person: z.string().nullable(),
  company_said: z.string().nullable(),
  /** Čo firmu zaujalo — kontext, nie záujem. */
  caught_attention: z.string().nullable(),
  heard_price: z.boolean(),
  /** Kedy môže Dominik volať (ISO dátum alebo null) + voľný text („poobede“). */
  call_on: z.string().nullable(),
  call_note: z.string().nullable(),
  email: z.string().nullable(),
  note: z.string().nullable(),
});
export type Consent = z.infer<typeof ConsentSchema>;

export const SaleSchema = z.object({
  price: z.number().nullable(),
  agreed_at: z.string().nullable(),
  paid_at: z.string().nullable(),
  paid_amount: z.number().nullable(),
});
export type Sale = z.infer<typeof SaleSchema>;

/* ─────────────────────────── Peniaze ─────────────────────────── */

/**
 * Odmena volajúceho. POTENCIÁLNA sa neukladá (počíta sa z pipeline),
 * PENDING = čaká na splnenie podmienky, CONFIRMED = nárok vznikol, PAID = vyplatená.
 * amount je null, kým Dominik nenastaví pravidlo (NEEDS CONFIGURATION).
 */
export const COMMISSION_STATES = ["pending", "confirmed", "paid", "void"] as const;
export const CommissionSchema = z.object({
  id: z.string(),
  user: z.string(),
  lead_id: z.string(),
  kind: z.enum(["handoff", "sale"]),
  amount: z.number().nullable(),
  state: z.enum(COMMISSION_STATES),
  reason: z.string(),
  sale_price: z.number().nullable(),
  created_at: z.string(),
  confirmed_at: z.string().nullable(),
  paid_at: z.string().nullable(),
});
export type Commission = z.infer<typeof CommissionSchema>;

export const COMMISSION_STATE_LABEL: Record<Commission["state"], string> = {
  pending: "Čaká na potvrdenie",
  confirmed: "Potvrdené",
  paid: "Vyplatené",
  void: "Zrušené",
};

/** Konfigurácia, ktorú musí zadať Dominik. null = NEEDS CONFIGURATION (nikdy si ju nevymýšľame). */
export const SettingsSchema = z.object({
  compensation: z.object({
    /** handoff = za súhlas s kontaktom, sale = za zaplatený predaj, both = oboje */
    model: z.enum(["handoff", "sale", "both"]).nullable(),
    handoff_amount: z.number().nullable(),
    /** Kedy vzniká nárok za handoff. */
    handoff_condition: z.enum(["on_consent", "on_contacted", "on_interest"]).nullable(),
    sale_amount: z.number().nullable(),
    sale_percent: z.number().nullable(),
  }),
  /** Čo presne klient dostane za cenu ponuky. */
  package: z.object({
    price: z.number().nullable(),
    pages: z.string().nullable(),
    texts: z.string().nullable(),
    images: z.string().nullable(),
    form: z.string().nullable(),
    domain: z.string().nullable(),
    hosting: z.string().nullable(),
    edits: z.string().nullable(),
    maintenance: z.string().nullable(),
    delivery: z.string().nullable(),
  }),
  /** Routing kategória → volajúci (username). Chýbajúca kategória = predvolený volajúci z CATEGORIES. */
  routing: z.record(z.string(), z.string().nullable()).optional().default({}),
  /** Posledné behy Lead Radaru (zdravie zdrojov, dopyty, kvalita) — pre admin a rotáciu lokalít. */
  radar: z
    .object({
      runs: z.array(z.record(z.string(), z.unknown())).default([]),
      query_log: z.array(z.record(z.string(), z.unknown())).default([]),
      /** Golden dataset (ručne overené firmy) — súkromné, nie v repozitári. */
      golden: z.array(z.record(z.string(), z.unknown())).optional(),
    })
    .optional()
    .default({ runs: [], query_log: [] }),
});
export type Settings = z.infer<typeof SettingsSchema>;

export function defaultSettings(): Settings {
  return {
    compensation: { model: null, handoff_amount: null, handoff_condition: null, sale_amount: null, sale_percent: null },
    // Cenu 200 € zadal Dominik (hotový web, ktorý pôvodný klient neprevzal). Zvyšok = NEEDS CONFIGURATION.
    package: {
      price: 200,
      pages: null,
      texts: null,
      images: null,
      form: null,
      domain: null,
      hosting: null,
      edits: null,
      maintenance: null,
      delivery: null,
    },
    routing: {},
    radar: { runs: [], query_log: [] },
  };
}

export const CallLogSchema = z.object({
  id: z.string(),
  lead_id: z.string(),
  created_at: z.string(),
  by: z.string(),
  role: z.enum(["caller", "admin"]),
  outcome: z.string(),
  note: z.string().nullable(),
  company_said: z.string().nullable(),
  dominik_may_call: z.boolean(),
  preferred_time: z.enum(CALL_WHEN).nullable(),
  email: z.string().nullable(),
  /** username volajúceho (staršie hovory ho nemajú — dopočíta sa z `by`). */
  by_user: z.string().optional(),
  /** Poradie pokusu pri volajúcom (1, 2, 3). */
  attempt: z.number().optional(),
});
export type CallLog = z.infer<typeof CallLogSchema>;

export const LeadEventSchema = z.object({
  id: z.string(),
  lead_id: z.string(),
  at: z.string(),
  actor: z.string(),
  kind: z.enum(["created", "merged", "analysis", "status", "call", "handoff", "dominik_call", "note", "archive", "money", "assign"]),
  label: z.string(),
});
export type LeadEvent = z.infer<typeof LeadEventSchema>;

export const OfferSchema = z.object({
  id: z.string(),
  /** Segment, pre ktorý sa hotový web dá rozumne prispôsobiť. */
  category: z.enum(CATEGORY_IDS),
  available: z.boolean(),
  estimated_price: z.number().nullable(),
  note: z.string(),
  preview_url: z.string().nullable(),
  created_at: z.string(),
});
export type Offer = z.infer<typeof OfferSchema>;

export const NotificationSchema = z.object({
  id: z.string(),
  at: z.string(),
  lead_id: z.string().nullable(),
  kind: z.enum(["qualified", "new_leads", "info", "money"]),
  title: z.string(),
  body: z.string(),
  read: z.boolean(),
});
export type Notification = z.infer<typeof NotificationSchema>;

/** Lead spolu s firmou — čo UI reálne potrebuje. */
export type LeadWithCompany = Lead & { company: Company };
export type LeadDetail = LeadWithCompany & { calls: CallLog[]; events: LeadEvent[] };

/* ─────────────────────────── Vstupy (ingestion) ─────────────────────────── */

const optionalText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

/** Vstup pre nový lead — rovnaký pre formulár, CSV/JSON import aj API rannej rutiny. */
export const LeadInputSchema = z.object({
  name: z.string().trim().min(2, "Zadaj názov firmy").max(200),
  category: z
    .string()
    .optional()
    .nullable()
    .transform((v) => normalizeCategory(v)),
  city: optionalText,
  region: optionalText,
  contact_person: optionalText,
  phone: optionalText.refine((v) => !v || /[0-9]{6,}/.test(v.replace(/\D/g, "")), "Telefón vyzerá neplatne"),
  email: optionalText.refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-mail vyzerá neplatne"),
  address: optionalText,
  website: optionalText.transform((v) => normalizeUrl(v)),
  social_profiles: z.array(z.string().trim().max(300)).max(10).optional().default([]),
  note: optionalText,
  source: z.enum(LEAD_SOURCES).optional().default("manual"),
  source_url: optionalText,
});
export type LeadInput = z.output<typeof LeadInputSchema>;
export type LeadInputRaw = z.input<typeof LeadInputSchema>;

export function normalizeUrl(v: string | null): string | null {
  if (!v) return null;
  let s = v.trim();
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (!u.hostname.includes(".")) return null;
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

const CATEGORY_ALIASES: [RegExp, CategoryId][] = [
  [/barber|holi[cč]/i, "barber"],
  [/kader/i, "kadernictvo"],
  [/make-?up|viz[aá][zž]/i, "makeup"],
  [/necht|nehty|manik[uú]r/i, "nechty"],
  [/mihal|[rř]as[yi]|oboč/i, "mihalnice"],
  [/kozmet|kosmet|beauty/i, "kozmetika"],
  [/fotograf/i, "fotograf"],
  [/kameram|video/i, "video"],
  [/svad|svat/i, "svadby"],
  [/realit|makl/i, "reality"],
  [/developer/i, "developer"],
  [/interi[eé]r/i, "interier"],
  [/architekt/i, "architekt"],
  [/kuchyn/i, "kuchyne"],
  [/rekon[sš]tr|stavebn/i, "stavebnictvo"],
  [/maliar|mal[ií][rř]/i, "maliar"],
  [/fas[aá]d|zatepl/i, "fasady"],
  [/k[uú]ren|topen|tepeln/i, "kurenie"],
  [/pneu/i, "pneuservis"],
  [/autoserv|oprava [aá]ut/i, "autoservis"],
  [/detailing/i, "detailing"],
  [/z[aá]hrad/i, "zahradnictvo"],
  [/stol[aá]r/i, "stolarstvo"],
  [/kov|zv[aá]r/i, "kovovyroba"],
  [/br[aá]n|plot|pergol/i, "brany-ploty"],
  [/mur[aá]r/i, "murari"],
  [/tes[aá]r/i, "tesari"],
  [/strech|pokr[yý]v|klamp/i, "strechy"],
  [/vodo|in[sš]tal/i, "vodoinstalater"],
  [/elektr/i, "elektrikar"],
  [/podlah/i, "podlahy"],
  [/obklad|dla[zž]/i, "obklady"],
  [/kom[ií]n/i, "kominarstvo"],
];

export function normalizeCategory(v: string | null | undefined): CategoryId {
  if (!v) return "ine";
  const exact = CATEGORIES.find((c) => c.id === v);
  if (exact) return exact.id;
  for (const [re, id] of CATEGORY_ALIASES) if (re.test(v)) return id;
  return "ine";
}

export type Role = "admin" | "caller";
export type SessionUser = { username: string; name: string; role: Role };
/** Účet v systéme. Neaktívny volajúci (napr. Jozo) ostáva kvôli histórii, nedostáva nové leady. */
export type UserInfo = SessionUser & { active: boolean; /** tvary slovies v scenári: „všimla/všimol som si“ */ speech?: "f" | "m" };

/* ─────────────────────────── Next actions ─────────────────────────── */

/** Čo treba s leadom urobiť — riadi celý dashboard (action-first). */
export const NEXT_ACTIONS = {
  analyze: { label: "Analyzovať firmu", who: "admin", icon: "✨" },
  review: { label: "Skontrolovať lead", who: "admin", icon: "👀" },
  caller_call: { label: "Zavolať", who: "caller", icon: "☎️" },
  callback: { label: "Dohodnutý callback", who: "caller", icon: "📅" },
  verify_phone: { label: "Overiť číslo", who: "admin", icon: "🔎" },
  dominik_call: { label: "Zavolať kvalifikovaný lead", who: "admin", icon: "🔥" },
  send_offer: { label: "Poslať ponuku", who: "admin", icon: "📩" },
  send_demo: { label: "Poslať ukážku", who: "admin", icon: "🖼️" },
  send_email: { label: "Poslať e-mail", who: "admin", icon: "📩" },
  follow_up: { label: "Follow-up", who: "admin", icon: "🗓️" },
  async_message: { label: "Pripraviť demo + správu na schválenie", who: "admin", icon: "✉️" },
} as const;
export type NextAction = keyof typeof NEXT_ACTIONS;
