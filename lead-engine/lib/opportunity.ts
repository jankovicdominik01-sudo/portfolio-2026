/**
 * Opportunity Engine: „Čo táto firma dnes robí ručne, čo jej webový systém môže zobrať z rúk?“
 *
 * Nadstavba nad Lead Radarom (profil, evidence, gate, score ostávajú). Všetko sú čisté
 * pravidlá: každá dimenzia má úroveň a dôvody, ktoré sa dajú ukázať človeku. Žiadne AI
 * rozhodovanie, žiadne vymyslené čísla, žiadna strata v eurách.
 *
 * Úrovne dôkazu:
 *   VERIFIED  overené so zdrojom a dátumom
 *   OBSERVED  vidno (úryvok z webu), ale bez finančnej hodnoty
 *   ESTIMATE  odhad s vypísanými predpokladmi
 *   UNKNOWN   nevieme; nikdy z toho nerobíme tvrdenie
 */
import { categoryOf, type CategoryId, type Lead, type RadarProfile } from "./types";

export const EVIDENCE_LEVELS = ["VERIFIED", "OBSERVED", "ESTIMATE", "UNKNOWN"] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

export const DIMENSIONS = ["PROCESS_PAIN", "BUSINESS_ACTIVITY", "EVIDENCE_QUALITY", "AUTOMATION_FIT", "VISUAL_GAP", "AD_SPEND_SIGNAL", "DEMO_POTENTIAL"] as const;
export type Dimension = (typeof DIMENSIONS)[number];
export type Strength = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
const RANK: Record<Strength, number> = { UNKNOWN: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };
export const atLeast = (s: Strength, min: Strength) => RANK[s] >= RANK[min];

export type AdsStatus = "ACTIVE" | "TAG_PRESENT" | "NOT_FOUND" | "UNKNOWN";

/** Jeden riadok Money Leak karty. `value` je text, nikdy suma v eurách. */
export type LeakLine = { area: "ADS" | "WEBSITE" | "PROCESS"; label: string; value: string; level: EvidenceLevel; source: string | null };

export type RecommendedSystem = { id: string; label: string; modules: string[] };

export type Opportunity = {
  version: 1;
  dimensions: Record<Dimension, { level: Strength; reasons: string[] }>;
  ads: { status: AdsStatus; spend: "UNKNOWN"; source: string | null; note: string };
  recommended_system: RecommendedSystem | null;
  why_this_lead: string;
  money_leak: LeakLine[];
  priority: "TOP" | "NORMAL" | "LOW";
  /** Úryvky, z ktorých pravidlá vychádzali (pre Call Card a approval inbox). */
  observed: { key: string; text: string; excerpt: string; source: string }[];
};

/* ─────────── Systémy podľa segmentu (šablóny Demo Engine majú rovnaké id) ─────────── */

const SYSTEMS: Record<string, RecommendedSystem> = {
  service_booking: { id: "service_booking", label: "Smart Intake + rezervácia termínu", modules: ["smart_inquiry", "booking", "job_status", "notifications"] },
  project_pipeline: { id: "project_pipeline", label: "Smart Inquiry + pipeline zákaziek + realizácie", modules: ["smart_inquiry", "pipeline", "gallery", "notifications"] },
  appointment: { id: "appointment", label: "Online rezervácia + pripomienky", modules: ["booking", "reminders", "notifications"] },
  inquiry: { id: "inquiry", label: "Smart Inquiry + prehľad dopytov", modules: ["smart_inquiry", "notifications"] },
};

const SEGMENT_SYSTEM: Partial<Record<CategoryId, keyof typeof SYSTEMS>> = {
  autoservis: "service_booking",
  pneuservis: "service_booking",
  detailing: "service_booking",
  stavebnictvo: "project_pipeline",
  murari: "project_pipeline",
  tesari: "project_pipeline",
  strechy: "project_pipeline",
  fasady: "project_pipeline",
  maliar: "project_pipeline",
  podlahy: "project_pipeline",
  obklady: "project_pipeline",
  kuchyne: "project_pipeline",
  stolarstvo: "project_pipeline",
  "brany-ploty": "project_pipeline",
  kovovyroba: "project_pipeline",
  zahradnictvo: "project_pipeline",
  kadernictvo: "appointment",
  barber: "appointment",
  nechty: "appointment",
  mihalnice: "appointment",
  kozmetika: "appointment",
  makeup: "appointment",
};

export function systemFor(category: string): RecommendedSystem | null {
  const key = SEGMENT_SYSTEM[categoryOf(category).id];
  return key ? SYSTEMS[key] : null;
}

