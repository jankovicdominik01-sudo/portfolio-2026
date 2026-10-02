/**
 * Opportunity Engine v2: „Čo táto firma robí ručne, čo jej web alebo jednoduchý systém vie zobrať z rúk?“
 *
 *   COMPANY → EVIDENCE → PROCESS RECONSTRUCTION → BUSINESS PAIN → OPPORTUNITY
 *           → RECOMMENDED SYSTEM → MONEY LEAK → (DEMO) → ROMAN
 *
 * Nadstavba nad Lead Radarom (profil, gate, score ostávajú). Všetko sú čisté pravidlá:
 * každá dimenzia má úroveň, dôvod a evidence id. AI tu nerozhoduje nič; smie iba
 * preformulovať WHY THIS LEAD. Žiadne vymyslené čísla, žiadna strata v eurách.
 *
 * Verzie pravidiel sú uložené pri každom výsledku (versions), aby bolo vidno,
 * podľa čoho bol starý lead vyhodnotený.
 */
import { categoryOf, type Lead, type RadarProfile } from "./types";
import {
  collectEvidence,
  deriveWebGaps,
  derivePains,
  PAIN_MODULES,
  PROCESS_PAINS,
  PROCESS_SIGNALS_VERSION,
  reconstructProcess,
  type EvidenceLevel,
  type OppEvidence,
  type Pain,
  type PainCode,
  type ProcessModel,
  type WebGap,
} from "./process";
import { MODULES, relevantServices, SEGMENT_TEMPLATE_VERSION, segmentFor, type ModuleId, type SegmentId, type SegmentTemplate } from "./segments";
import { buildMoneyLeak, MONEY_LEAK_VERSION, type LeakLine, type MoneyLeakCard } from "./money-leak";

export { EVIDENCE_LEVELS, type EvidenceLevel } from "./process";
export type { LeakLine } from "./money-leak";

export const OPPORTUNITY_ENGINE_VERSION = "2.0";

export const DIMENSIONS = ["VISUAL_GAP", "PROCESS_PAIN", "AUTOMATION_FIT", "BUSINESS_ACTIVITY", "AD_SPEND_SIGNAL", "EVIDENCE_QUALITY", "DEMO_POTENTIAL"] as const;
export type Dimension = (typeof DIMENSIONS)[number];
export type Strength = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
const RANK: Record<Strength, number> = { UNKNOWN: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };
export const atLeast = (s: Strength, min: Strength) => RANK[s] >= RANK[min];

export type DimensionValue = { level: Strength; reason: string; reasons: string[]; evidence_ids: string[] };

export type AdsStatus = "ACTIVE" | "TAG_PRESENT" | "NOT_FOUND" | "UNKNOWN";

export type RecommendedSystem = {
  /** Šablóna dema v1 (service_booking | project_pipeline | appointment), kontrakt s djweby.sk. */
  id: string;
  segment: SegmentId;
  label: string;
  /** = primary_modules (spätná kompatibilita). */
  modules: ModuleId[];
  primary_modules: ModuleId[];
  optional_modules: ModuleId[];
  reasoning: string[];
  evidence_ids: string[];
  /** evidence = moduly vyplynuli z painov; segment = iba hypotéza segmentu, potvrdiť v hovore. */
  basis: "evidence" | "segment";
};

export type OpportunityRun = {
  lead_id: string | null;
  version: string;
  started_at: string;
  finished_at: string;
  signals_found: number;
  dimensions: Record<Dimension, Strength>;
  recommended_modules: ModuleId[];
  demo_generated: boolean;
  errors: string[];
};

/**
 * Prečo volať. Dva odlišné dôvody, ktoré sa nesmú zamieňať:
 *  PROCESS     videli sme ručný proces (pain z textu / štruktúry webu)
 *  WEB_SYSTEM  objektívna medzera webu + aktívna firma + segment; ručný proces je UNKNOWN
 *  NONE        dôvod nemáme
 */
