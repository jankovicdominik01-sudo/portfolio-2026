/**
 * Process Signal Engine → Evidence → Business Pain → Process Reconstruction.
 *
 * Signály zbiera Lead Radar z webu (routine/radar/signals.py). Tu sa iba normalizujú
 * (aj staršie kľúče z profilov pred Phase 2), dostanú id a z nich vzniknú painy.
 * Všetko sú pravidlá. Každý pain a každý krok procesu odkazuje na evidence id.
 * Krok bez evidence nevznikne. Neprítomnosť je vždy „nenašli sme“, nikdy „nemajú“.
 *
 * Úrovne: VERIFIED (objektívny fakt), OBSERVED (viditeľný signál), ESTIMATE (odhad
 * s predpokladmi), UNKNOWN (nevieme).
 */
import type { Lead, RadarProfile } from "./types";
import { segmentFor, type ModuleId, type SegmentTemplate } from "./segments";

export const PROCESS_SIGNALS_VERSION = "1.0";

export const EVIDENCE_LEVELS = ["VERIFIED", "OBSERVED", "ESTIMATE", "UNKNOWN"] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];
export type Confidence = "high" | "medium" | "low";

/* ─────────── Procesné signály ─────────── */

export const PROCESS_SIGNAL_CODES = [
  "PHONE_BOOKING",
  "PHONE_FIRST_CONTACT",
  "GENERIC_CONTACT_FORM",
  "WHATSAPP_PRIMARY",
  "MESSENGER_PRIMARY",
  "PHOTO_UPLOAD_MISSING",
  "PHOTOS_REQUESTED_SEPARATELY",
  "PDF_PRICE_LIST",
  "NO_BOOKING_FOUND",
  "NO_CUSTOMER_STATUS_FOUND",
  "SOCIAL_REALIZATIONS",
  "MANUAL_QUOTE_SIGNAL",
  "MEASUREMENT_REQUIRED",
  "CALL_FOR_PRICE",
  "CALL_FOR_APPOINTMENT",
  "EMAIL_FOR_ORDER",
  /* doplnkové: neprítomnosť formulára a „protisignály“ (nástroj už majú) */
  "NO_FORM_FOUND",
  "BOOKING_TOOL_PRESENT",
  "FILE_UPLOAD_PRESENT",
] as const;
export type ProcessSignalCode = (typeof PROCESS_SIGNAL_CODES)[number];

/** Signál je text na webe, ktorý priamo hovorí o ručnom kroku. */
const STRONG: ProcessSignalCode[] = [
  "CALL_FOR_APPOINTMENT", "PHONE_BOOKING", "CALL_FOR_PRICE", "PHOTOS_REQUESTED_SEPARATELY", "MEASUREMENT_REQUIRED",
  "MANUAL_QUOTE_SIGNAL", "EMAIL_FOR_ORDER", "GENERIC_CONTACT_FORM", "PDF_PRICE_LIST",
];

/** Kľúče z profilov pred Phase 2 (signals.py v1). */
const LEGACY: Record<string, ProcessSignalCode> = {
  phone_ordering: "PHONE_BOOKING",
  photos_by_message: "PHOTOS_REQUESTED_SEPARATELY",
  booking_tool: "BOOKING_TOOL_PRESENT",
  no_booking_found: "NO_BOOKING_FOUND",
  no_form_found: "NO_FORM_FOUND",
};

export type OppEvidence = {
  id: string;
  kind: "signal" | "web" | "register" | "activity" | "ads" | "social";
  code: string;
  level: EvidenceLevel;
  text: string;
  /** Doslovný úryvok / element. */
  excerpt: string;
  source: string | null;
  observed_at: string | null;
  confidence: Confidence;
};

const isCode = (x: string): x is ProcessSignalCode => (PROCESS_SIGNAL_CODES as readonly string[]).includes(x);
const conf = (x: unknown, d: Confidence): Confidence => (x === "high" || x === "medium" || x === "low" ? x : d);