/** Segmenty, kde sa bežne objednáva telefonicky (ASSUMPTION, nie dôkaz o konkrétnej firme). */
export const PHONE_FIRST_SEGMENTS: readonly string[] = [
  "autoservis", "pneuservis", "vodoinstalater", "elektrikar", "kurenie", "kominarstvo", "strechy", "stavebnictvo", "murari",
];

const PAIN_KEYS = ["phone_ordering", "messenger_cta", "photos_by_message"];

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

export function buildOpportunity(lead: Pick<Lead, "website_status" | "data_quality" | "ads_check">, category: string, profile: RadarProfile | null | undefined): Opportunity {
  const signals = profile?.process_signals ?? [];
  const has = (k: string) => signals.some((s) => s.key === k);
  const dims = {} as Opportunity["dimensions"];

  // PROCESS PAIN: ručné objednávanie bez nástroja, ktorý by ho zobral
  const pains = signals.filter((s) => PAIN_KEYS.includes(s.key));
  if (!signals.length) dims.PROCESS_PAIN = { level: "UNKNOWN", reasons: ["Web sme nevedeli prečítať, procesné signály chýbajú"] };
  else if (has("booking_tool")) dims.PROCESS_PAIN = { level: "LOW", reasons: ["Online rezerváciu už majú", ...pains.map((p) => p.text)] };
  else if (pains.length && has("no_form_found")) dims.PROCESS_PAIN = { level: "HIGH", reasons: [...pains.map((p) => p.text), "Formulár ani rezerváciu sme nenašli"] };
  else if (pains.length) dims.PROCESS_PAIN = { level: "MEDIUM", reasons: [...pains.map((p) => p.text), "Formulár majú, rezerváciu sme nenašli"] };
  else if (has("no_form_found")) dims.PROCESS_PAIN = { level: "MEDIUM", reasons: ["Formulár ani rezerváciu sme nenašli, dopyty idú zrejme telefónom alebo mailom"] };
  else dims.PROCESS_PAIN = { level: "LOW", reasons: ["Formulár majú, ručný proces na webe nevidno"] };

  // BUSINESS ACTIVITY: register + web + social (classify.business_status)
  const bs = profile?.business_status?.value;
  const bsEv = profile?.business_status?.evidence ?? [];
  dims.BUSINESS_ACTIVITY =
    bs === "active" ? { level: "HIGH", reasons: [`Firma je aktívna (${bsEv.length} ${bsEv.length === 1 ? "zdroj" : "zdroje"})`, ...bsEv] } :
    bs === "likely_active" ? { level: "MEDIUM", reasons: ["Firma je pravdepodobne aktívna", ...bsEv] } :
    bs === "inactive" ? { level: "LOW", reasons: ["Firma podľa registra zanikla alebo je v likvidácii", ...bsEv] } :
    { level: "UNKNOWN", reasons: bsEv.length ? bsEv : ["Aktivitu firmy sme nevedeli overiť"] };

  // EVIDENCE QUALITY: GOLD / SILVER / RESEARCH gate z radaru
  const q = lead.data_quality ?? profile?.data_quality ?? null;
  dims.EVIDENCE_QUALITY =
    q === "gold" ? { level: "HIGH", reasons: ["GOLD: identita, kontakt aj web overené"] } :
    q === "silver" ? { level: "MEDIUM", reasons: ["SILVER: jadro overené, niečo chýba", ...(profile?.data_quality_why ?? [])] } :
    q === "research" ? { level: "LOW", reasons: ["RESEARCH: dáta treba doplniť", ...(profile?.data_quality_why ?? [])] } :
    { level: "UNKNOWN", reasons: ["Kvalita dát nie je určená"] };

  // VISUAL GAP: stav webu
  const ws = lead.website_status;
  dims.VISUAL_GAP =
    ws === "broken" || ws === "no_website" ? { level: "HIGH", reasons: [ws === "broken" ? "Web je nefunkčný" : "Web sme nenašli"] } :
    ws === "weak" ? { level: "MEDIUM", reasons: (profile?.website?.health?.issues ?? []).slice(0, 3).map((i) => String((i as { text?: string }).text ?? "")).filter(Boolean) } :
    ws === "working" ? { level: "LOW", reasons: ["Web funguje"] } :
    { level: "UNKNOWN", reasons: ["Stav webu je neistý"] };

  // AD SPEND SIGNAL: ACTIVE iba s ručným dôkazom
  const ads = adsStatus(profile, lead.ads_check);
  dims.AD_SPEND_SIGNAL =
    ads.status === "ACTIVE" ? { level: "HIGH", reasons: [ads.note] } :
    ads.status === "TAG_PRESENT" ? { level: "MEDIUM", reasons: [ads.note] } :
    ads.status === "NOT_FOUND" ? { level: "LOW", reasons: [ads.note] } :
    { level: "UNKNOWN", reasons: [ads.note] };

  // AUTOMATION FIT: máme pre segment hotový systém + je čo automatizovať
  const system = systemFor(category);
  dims.AUTOMATION_FIT = !system
    ? { level: "LOW", reasons: ["Pre tento segment zatiaľ nemáme šablónu systému"] }
    : atLeast(dims.PROCESS_PAIN.level, "MEDIUM")
      ? { level: "HIGH", reasons: [`${system.label} rieši presne tento ručný krok`] }
      : { level: "MEDIUM", reasons: [`Segment sedí na ${system.label}, ručný proces zatiaľ nevidno`] };

  // DEMO POTENTIAL: máme šablónu dema pre odporúčaný systém a vieme ju naplniť ich údajmi
  const demoTemplate = !!system && ["service_booking", "project_pipeline", "appointment"].includes(system.id);
  const hasServices = (profile?.services ?? []).length > 0;
  dims.DEMO_POTENTIAL = !demoTemplate
    ? { level: "LOW", reasons: ["Pre tento segment zatiaľ nemáme demo"] }
    : hasServices
      ? { level: "HIGH", reasons: ["Demo sa dá naplniť ich skutočnými službami"] }
      : { level: "MEDIUM", reasons: ["Demo máme, ich služby sme zatiaľ nenašli"] };

  const priority: Opportunity["priority"] =
    atLeast(dims.PROCESS_PAIN.level, "HIGH") && atLeast(dims.BUSINESS_ACTIVITY.level, "HIGH") && atLeast(dims.EVIDENCE_QUALITY.level, "MEDIUM")
      ? "TOP"
      : dims.BUSINESS_ACTIVITY.level === "LOW" || dims.EVIDENCE_QUALITY.level === "LOW" ? "LOW" : "NORMAL";

  return {
    version: 1,
    dimensions: dims,
    ads,
    recommended_system: system,
    why_this_lead: whyThisLead(dims, system),
    money_leak: moneyLeak(ads, signals, lead.website_status, profile),
    priority,
    observed: signals.filter((s) => s.level === "OBSERVED").map(({ key, text, excerpt, source }) => ({ key, text, excerpt, source })),
  };
}