export type CallReason = {
  type: "PROCESS" | "WEB_SYSTEM" | "NONE";
  label: string;
  /** Čo vieme (s dôkazom). */
  known: string[];
  /** Čo ešte nevieme a treba zistiť v hovore. */
  unknown: string[];
};

export const CALL_REASON_LABEL: Record<CallReason["type"], string> = {
  PROCESS: "PROCESS OPPORTUNITY: videný ručný proces",
  WEB_SYSTEM: "WEB / SYSTEM OPPORTUNITY: overená medzera webu, ručný proces zatiaľ UNKNOWN",
  NONE: "Dôvod hovoru nemáme",
};

export type Opportunity = {
  version: 2;
  versions: { opportunity_engine: string; segment_template: string; money_leak: string; process_signals: string };
  status: "READY";
  analyzed_at: string;
  segment: SegmentId | null;
  evidence: OppEvidence[];
  process_model: ProcessModel;
  pains: Pain[];
  /** Objektívne medzery webu (nie pain procesu). */
  web_gaps: WebGap[];
  call_reason: CallReason;
  dimensions: Record<Dimension, DimensionValue>;
  ads: { status: AdsStatus; spend: "UNKNOWN"; source: string | null; note: string };
  recommended_system: RecommendedSystem | null;
  why_this_lead: string;
  why_lines: { text: string; evidence_ids: string[] }[];
  money_leak: MoneyLeakCard;
  /** Predpoklady, ktoré Roman v hovore potvrdí alebo vyvráti (Phase 3 learning loop). */
  hypotheses: { code: PainCode; text: string; evidence_ids: string[] }[];
  priority: "TOP" | "NORMAL" | "LOW";
  /** Poradie vo fronte (vyššie = lepšie). Reklama prispeje najviac 1 bodom. */
  rank: number;
  /** Videné signály (kód, text, úryvok, zdroj) pre Call Card a návrhy správ. */
  observed: { key: string; text: string; excerpt: string; source: string; level: EvidenceLevel }[];
  run: OpportunityRun;
};

/** Uložený výsledok, ktorý zlyhal. Lead funguje ďalej, iba bez Opportunity karty. */
export type FailedOpportunity = { version: 2; status: "FAILED"; analyzed_at: string; error: string };
export type AnalyzingOpportunity = { version: 2; status: "ANALYZING"; requested_at: string };

export type OpportunityState = "NOT_ANALYZED" | "ANALYZING" | "READY" | "FAILED";

/** Stav analýzy z uloženého JSON. Staršia verzia (v1) = NOT_ANALYZED, treba prepočítať. */
export function opportunityState(stored: unknown): OpportunityState {
  const s = stored as { version?: number; status?: string } | null | undefined;
  if (!s || s.version !== 2) return "NOT_ANALYZED";
  return s.status === "READY" ? "READY" : s.status === "FAILED" ? "FAILED" : s.status === "ANALYZING" ? "ANALYZING" : "NOT_ANALYZED";
}

export function readyOpportunity(stored: unknown): Opportunity | null {
  return opportunityState(stored) === "READY" ? (stored as Opportunity) : null;
}

/* ─────────── Segment a telefón ─────────── */

/** Systém pre kategóriu podľa segment templatu (bez evidence = hypotéza segmentu). */
export function systemFor(category: string): SegmentTemplate | null {
  return segmentFor(category);
}

/**
 * Segmenty, kde je telefonát majiteľovi lokálnej firmy bežný a prijateľný (remeslá, služby, beauty).
 * Mimo sú segmenty, kde sa rieši skôr písomne alebo cez sprostredkovateľov.
 */
const CALL_UNSUITABLE: readonly string[] = ["reality", "developer", "architekt", "ine"];
export const callSuitable = (category: string) => !CALL_UNSUITABLE.includes(categoryOf(category).id);

/* ─────────── Reklama ─────────── */