type RawSignal = NonNullable<RadarProfile["process_signals"]>[number] & {
  code?: string;
  evidence?: string;
  observed_at?: string;
  confidence?: string;
};

/** Normalizuje signály z profilu (nové aj staré kľúče). Neznámy kód sa zahodí. */
export function normalizeSignals(profile: RadarProfile | null | undefined): Omit<OppEvidence, "id">[] {
  const at = profile?.last_verified?.website ?? null;
  const out: Omit<OppEvidence, "id">[] = [];
  for (const s of (profile?.process_signals ?? []) as RawSignal[]) {
    let code: string | undefined = s.code ?? s.key;
    if (code === "messenger_cta") code = /whatsapp|wa\.me/i.test(s.excerpt) ? "WHATSAPP_PRIMARY" : "MESSENGER_PRIMARY";
    else if (code && LEGACY[code]) code = LEGACY[code];
    if (!code || !isCode(code) || out.some((x) => x.code === code)) continue;
    const absence = /_FOUND$|_MISSING$/.test(code);
    out.push({
      kind: "signal",
      code,
      level: s.level === "VERIFIED" ? "VERIFIED" : "OBSERVED",
      text: s.text,
      excerpt: s.evidence ?? s.excerpt,
      source: s.source || null,
      observed_at: s.observed_at ?? at,
      confidence: conf(s.confidence, absence ? "medium" : "high"),
    });
  }
  return out;
}

/* ─────────── Evidence pre Opportunity ─────────── */

/** Problémy webu z radaru, ktoré sú objektívna kontrola (VERIFIED). Neprítomnosť = OBSERVED. */
const HEALTH_OBSERVED = new Set(["no_portfolio", "no_cta", "phone_missing", "empty"]);

export function collectEvidence(
  lead: Pick<Lead, "website_status" | "ads_check">,
  profile: RadarProfile | null | undefined,
): OppEvidence[] {
  const ev: OppEvidence[] = [];
  let n = 0;
  const add = (e: Omit<OppEvidence, "id">) => ev.push({ ...e, id: `E${++n}` });
  const webUrl = profile?.website?.url ?? null;
  const webAt = profile?.last_verified?.website ?? null;

  for (const s of normalizeSignals(profile)) add(s);
  for (const i of profile?.website?.health?.issues ?? []) {
    add({
      kind: "web",
      code: `web:${i.key}`,
      level: HEALTH_OBSERVED.has(i.key) ? "OBSERVED" : "VERIFIED",
      text: i.text,
      excerpt: i.excerpt ?? i.text,
      source: webUrl,
      observed_at: webAt,
      confidence: "high",
    });
  }
  if (lead.website_status === "broken" && !ev.some((e) => e.kind === "web")) {
    add({ kind: "web", code: "web:broken", level: "VERIFIED", text: "Web nefunguje (kontrola radaru)", excerpt: webUrl ?? "", source: webUrl, observed_at: webAt, confidence: "high" });
  }
  if (lead.website_status === "no_website") {
    add({ kind: "web", code: "web:not_found", level: "OBSERVED", text: "Vlastný web sme nenašli (ani vyhľadávaním)", excerpt: (profile?.web_search_queries ?? []).slice(0, 2).join(" · ") || "vyhľadávanie", source: null, observed_at: webAt, confidence: "medium" });
  }
  const reg = profile?.register as { found?: boolean; ico?: string; dead?: boolean; registry?: string } | null | undefined;
  if (reg?.found) {
    add({
      kind: "register",
      code: reg.dead ? "register:dead" : "register:active",
      level: "VERIFIED",
      text: reg.dead ? "Firma v registri zanikla alebo je v likvidácii" : `Firma je v registri${reg.ico ? ` (IČO ${reg.ico})` : ""}`,
      excerpt: `${reg.registry ?? "register"}${reg.ico ? ` ${reg.ico}` : ""}`,
      source: reg.registry ?? "register",
      observed_at: profile?.last_verified?.business_status ?? null,
      confidence: "high",
    });
  }
  const bs = profile?.business_status;
  if (bs?.value) {
    add({
      kind: "activity",
      code: `activity:${bs.value}`,
      level: "OBSERVED",
      text: bs.value === "active" ? "Firma je aktívna" : bs.value === "likely_active" ? "Firma je pravdepodobne aktívna" : bs.value === "inactive" ? "Firma je neaktívna" : "Aktivita firmy je neistá",
      excerpt: bs.evidence.join("; ").slice(0, 200),
      source: null,
      observed_at: profile?.last_verified?.business_status ?? null,
      confidence: bs.value === "active" ? "high" : "medium",
    });
  }
  if (lead.ads_check?.status === "ACTIVE") {
    add({ kind: "ads", code: "ads:active", level: "VERIFIED", text: "Reklama beží (ručná kontrola)", excerpt: lead.ads_check.url ?? "", source: lead.ads_check.url, observed_at: lead.ads_check.checked_at, confidence: "high" });
  } else if (profile?.tags?.ads_status === "TAG_PRESENT") {
    add({ kind: "ads", code: "ads:tag", level: "VERIFIED", text: "Google Ads tag je na webe nainštalovaný (neznamená, že reklama beží)", excerpt: profile.tags.google_ads ?? "", source: webUrl, observed_at: webAt, confidence: "high" });
  }
  for (const p of profile?.commercial_problems ?? []) {
    if (p.code !== "SOCIAL_WEB_GAP" && p.code !== "SOCIAL_FIRST_BUSINESS") continue;
    add({ kind: "social", code: `social:${p.code}`, level: "OBSERVED", text: p.label, excerpt: p.evidence.join("; ").slice(0, 200), source: null, observed_at: profile?.last_verified?.social ?? null, confidence: "medium" });
  }
  return ev;
}

