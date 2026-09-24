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

export const LEAD_STATUSES = [
  "new",
  "analyzed",
  "ready_to_call",
  "called",
  "dominik_call",
  "offer_sent",
  "negotiation",
  "won",
  "lost",
  "archived",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "Nový",
  analyzed: "Analyzovaný",
  ready_to_call: "Pripravený na telefonát",
  called: "Volané",
  dominik_call: "Kvalifikovaný",
  offer_sent: "Ponuka odoslaná",
  negotiation: "Rokovanie",
  won: "Vyhraté",
  lost: "Stratené",
  archived: "Vyradené",
};

export const PRIORITIES = ["hot", "ready", "check", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const TRUST_LEVELS = ["verified", "partial", "unverified"] as const;
export type TrustLevel = (typeof TRUST_LEVELS)[number];

export const CALL_OUTCOMES = [
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
  dominik_may_call: "Dominik môže zavolať",
  call_later: "Ozvať sa neskôr",
  not_interested: "Nemá záujem",
  wants_email: "Chce e-mail",
  no_answer: "Nezdvihol",
  wants_demo: "Chce ukážku",
  wants_price: "Chce cenu",
  has_web: "Už má web / rieši ho",
  wrong_number: "Nesprávne číslo",
  not_exists: "Firma neexistuje",
  other: "Iné",
};

/** Výsledky Dominikovho hovoru — posúvajú obchod ďalej. */
export const DOMINIK_OUTCOMES = [
  "send_offer",
  "send_demo",
  "follow_up",
  "no_answer",
  "not_interested",
] as const;
export type DominikOutcome = (typeof DOMINIK_OUTCOMES)[number];

export const DOMINIK_OUTCOME_LABEL: Record<DominikOutcome, string> = {
  send_offer: "Poslať ponuku",
  send_demo: "Poslať ukážku",
  follow_up: "Follow-up neskôr",
  no_answer: "Nezdvihol",
  not_interested: "Nemá záujem",
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
};

export const LEAD_SOURCES = ["manual", "import", "api", "routine"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

/* ─────────────────────────── Vertikály ─────────────────────────── */

export const CATEGORIES = [
  { id: "zahradnictvo", label: "Záhradníctvo", emoji: "🌱", gallery: true },
  { id: "stolarstvo", label: "Stolárstvo", emoji: "🪵", gallery: true },
  { id: "kovovyroba", label: "Kovovýroba / zváranie", emoji: "⚙️", gallery: true },
  { id: "brany-ploty", label: "Brány a ploty", emoji: "🚧", gallery: true },
  { id: "murari", label: "Murári", emoji: "🧱", gallery: true },
  { id: "tesari", label: "Tesári", emoji: "🪚", gallery: true },
  { id: "strechy", label: "Strechy / pokrývači / klampiari", emoji: "🏠", gallery: true },
  { id: "vodoinstalater", label: "Vodoinštalatér", emoji: "🚰", gallery: false },
  { id: "elektrikar", label: "Elektrikár", emoji: "⚡", gallery: false },
  { id: "podlahy", label: "Podlahy", emoji: "🪟", gallery: true },
  { id: "obklady", label: "Obklady a dlažby", emoji: "🔲", gallery: true },
  { id: "kominarstvo", label: "Kominárstvo", emoji: "🔥", gallery: false },
  { id: "ine", label: "Iné remeslo", emoji: "🛠️", gallery: false },
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
  /** Normalizované kľúče pre deduplikáciu (email:, phone:, domain:, name:) */
  dedupe_keys: z.array(z.string()),
  created_at: z.string(),
  updated_at: z.string(),
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
});
export type Lead = z.infer<typeof LeadSchema>;

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
});
export type CallLog = z.infer<typeof CallLogSchema>;

export const LeadEventSchema = z.object({
  id: z.string(),
  lead_id: z.string(),
  at: z.string(),
  actor: z.string(),
  kind: z.enum(["created", "merged", "analysis", "status", "call", "handoff", "dominik_call", "note", "archive"]),
  label: z.string(),
});
export type LeadEvent = z.infer<typeof LeadEventSchema>;

export const OfferSchema = z.object({
  id: z.string(),
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
  kind: z.enum(["qualified", "new_leads", "info"]),
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
  [/z[aá]hrad/i, "zahradnictvo"],
  [/stol[aá]r/i, "stolarstvo"],
  [/kov|zv[aá]r/i, "kovovyroba"],
  [/br[aá]n|plot/i, "brany-ploty"],
  [/mur[aá]r/i, "murari"],
  [/tes[aá]r/i, "tesari"],
  [/strech|pokr[yý]v|klamp/i, "strechy"],
  [/vod|in[sš]tal/i, "vodoinstalater"],
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

/* ─────────────────────────── Next actions ─────────────────────────── */

/** Čo treba s leadom urobiť — riadi celý dashboard (action-first). */
export const NEXT_ACTIONS = {
  analyze: { label: "Analyzovať firmu", who: "admin", icon: "✨" },
  review: { label: "Skontrolovať lead", who: "admin", icon: "👀" },
  caller_call: { label: "Zavolať", who: "caller", icon: "☎️" },
  verify_phone: { label: "Overiť číslo", who: "admin", icon: "🔎" },
  dominik_call: { label: "Zavolať kvalifikovaný lead", who: "admin", icon: "🔥" },
  send_offer: { label: "Poslať ponuku", who: "admin", icon: "📩" },
  send_demo: { label: "Poslať ukážku", who: "admin", icon: "🖼️" },
  send_email: { label: "Poslať e-mail", who: "admin", icon: "📩" },
  follow_up: { label: "Follow-up", who: "admin", icon: "🗓️" },
} as const;
export type NextAction = keyof typeof NEXT_ACTIONS;