export function adsStatus(profile: RadarProfile | null | undefined, check: Lead["ads_check"]): Opportunity["ads"] {
  if (check?.status === "ACTIVE") {
    return { status: "ACTIVE", spend: "UNKNOWN", source: check.url, note: `Reklama nájdená ručne (${check.checked_at.slice(0, 10)}). Spend nevieme bez ich účtu.` };
  }
  const tag = profile?.tags?.ads_status;
  if (tag === "TAG_PRESENT") {
    return { status: "TAG_PRESENT", spend: "UNKNOWN", source: profile?.website?.url ?? null, note: "Google Ads tag je na webe nainštalovaný. Neznamená, že reklama beží." };
  }
  if (tag === "NOT_FOUND" || check?.status === "NOT_FOUND") {
    return { status: "NOT_FOUND", spend: "UNKNOWN", source: check?.url ?? profile?.website?.url ?? null, note: "Reklamu ani tag sme nenašli. Neznamená, že neinzerujú." };
  }
  return { status: "UNKNOWN", spend: "UNKNOWN", source: null, note: "Web sme nevedeli skontrolovať." };
}

/* ─────────── Hlavná funkcia ─────────── */

const dim = (level: Strength, reasons: string[], evidence_ids: string[] = []): DimensionValue => ({
  level,
  reason: reasons[0] ?? "nevieme",
  reasons: reasons.filter(Boolean),
  evidence_ids: [...new Set(evidence_ids)],
});