/* ─────────── Business Pain ─────────── */

export const PAIN_CODES = [
  "MANUAL_BOOKING",
  "MANUAL_FIRST_INTAKE",
  "REPEATED_QUESTIONS",
  "PHOTOS_VIA_MESSENGER",
  "GENERIC_INQUIRY",
  "MANUAL_QUOTE_PREP",
  "NO_JOB_STATUS",
  "SOCIAL_WEB_GAP",
  "MANUAL_MEASUREMENT_COORDINATION",
  "NO_AUTOMATED_REMINDERS",
  "WEAK_MOBILE_INTAKE",
  "ADS_TO_WEAK_PAGE",
] as const;
export type PainCode = (typeof PAIN_CODES)[number];

/** Pain je ručná práca alebo strata pohodlia zákazníka, nie „web je škaredý“. */
export const PAIN_LABEL: Record<PainCode, string> = {
  MANUAL_BOOKING: "Zákazník musí volať, aby dostal termín",
  MANUAL_FIRST_INTAKE: "Prvý dopyt firma vybavuje ručne (telefonát alebo mail)",
  REPEATED_QUESTIONS: "Pri každom dopyte treba ručne zisťovať rovnaké údaje",
  PHOTOS_VIA_MESSENGER: "Fotky od zákazníka chodia zvlášť (správou alebo mailom)",
  GENERIC_INQUIRY: "Dopyt prichádza bez údajov potrebných na ponuku",
  MANUAL_QUOTE_PREP: "Ponuku firma pripravuje ručne pre každý dopyt",
  NO_JOB_STATUS: "Zákazník nevidí stav zákazky a pýta sa telefonicky",
  SOCIAL_WEB_GAP: "Realizácie sú hlavne na sociálnych sieťach, nie na webe",
  MANUAL_MEASUREMENT_COORDINATION: "Zameranie alebo obhliadka sa koordinuje ručne",
  NO_AUTOMATED_REMINDERS: "Termíny sa nepripomínajú automaticky",
  WEAK_MOBILE_INTAKE: "Formulár na dopyt sa na mobile ťažko vypĺňa",
  ADS_TO_WEAK_PAGE: "Riziko: návštevnosť z reklamy končí na stránke bez jasného dopytu",
};