/** Veta z troch najsilnejších dimenzií. Iba pravidlo, AI ju smie len preformulovať. */
export function whyThisLead(dims: Opportunity["dimensions"], system: RecommendedSystem | null): string {
  const order: Dimension[] = ["PROCESS_PAIN", "BUSINESS_ACTIVITY", "AD_SPEND_SIGNAL", "VISUAL_GAP"];
  const parts = order
    .filter((d) => atLeast(dims[d].level, "MEDIUM"))
    .slice(0, 3)
    .map((d) => (dims[d].reasons[0] ?? "").replace(/[.\s]+$/, ""))
    .filter(Boolean);
  if (!parts.length) return "Silný dôvod sme nenašli.";
  return `${parts.join(". ")}.`;
}

function moneyLeak(ads: Opportunity["ads"], signals: NonNullable<RadarProfile["process_signals"]>, ws: Lead["website_status"], profile: RadarProfile | null | undefined): LeakLine[] {
  const web = profile?.website?.url ?? null;
  const lines: LeakLine[] = [
    { area: "ADS", label: "Google Ads", value: ads.status.replace("_", " "), level: ads.status === "ACTIVE" ? "VERIFIED" : ads.status === "UNKNOWN" ? "UNKNOWN" : "OBSERVED", source: ads.source },
    { area: "ADS", label: "Spend", value: "UNKNOWN", level: "UNKNOWN", source: null },
  ];
  if (ws) lines.push({ area: "WEBSITE", label: "Stav webu", value: ws, level: ws === "uncertain" ? "UNKNOWN" : "OBSERVED", source: web });
  for (const s of signals) lines.push({ area: "PROCESS", label: s.text, value: s.excerpt, level: "OBSERVED", source: s.source });
  const noForm = signals.some((s) => s.key === "no_form_found");
  if ((ads.status === "ACTIVE" || ads.status === "TAG_PRESENT") && noForm) {
    lines.push({ area: "ADS", label: "Riziko: návštevnosť z reklamy môže končiť na stránke bez formulára", value: "riziko, nie strata", level: "OBSERVED", source: web });
  }
  return lines;
}