export function buildOpportunity(
  lead: Pick<Lead, "website_status" | "data_quality" | "ads_check">,
  category: string,
  profile: RadarProfile | null | undefined,
  opts: { nowIso?: string; leadId?: string | null; companyName?: string | null } = {},
): Opportunity {
  const started = opts.nowIso ?? new Date().toISOString();
  const template = segmentFor(category);
  const evidence = collectEvidence(lead, profile);
  const ids = (pred: (e: OppEvidence) => boolean) => evidence.filter(pred).map((e) => e.id);
  const pains = derivePains(evidence, template);
  const webGaps = deriveWebGaps(evidence);
  const process = reconstructProcess(evidence);
  const signals = evidence.filter((e) => e.kind === "signal");
  const dims = {} as Opportunity["dimensions"];

  // PROCESS PAIN: koľko ručného procesu vidno a či ho potvrdzujú viaceré dôkazy
  const proc = pains.filter((p) => PROCESS_PAINS.includes(p.code) && !p.hypothesis);
  const strong = proc.filter((p) => p.strength === "strong");
  const corroborated = strong.filter((p) => p.evidence_ids.length >= 2);
  const painIds = proc.flatMap((p) => p.evidence_ids);
  const bookingTool = evidence.some((e) => e.code === "BOOKING_TOOL_PRESENT");
  if (!signals.length) dims.PROCESS_PAIN = dim("UNKNOWN", ["Procesné signály chýbajú (web sme ešte nečítali alebo sa nedal prečítať)"]);
  else if (corroborated.length || strong.length >= 2) dims.PROCESS_PAIN = dim("HIGH", strong.map((p) => p.label), painIds);
  else if (strong.length || proc.some((p) => p.evidence_ids.some((id) => evidence.find((e) => e.id === id)?.code === "NO_FORM_FOUND")))
    dims.PROCESS_PAIN = dim("MEDIUM", proc.map((p) => p.label), painIds);
  else if (bookingTool && !proc.length) dims.PROCESS_PAIN = dim("LOW", ["Online rezerváciu už majú"], ids((e) => e.code === "BOOKING_TOOL_PRESENT"));
  else dims.PROCESS_PAIN = dim("LOW", proc.length ? [`Iba nepriame signály: ${proc.map((p) => p.label).join(", ")}`] : ["Ručný proces na webe nevidno"], painIds);

  // BUSINESS ACTIVITY: register + web + social (classify.business_status)
  const bs = profile?.business_status?.value;
  const bsEv = profile?.business_status?.evidence ?? [];
  const actIds = ids((e) => e.kind === "activity" || e.kind === "register");
  dims.BUSINESS_ACTIVITY =
    bs === "active" ? dim("HIGH", [`Firma je aktívna (${bsEv.length} ${bsEv.length === 1 ? "zdroj" : "zdroje"})`, ...bsEv], actIds) :
    bs === "likely_active" ? dim("MEDIUM", ["Firma je pravdepodobne aktívna", ...bsEv], actIds) :
    bs === "inactive" ? dim("LOW", ["Firma podľa registra zanikla alebo je v likvidácii", ...bsEv], actIds) :
    dim("UNKNOWN", bsEv.length ? bsEv : ["Aktivitu firmy sme nevedeli overiť"], actIds);

  // EVIDENCE QUALITY: GOLD / SILVER / RESEARCH gate z radaru
  const q = lead.data_quality ?? profile?.data_quality ?? null;
  dims.EVIDENCE_QUALITY =
    q === "gold" ? dim("HIGH", ["GOLD: identita, kontakt aj web overené"], ids((e) => e.kind === "register")) :
    q === "silver" ? dim("MEDIUM", ["SILVER: jadro overené, niečo chýba", ...(profile?.data_quality_why ?? [])]) :
    q === "research" ? dim("LOW", ["RESEARCH: dáta treba doplniť", ...(profile?.data_quality_why ?? [])]) :
    dim("UNKNOWN", ["Kvalita dát nie je určená"]);

  // VISUAL GAP: stav webu
  const ws = lead.website_status;
  const webIds = ids((e) => e.kind === "web");
  dims.VISUAL_GAP =
    ws === "broken" || ws === "no_website" ? dim("HIGH", [ws === "broken" ? "Web je nefunkčný" : "Vlastný web sme nenašli"], webIds) :
    ws === "weak" ? dim("MEDIUM", webIds.length ? evidence.filter((e) => e.kind === "web").slice(0, 3).map((e) => e.text) : ["Web je podľa kontroly radaru slabý"], webIds) :
    ws === "working" ? dim("LOW", ["Web funguje"], webIds) :
    dim("UNKNOWN", ["Stav webu je neistý"]);

  // AD SPEND SIGNAL: ACTIVE iba s ručným dôkazom. Sám nikdy nespraví TOP.
  const ads = adsStatus(profile, lead.ads_check);
  const adIds = ids((e) => e.kind === "ads");
  dims.AD_SPEND_SIGNAL =
    ads.status === "ACTIVE" ? dim("HIGH", [ads.note], adIds) :
    ads.status === "TAG_PRESENT" ? dim("MEDIUM", [ads.note], adIds) :
    ads.status === "NOT_FOUND" ? dim("LOW", [ads.note]) :
    dim("UNKNOWN", [ads.note]);

  // RECOMMENDED SYSTEM: moduly z painov ∩ moduly segmentu; bez painov iba hypotéza segmentu
  const system = recommend(template, pains);

  // AUTOMATION FIT: máme pre segment systém + je čo automatizovať
  dims.AUTOMATION_FIT = !template
    ? dim("LOW", ["Pre tento segment zatiaľ nemáme šablónu systému"])
    : atLeast(dims.PROCESS_PAIN.level, "MEDIUM") && system?.basis === "evidence"
      ? dim("HIGH", [`${system.label} rieši presne tento ručný krok`], system.evidence_ids)
      : dim("MEDIUM", [`Segment sedí na ${system?.label ?? template.label}, ručný proces zatiaľ nevidno`], system?.evidence_ids ?? []);

  // DEMO POTENTIAL: máme meno, služby, jasný pain, šablónu a dostatočnú identitu
  const name = profile?.brand_names?.[0] ?? opts.companyName ?? null;
  const services = relevantServices(category, profile?.services);
  const clearPain = proc.some((p) => p.strength === "strong") || atLeast(dims.PROCESS_PAIN.level, "MEDIUM");
  const identityOk = atLeast(dims.EVIDENCE_QUALITY.level, "MEDIUM");
  const missing = [
    !template && "šablóna segmentu",
    !name && "názov firmy",
    !services.length && "služby firmy",
    !clearPain && "jasný ručný proces",
    !identityOk && "overená identita",
  ].filter((x): x is string => !!x);
  dims.DEMO_POTENTIAL = !template || !name || !identityOk
    ? dim("LOW", [`Chýba: ${missing.join(", ")}`])
    : !missing.length
      ? dim("HIGH", [`Demo sa dá naplniť ich službami (${services.slice(0, 3).join(", ")}) a ukázať na ich probléme`], painIds)
      : dim("MEDIUM", [`Demo máme, chýba: ${missing.join(", ")}`], painIds);

  const priority: Opportunity["priority"] =
    dims.PROCESS_PAIN.level === "HIGH" && atLeast(dims.BUSINESS_ACTIVITY.level, "MEDIUM") && atLeast(dims.EVIDENCE_QUALITY.level, "MEDIUM")
      ? "TOP"
      : dims.BUSINESS_ACTIVITY.level === "LOW" || dims.EVIDENCE_QUALITY.level === "LOW" ? "LOW" : "NORMAL";
  const R = (d: Dimension) => RANK[dims[d].level];
  const rank = R("PROCESS_PAIN") * 3 + R("AUTOMATION_FIT") * 2 + R("BUSINESS_ACTIVITY") * 2 + R("EVIDENCE_QUALITY") * 2 + R("VISUAL_GAP") + R("DEMO_POTENTIAL") + Math.min(1, R("AD_SPEND_SIGNAL"));

  const reason = callReason({ proc, pains, webGaps, dims, system });
  // B (web / systém) je v poradí pod A (proces), ak je inak podobne
  const rankWithReason = rank + (reason.type === "PROCESS" ? 3 : 0);
  const why = whyLines({ template, pains, dims, system, evidence, webGaps });
  const lines = leakLines(ads, evidence, ws, profile);
  const moneyLeak = buildMoneyLeak({
    template,
    pains,
    process,
    automationFit: dims.AUTOMATION_FIT.level,
    modules: system?.primary_modules ?? [],
    lines,
  });
  const finished = opts.nowIso ?? new Date().toISOString();
  return {
    version: 2,
    versions: { opportunity_engine: OPPORTUNITY_ENGINE_VERSION, segment_template: SEGMENT_TEMPLATE_VERSION, money_leak: MONEY_LEAK_VERSION, process_signals: PROCESS_SIGNALS_VERSION },
    status: "READY",
    analyzed_at: finished,
    segment: template?.segment ?? null,
    evidence,
    process_model: process,
    pains,
    web_gaps: webGaps,
    call_reason: reason,
    dimensions: dims,
    ads,
    recommended_system: system,
    why_this_lead: why.length ? why.map((w) => w.text).join(" ") : "Silný dôvod sme nenašli.",
    why_lines: why,
    money_leak: moneyLeak,
    hypotheses: pains.map((p) => ({ code: p.code, text: p.label, evidence_ids: p.evidence_ids })),
    priority,
    rank: rankWithReason,
    observed: signals
      .filter((s) => s.level === "OBSERVED" || s.level === "VERIFIED")
      .map((s) => ({ key: s.code, text: s.text, excerpt: s.excerpt, source: s.source ?? "", level: s.level })),
    run: {
      lead_id: opts.leadId ?? null,
      version: OPPORTUNITY_ENGINE_VERSION,
      started_at: started,
      finished_at: finished,
      signals_found: signals.length,
      dimensions: Object.fromEntries(DIMENSIONS.map((d) => [d, dims[d].level])) as Record<Dimension, Strength>,
      recommended_modules: system?.primary_modules ?? [],
      demo_generated: false,
      errors: [],
    },
  };
}