/** Painy, ktoré merajú ručný proces (PROCESS PAIN). Ostatné sú technické alebo marketingové. */
export const PROCESS_PAINS: PainCode[] = [
  "MANUAL_BOOKING", "MANUAL_FIRST_INTAKE", "REPEATED_QUESTIONS", "PHOTOS_VIA_MESSENGER", "GENERIC_INQUIRY", "MANUAL_QUOTE_PREP",
  "NO_JOB_STATUS", "MANUAL_MEASUREMENT_COORDINATION", "NO_AUTOMATED_REMINDERS",
];

export type Pain = {
  code: PainCode;
  label: string;
  level: EvidenceLevel;
  evidence_ids: string[];
  /** strong = aspoň jeden priamy textový/štrukturálny dôkaz; weak = iba neprítomnosť. */
  strength: "strong" | "weak";
  /** Odvodené, nie videné. Treba potvrdiť v hovore. */
  hypothesis: boolean;
};

export const PAIN_MODULES: Record<PainCode, ModuleId[]> = {
  MANUAL_BOOKING: ["booking"],
  NO_AUTOMATED_REMINDERS: ["reminders"],
  MANUAL_FIRST_INTAKE: ["smart_inquiry"],
  REPEATED_QUESTIONS: ["smart_inquiry"],
  GENERIC_INQUIRY: ["smart_inquiry"],
  PHOTOS_VIA_MESSENGER: ["files_photos", "smart_inquiry"],
  MANUAL_QUOTE_PREP: ["offers", "smart_inquiry"],
  NO_JOB_STATUS: ["job_status", "pipeline"],
  MANUAL_MEASUREMENT_COORDINATION: ["pipeline"],
  SOCIAL_WEB_GAP: ["realizations"],
  WEAK_MOBILE_INTAKE: ["smart_inquiry", "booking"],
  ADS_TO_WEAK_PAGE: ["smart_inquiry", "booking"],
};

export function derivePains(evidence: OppEvidence[], template: SegmentTemplate | null): Pain[] {
  const by = (code: string) => evidence.find((e) => e.code === code) ?? null;
  const relevant = (code: ProcessSignalCode) => !template || template.likely_process_signals.includes(code);
  const sig = (code: ProcessSignalCode) => (relevant(code) ? by(code) : null);
  const usesBooking = !template || template.recommended_modules.includes("booking");
  const pains: Pain[] = [];
  const push = (code: PainCode, items: (OppEvidence | null)[], hypothesis = false) => {
    const ev = items.filter((x): x is OppEvidence => !!x);
    if (!ev.length) return;
    if (template && !template.relevant_pains.includes(code)) return;
    const strong = ev.some((e) => e.kind === "signal" && STRONG.includes(e.code as ProcessSignalCode)) || ev.some((e) => e.kind !== "signal" && e.level === "VERIFIED");
    pains.push({
      code,
      label: PAIN_LABEL[code],
      level: ev.every((e) => e.level === "VERIFIED") && !hypothesis ? "VERIFIED" : "OBSERVED",
      evidence_ids: ev.map((e) => e.id),
      strength: strong ? "strong" : "weak",
      hypothesis,
    });
  };
  const bookingTool = by("BOOKING_TOOL_PRESENT");

  // Termíny: výzva zavolať / „objednávky telefonicky“, podporené tým, že online rezerváciu sme nenašli.
  const bookingText = [sig("CALL_FOR_APPOINTMENT"), sig("PHONE_BOOKING")];
  // Keď online rezerváciu na webe majú, „volajte“ nie je ručný proces, ktorý by sme riešili.
  if (!bookingTool && usesBooking) push("MANUAL_BOOKING", [...bookingText, bookingText.some(Boolean) || template?.default_modules.includes("booking") ? sig("NO_BOOKING_FOUND") : null]);

  push("MANUAL_FIRST_INTAKE", [sig("PHONE_FIRST_CONTACT"), sig("CALL_FOR_PRICE"), sig("NO_FORM_FOUND"), by("web:no_cta")]);
  push("GENERIC_INQUIRY", [sig("GENERIC_CONTACT_FORM"), sig("EMAIL_FOR_ORDER"), sig("GENERIC_CONTACT_FORM") ? sig("PHOTO_UPLOAD_MISSING") : null]);
  // Opakované otázky sú dôsledok všeobecného formulára / ceny po telefóne. Odvodené → hypotéza.
  push("REPEATED_QUESTIONS", [sig("GENERIC_CONTACT_FORM"), sig("CALL_FOR_PRICE")], true);
  const chat = [sig("WHATSAPP_PRIMARY"), sig("MESSENGER_PRIMARY")].filter(Boolean);
  push("PHOTOS_VIA_MESSENGER", [sig("PHOTOS_REQUESTED_SEPARATELY"), ...(chat.length && sig("PHOTO_UPLOAD_MISSING") ? [...chat, sig("PHOTO_UPLOAD_MISSING")] : [])]);
  push("MANUAL_QUOTE_PREP", [sig("MANUAL_QUOTE_SIGNAL"), sig("PDF_PRICE_LIST"), sig("CALL_FOR_PRICE")]);
  push("MANUAL_MEASUREMENT_COORDINATION", [sig("MEASUREMENT_REQUIRED")]);
  push("NO_JOB_STATUS", [sig("NO_CUSTOMER_STATUS_FOUND")], true);
  push("SOCIAL_WEB_GAP", [sig("SOCIAL_REALIZATIONS"), by("social:SOCIAL_WEB_GAP"), by("social:SOCIAL_FIRST_BUSINESS"), by("web:no_portfolio") && (by("social:SOCIAL_WEB_GAP") || sig("SOCIAL_REALIZATIONS")) ? by("web:no_portfolio") : null]);
  const booking = pains.find((p) => p.code === "MANUAL_BOOKING" && p.strength === "strong");
  if (booking) push("NO_AUTOMATED_REMINDERS", booking.evidence_ids.map((id) => evidence.find((e) => e.id === id) ?? null), true);
  // Slabý príjem dopytu na mobile = formulár na dopyt je na webe, ale web nie je prispôsobený mobilu.
  // Chýbajúci tel: odkaz alebo https samy nie sú pain procesu, sú to medzery webu (deriveWebGaps).
  const mobileBroken = [by("web:no_viewport"), by("web:frames")].filter(Boolean);
  if (mobileBroken.length && sig("GENERIC_CONTACT_FORM")) push("WEAK_MOBILE_INTAKE", [...mobileBroken, sig("GENERIC_CONTACT_FORM")]);
  const ads = by("ads:active") ?? by("ads:tag");
  if (ads && (by("NO_FORM_FOUND") || by("web:no_cta") || webHasVerifiedIssue(evidence))) push("ADS_TO_WEAK_PAGE", [ads, by("NO_FORM_FOUND") ?? by("web:no_cta")]);
  return pains;
}

const webHasVerifiedIssue = (ev: OppEvidence[]) => ev.some((e) => e.kind === "web" && e.level === "VERIFIED");

/* ─────────── Medzery webu (nie business pain) ─────────── */

/**
 * Objektívne problémy webu oddelené od painov procesu. Hovoria, čo je zle na webe,
 * nie ako firma vybavuje zákazníka. Z nich sa nikdy neodvodzuje ručný proces.
 */