/* ─────────── Dôvod hovoru ─────────── */

/** Painy, ktoré nie sú ručný proces (marketing / web), hovoria o dôvode B, nie A. */
const NON_PROCESS_PAINS: PainCode[] = ["SOCIAL_WEB_GAP", "ADS_TO_WEAK_PAGE", "WEAK_MOBILE_INTAKE"];

export function callReason(o: {
  proc: Pain[];
  pains: Pain[];
  webGaps: WebGap[];
  dims: Opportunity["dimensions"];
  system: RecommendedSystem | null;
}): CallReason {
  const sys = o.system ? `${o.system.label}${o.system.basis === "segment" ? ", hypotéza segmentu" : ""}` : null;
  if (o.proc.length) {
    return {
      type: "PROCESS",
      label: CALL_REASON_LABEL.PROCESS,
      known: o.proc.map((p) => `${p.level}: ${p.label}`),
      unknown: ["Koľko dopytov týždenne: UNKNOWN", "Či ich ručný proces naozaj zdržiava: potvrdiť v hovore"],
    };
  }
  const gaps = o.webGaps.filter((g) => g.level === "VERIFIED" || g.code === "NO_WEBSITE_FOUND");
  const other = o.pains.filter((p) => !p.hypothesis && NON_PROCESS_PAINS.includes(p.code));
  if (gaps.length || other.length || atLeast(o.dims.VISUAL_GAP.level, "MEDIUM")) {
    return {
      type: "WEB_SYSTEM",
      label: CALL_REASON_LABEL.WEB_SYSTEM,
      known: [
        ...gaps.map((g) => `${g.level}: ${g.label}`),
        ...other.map((p) => `${p.level}: ${p.label}`),
        ...(atLeast(o.dims.BUSINESS_ACTIVITY.level, "MEDIUM") ? [`Aktivita firmy: ${o.dims.BUSINESS_ACTIVITY.level}`] : []),
        ...(sys ? [`Fit na systém: ${o.dims.AUTOMATION_FIT.level} (${sys})`] : []),
      ],
      unknown: ["Ručný proces: UNKNOWN. Zisti, ako k nim dnes chodia dopyty a čo musia od zákazníka zisťovať.", "Koľko dopytov týždenne: UNKNOWN"],
    };
  }
  return { type: "NONE", label: CALL_REASON_LABEL.NONE, known: [], unknown: ["Ručný proces: UNKNOWN", "Overená medzera webu: žiadna"] };
}