export const WEB_GAP_CODES = ["MOBILE_CONTACT_FRICTION", "TRUST_SECURITY_GAP", "BROKEN_WEBSITE", "NO_WEBSITE_FOUND", "CONTENT_GAP"] as const;
export type WebGapCode = (typeof WEB_GAP_CODES)[number];
export const WEB_GAP_LABEL: Record<WebGapCode, string> = {
  MOBILE_CONTACT_FRICTION: "Kontakt z mobilu je ťažší (telefón sa nedá ťuknúť alebo web nie je pre mobil)",
  TRUST_SECURITY_GAP: "Web nie je zabezpečený (prehliadač píše „Nezabezpečené“)",
  BROKEN_WEBSITE: "Web nefunguje alebo ukazuje chybu",
  NO_WEBSITE_FOUND: "Vlastný web sme nenašli",
  CONTENT_GAP: "Na webe chýba obsah (realizácie, telefón alebo text)",
};
const WEB_GAP_SOURCES: Record<WebGapCode, string[]> = {
  MOBILE_CONTACT_FRICTION: ["web:no_tel_link", "web:no_viewport", "web:frames"],
  TRUST_SECURITY_GAP: ["web:no_https", "web:bad_cert"],
  BROKEN_WEBSITE: ["web:broken", "web:db_error", "web:php_error", "web:construction"],
  NO_WEBSITE_FOUND: ["web:not_found"],
  CONTENT_GAP: ["web:no_portfolio", "web:phone_missing", "web:empty"],
};
export type WebGap = { code: WebGapCode; label: string; level: EvidenceLevel; evidence_ids: string[] };

export function deriveWebGaps(evidence: OppEvidence[]): WebGap[] {
  const out: WebGap[] = [];
  for (const code of WEB_GAP_CODES) {
    const ev = evidence.filter((e) => WEB_GAP_SOURCES[code].includes(e.code));
    if (!ev.length) continue;
    // jeden dôkaz = jeho presný text (napr. „Telefón sa na mobile nedá ťuknúť“), inak všeobecný popis
    out.push({ code, label: ev.length === 1 ? ev[0].text : WEB_GAP_LABEL[code], level: ev.every((e) => e.level === "VERIFIED") ? "VERIFIED" : "OBSERVED", evidence_ids: ev.map((e) => e.id) });
  }
  return out;
}

/* ─────────── Process Reconstruction ─────────── */

export type ProcessStep = { actor: "customer" | "company"; text: string; evidence_ids: string[] };
export type ProcessModel = { level: EvidenceLevel; steps: ProcessStep[]; evidence_ids: string[]; note: string };

/** Pravdepodobný postup podľa webu. Krok vznikne iba z evidence. Nikdy VERIFIED bez potvrdenia firmou. */
export function reconstructProcess(evidence: OppEvidence[]): ProcessModel {
  const ids = (...codes: string[]) => evidence.filter((e) => codes.includes(e.code)).map((e) => e.id);
  const steps: ProcessStep[] = [];
  const step = (actor: ProcessStep["actor"], text: string, e: string[]) => {
    if (e.length) steps.push({ actor, text, evidence_ids: e });
  };
  step("customer", "zavolá", ids("CALL_FOR_APPOINTMENT", "PHONE_BOOKING", "PHONE_FIRST_CONTACT", "CALL_FOR_PRICE"));
  step("customer", "napíše cez WhatsApp / Messenger", ids("WHATSAPP_PRIMARY", "MESSENGER_PRIMARY"));
  step("customer", "vyplní všeobecný formulár", ids("GENERIC_CONTACT_FORM"));
  step("customer", "pošle e-mail", ids("EMAIL_FOR_ORDER"));
  step("customer", "pošle fotky zvlášť", ids("PHOTOS_REQUESTED_SEPARATELY"));
  step("company", "dohodne termín telefonicky", ids("PHONE_BOOKING", "CALL_FOR_APPOINTMENT"));
  step("company", "príde zamerať / na obhliadku", ids("MEASUREMENT_REQUIRED"));
  step("company", "pripraví ponuku ručne", ids("MANUAL_QUOTE_SIGNAL", "CALL_FOR_PRICE"));
  const all = [...new Set(steps.flatMap((s) => s.evidence_ids))];
  return steps.length
    ? { level: "OBSERVED", steps, evidence_ids: all, note: "Pravdepodobný postup podľa webu. Firma ho nepotvrdila." }
    : { level: "UNKNOWN", steps: [], evidence_ids: [], note: "Z webu sa postup zákazníka nedá poskladať." };
}

/** Pomocník pre testy a UI: segment podľa kategórie. */
export const templateFor = segmentFor;