/* ─────────── Recommended System ─────────── */

export function recommend(template: SegmentTemplate | null, pains: Pain[]): RecommendedSystem | null {
  if (!template) return null;
  const allowed = template.recommended_modules;
  const order = (ms: ModuleId[]) => allowed.filter((m) => ms.includes(m));
  const primary: ModuleId[] = [];
  const reasoning: string[] = [];
  const evIds: string[] = [];
  for (const p of pains.filter((x) => !x.hypothesis)) {
    const m = PAIN_MODULES[p.code].find((x) => allowed.includes(x));
    if (!m) continue;
    if (!primary.includes(m)) primary.push(m);
    reasoning.push(`${p.label} → ${MODULES[m].label} (${p.evidence_ids.join(", ")})`);
    evIds.push(...p.evidence_ids);
  }
  const hypo = pains.filter((x) => x.hypothesis).flatMap((p) => PAIN_MODULES[p.code].filter((m) => allowed.includes(m)));
  const basis: RecommendedSystem["basis"] = primary.length ? "evidence" : "segment";
  const prim = order(primary.length ? primary : template.default_modules).slice(0, 3);
  if (!primary.length) reasoning.push(`Šablóna segmentu ${template.label}: konkrétny ručný krok sme na webe nevideli, potvrdiť v hovore.`);
  const optional = order([...hypo, ...allowed]).filter((m) => !prim.includes(m) && m !== "notifications").slice(0, 3);
  return {
    id: template.demo_template,
    segment: template.segment,
    label: prim.map((m) => MODULES[m].label).join(" + "),
    modules: prim,
    primary_modules: prim,
    optional_modules: optional,
    reasoning,
    evidence_ids: [...new Set(evIds)],
    basis,
  };
}

/* ─────────── WHY THIS LEAD ─────────── */

/** Jedna veta na pain, „nenašli sme“ namiesto „nemajú“. */
const PAIN_SENTENCE: Partial<Record<PainCode, string>> = {
  MANUAL_BOOKING: "Na termín zákazníka vedú hlavne k telefonátu.",
  GENERIC_INQUIRY: "Dopyt sa cez web nedá kvalifikovať, formulár zbiera iba všeobecné údaje.",
  MANUAL_FIRST_INTAKE: "Prvý kontakt ide cez telefón alebo mail, formulár na dopyt sme nenašli.",
  PHOTOS_VIA_MESSENGER: "Fotky od zákazníka chcú dostať zvlášť, mimo dopytu.",
  MANUAL_QUOTE_PREP: "Ponuku pripravujú ručne pre každý dopyt.",
  MANUAL_MEASUREMENT_COORDINATION: "Pred ponukou robia zameranie alebo obhliadku.",
  SOCIAL_WEB_GAP: "Realizácie ukazujú hlavne na sociálnych sieťach, nie na webe.",
  WEAK_MOBILE_INTAKE: "Na mobile sa im zákazník ozve ťažšie (overené na webe).",
  ADS_TO_WEAK_PAGE: "Na webe je reklamný tag, ale stránka nemá jasný dopyt (riziko, nie strata).",
};
const PAIN_ORDER: PainCode[] = [
  "MANUAL_BOOKING", "GENERIC_INQUIRY", "PHOTOS_VIA_MESSENGER", "MANUAL_MEASUREMENT_COORDINATION", "MANUAL_QUOTE_PREP",
  "MANUAL_FIRST_INTAKE", "SOCIAL_WEB_GAP", "WEAK_MOBILE_INTAKE", "ADS_TO_WEAK_PAGE",
];

/**
 * WHY THIS LEAD: 1 až 3 vety, deterministicky z dimenzií a evidence. AI ju smie iba preformulovať.
 * Nikdy „určite stráca“, nikdy suma.
 */
export function whyLines(o: {
  template: SegmentTemplate | null;
  pains: Pain[];
  dims: Opportunity["dimensions"];
  system: RecommendedSystem | null;
  evidence: OppEvidence[];
  webGaps?: WebGap[];
}): { text: string; evidence_ids: string[] }[] {
  const out: { text: string; evidence_ids: string[] }[] = [];
  const seg = o.template ? o.template.label.toLowerCase() : null;
  const act = o.dims.BUSINESS_ACTIVITY;
  if (act.level === "HIGH") out.push({ text: seg ? `Aktívna firma (${seg}).` : "Aktívna firma.", evidence_ids: act.evidence_ids });
  else if (act.level === "MEDIUM") out.push({ text: seg ? `Pravdepodobne aktívna firma (${seg}).` : "Pravdepodobne aktívna firma.", evidence_ids: act.evidence_ids });

  const seen = PAIN_ORDER.map((c) => o.pains.find((p) => p.code === c && !p.hypothesis)).filter((p): p is Pain => !!p);
  const strong = seen.filter((p) => p.strength === "strong");
  const top = (strong.length ? strong : seen).slice(0, 2);
  // Dve vety o paine iba vtedy, keď prvá nie je o aktivite (max. 3 vety spolu).
  for (const p of top.slice(0, out.length ? 1 : 2)) out.push({ text: PAIN_SENTENCE[p.code] ?? `${p.label}.`, evidence_ids: p.evidence_ids });
  const gaps = (o.webGaps ?? []).filter((g) => g.code !== "CONTENT_GAP");
  if (!top.length && gaps.length) {
    const list = gaps.slice(0, 2).map((g) => g.label.replace(/ \(.*\)$/, "").toLowerCase());
    out.push({ text: `Web má overené medzery: ${list.join(", ")}.`, evidence_ids: gaps.flatMap((g) => g.evidence_ids) });
  } else if (!top.length && atLeast(o.dims.VISUAL_GAP.level, "MEDIUM")) {
    const v = o.dims.VISUAL_GAP;
    out.push({ text: `${v.reason.replace(/[.\s]+$/, "")}.`, evidence_ids: v.evidence_ids });
  }
  const s = o.system;
  if (s && top.length) {
    const text =
      s.primary_modules[0] === "smart_inquiry" && o.template
        ? `Príležitosť nie je iba nový web: Smart Inquiry by zbieral ${o.template.inquiry_phrase} ešte pred telefonátom${s.basis === "segment" ? " (hypotéza, potvrdiť v hovore)" : ""}.`
        : `Príležitosť: ${s.label}${s.basis === "segment" ? " (hypotéza, potvrdiť v hovore)" : ""}.`;
    out.push({ text, evidence_ids: s.evidence_ids });
  } else if (s && (gaps.length || atLeast(o.dims.VISUAL_GAP.level, "MEDIUM"))) {
    // Bez videného ručného procesu netvrdíme pain: systém je iba hypotéza segmentu.
    out.push({ text: `Ručný proces zatiaľ nepoznáme. ${s.label} je hypotéza pre segment, over ju v hovore.`, evidence_ids: s.evidence_ids });
  }
  if (!top.length && !gaps.length && !atLeast(o.dims.VISUAL_GAP.level, "MEDIUM")) return [];
  return out.slice(0, 3);
}

function leakLines(ads: Opportunity["ads"], evidence: OppEvidence[], ws: Lead["website_status"], profile: RadarProfile | null | undefined): LeakLine[] {
  const web = profile?.website?.url ?? null;
  const lines: LeakLine[] = [
    { area: "ADS", label: "Google Ads", value: ads.status.replace("_", " "), level: ads.status === "ACTIVE" ? "VERIFIED" : ads.status === "UNKNOWN" ? "UNKNOWN" : "OBSERVED", source: ads.source },
    { area: "ADS", label: "Spend", value: "UNKNOWN", level: "UNKNOWN", source: null },
  ];
  if (ws) lines.push({ area: "WEBSITE", label: "Stav webu", value: ws, level: ws === "uncertain" ? "UNKNOWN" : "OBSERVED", source: web });
  for (const s of evidence.filter((e) => e.kind === "signal")) lines.push({ area: "PROCESS", label: s.text, value: s.excerpt, level: s.level, source: s.source });
  const noForm = evidence.some((e) => e.code === "NO_FORM_FOUND");
  if ((ads.status === "ACTIVE" || ads.status === "TAG_PRESENT") && noForm) {
    lines.push({ area: "ADS", label: "Riziko: návštevnosť z reklamy môže končiť na stránke bez formulára", value: "riziko, nie strata", level: "OBSERVED", source: web });
  }
  return lines;
}

/* ─────────── Beh analýzy (stav + observability) ─────────── */

/**
 * Bezpečný beh: chyba neprepadne do UI ani do routingu, uloží sa ako FAILED.
 * Výpočet je čistá funkcia nad uloženým profilom (lacný). Drahá časť (čítanie webu)
 * beží v rannej rutine (radar / recheck), nie v requeste.
 */
export function analyzeOpportunity(
  lead: Pick<Lead, "id" | "website_status" | "data_quality" | "ads_check">,
  company: { name: string; category: string; profile?: RadarProfile | null },
  nowIso = new Date().toISOString(),
): Opportunity | FailedOpportunity {
  try {
    return buildOpportunity(lead, company.category, company.profile, { nowIso, leadId: lead.id, companyName: company.name });
  } catch (e) {
    return { version: 2, status: "FAILED", analyzed_at: nowIso, error: e instanceof Error ? e.message.slice(0, 300) : "chyba" };
  }
}

/** Riadok do logu (Vercel). Iba metadáta behu, nikdy kontakty, heslá ani kľúče. */
export function opportunityLog(leadId: string, o: Opportunity | FailedOpportunity) {
  if (o.status === "FAILED") return { event: "opportunity_run", lead_id: leadId, version: OPPORTUNITY_ENGINE_VERSION, finished_at: o.analyzed_at, errors: [o.error] };
  return { event: "opportunity_run", ...o.run, lead_id: leadId, versions: o.versions, priority: o.priority };
}
