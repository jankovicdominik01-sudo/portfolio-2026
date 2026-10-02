/**
 * Segment Templates: jeden spoločný zdroj pre Opportunity Engine, Demo Engine,
 * neskôr djweby.sk simulátor a dj-core. Žiadna iná vrstva nesmie mať vlastný zoznam
 * modulov, polí dopytu alebo stavov zákazky pre segment.
 *
 * Segment je nad existujúcou taxonómiou kategórií (lib/types.ts CATEGORIES): kategória
 * sa mapuje na jeden template. Kategória bez templatu = systém zatiaľ neodporúčame.
 *
 * Čísla (minúty na dopyt) sú ASSUMPTION s vypísanými predpokladmi, nikdy fakt o firme.
 * Zmena obsahu = zvýš SEGMENT_TEMPLATE_VERSION.
 */
import { categoryOf, normalizeCategory, type CategoryId } from "./types";
import type { PainCode, ProcessSignalCode } from "./process";

export const SEGMENT_TEMPLATE_VERSION = "1.0";

export const SEGMENTS = ["AUTO_SERVICE", "FLOORING_TRADES", "BARBER_BEAUTY", "GENERAL_TRADES"] as const;
export type SegmentId = (typeof SEGMENTS)[number];

/* ─────────── Moduly systému (katalóg) ─────────── */

export const MODULES = {
  smart_inquiry: { label: "Smart Inquiry", what: "dopyt príde rovno so všetkými údajmi, ktoré firma potrebuje" },
  files_photos: { label: "Fotky a súbory", what: "zákazník priloží fotky priamo k dopytu" },
  pipeline: { label: "Pipeline zákaziek", what: "každá zákazka má stav a firma vidí, čo na čom stojí" },
  offers: { label: "Ponuky", what: "ponuka vznikne z údajov dopytu, bez prepisovania" },
  realizations: { label: "Realizácie", what: "hotové práce na webe, nie iba na sociálnych sieťach" },
  review_request: { label: "Žiadosť o recenziu", what: "po dokončení príde zákazníkovi prosba o hodnotenie" },
  booking: { label: "Online rezervácia", what: "zákazník si sám vyberie voľný termín" },
  reminders: { label: "Pripomienky", what: "deň vopred príde zákazníkovi pripomienka termínu" },
  job_status: { label: "Stav zákazky", what: "zákazník vidí, či je hotovo, bez telefonovania" },
  notifications: { label: "Notifikácie", what: "firme príde upozornenie na nový dopyt" },
} as const;
export type ModuleId = keyof typeof MODULES;
export const MODULE_IDS = Object.keys(MODULES) as ModuleId[];

/* ─────────── Stavy pipeline (katalóg) ─────────── */

export const PIPELINE_STATES = {
  NEW: "Nový",
  CONTACTED: "Kontaktovaný",
  CONFIRMED: "Potvrdený",
  MEASUREMENT: "Zameranie",
  SITE_VISIT: "Obhliadka",
  OFFER: "Ponuka",
  IN_SERVICE: "V servise",
  IN_PROGRESS: "V realizácii",
  REALIZATION: "Realizácia",
  READY: "Pripravené na odovzdanie",
  BOOKED: "Rezervované",
  NO_SHOW: "Neprišiel",
  DONE: "Hotovo",
} as const;
export type PipelineState = keyof typeof PIPELINE_STATES;

/* ─────────── Template ─────────── */

export type IntakeField = {
  id: string;
  label: string;
  type: "text" | "select" | "number" | "boolean" | "files" | "date" | "contact" | "location";
  options?: string[];
  unit?: string;
  required?: boolean;
};

export type CallQuestion = { text: string; confirms: PainCode[] };

export type SegmentTemplate = {
  segment: SegmentId;
  label: string;
  categories: CategoryId[];
  /** Šablóna dema v1 (kontrakt s djweby.sk: service_booking | project_pipeline | appointment). */
  demo_template: "service_booking" | "project_pipeline" | "appointment";
  likely_process_signals: ProcessSignalCode[];
  relevant_pains: PainCode[];
  recommended_modules: ModuleId[];
  /** Keď z evidence nevyplynie žiadny modul, toto je hypotéza segmentu (potvrdiť v hovore). */
  default_modules: ModuleId[];
  intake_schema: IntakeField[];
  dashboard_fields: string[];
  pipeline_states: PipelineState[];
  /** Ukážkový dopyt do dema. Je to vzor vstupu, nie zákazník firmy. */
  demo_example: {
    values: Record<string, string>;
    transition: [PipelineState, PipelineState];
    notification: string;
  };
  call_questions: CallQuestion[];
  /** ASSUMPTION: ručné prvotné spracovanie jedného dopytu. */
  minutes_per_inquiry: { range: [number, number]; assumptions: string[] };
};

export const SEGMENT_TEMPLATES: Record<SegmentId, SegmentTemplate> = {
  AUTO_SERVICE: {
    segment: "AUTO_SERVICE",
    label: "Autoservis / pneuservis",
    categories: ["autoservis", "pneuservis", "detailing"],
    demo_template: "service_booking",
    likely_process_signals: [
      "CALL_FOR_APPOINTMENT", "PHONE_BOOKING", "PHONE_FIRST_CONTACT", "CALL_FOR_PRICE", "NO_BOOKING_FOUND", "NO_CUSTOMER_STATUS_FOUND",
      "PHOTOS_REQUESTED_SEPARATELY", "PHOTO_UPLOAD_MISSING", "GENERIC_CONTACT_FORM", "WHATSAPP_PRIMARY", "MESSENGER_PRIMARY", "NO_FORM_FOUND",
    ],
    relevant_pains: [
      "MANUAL_BOOKING", "MANUAL_FIRST_INTAKE", "REPEATED_QUESTIONS", "PHOTOS_VIA_MESSENGER", "GENERIC_INQUIRY", "NO_JOB_STATUS",
      "NO_AUTOMATED_REMINDERS", "WEAK_MOBILE_INTAKE", "ADS_TO_WEAK_PAGE", "MANUAL_QUOTE_PREP",
    ],
    recommended_modules: ["smart_inquiry", "booking", "job_status", "files_photos", "reminders", "notifications"],
    default_modules: ["smart_inquiry", "booking"],
    intake_schema: [
      { id: "vehicle", label: "Auto (značka, model, rok)", type: "text", required: true },
      { id: "service", label: "Čo treba urobiť", type: "select", options: ["Servis / prehliadka", "Brzdy", "Diagnostika", "Prezutie pneumatík", "Iné"], required: true },
      { id: "date", label: "Kedy vám to vyhovuje", type: "date" },
      { id: "photos", label: "Fotky (voliteľné)", type: "files" },
      { id: "contact", label: "Meno a telefón", type: "contact", required: true },
    ],
    dashboard_fields: ["vehicle", "service", "date", "photos"],
    pipeline_states: ["NEW", "CONFIRMED", "IN_SERVICE", "READY", "DONE"],
    demo_example: {
      values: { vehicle: "Škoda Octavia 2016", service: "Brzdy", date: "utorok dopoludnia", photos: "2" },
      transition: ["NEW", "CONFIRMED"],
      notification: "Nová požiadavka: Škoda Octavia 2016, brzdy, utorok dopoludnia",
    },
    call_questions: [
      { text: "Ako sa k vám dnes zákazníci objednávajú na termín?", confirms: ["MANUAL_BOOKING", "MANUAL_FIRST_INTAKE"] },
      { text: "Pýtajú sa vás ľudia telefonicky, či je auto už hotové?", confirms: ["NO_JOB_STATUS"] },
      { text: "Posielajú vám zákazníci fotky poškodenia, a ak áno, kam?", confirms: ["PHOTOS_VIA_MESSENGER"] },
    ],
    minutes_per_inquiry: {
      range: [3, 6],
      assumptions: ["termín a problém sa dohadujú telefonicky", "2 až 3 doplňujúce otázky (auto, problém, kedy)", "fotky, ak sú, prídu zvlášť"],
    },
  },
  FLOORING_TRADES: {
    segment: "FLOORING_TRADES",
    label: "Podlahy a obklady",
    categories: ["podlahy", "obklady"],
    demo_template: "project_pipeline",
    likely_process_signals: [
      "GENERIC_CONTACT_FORM", "PHOTO_UPLOAD_MISSING", "PHOTOS_REQUESTED_SEPARATELY", "MEASUREMENT_REQUIRED", "MANUAL_QUOTE_SIGNAL",
      "CALL_FOR_PRICE", "PHONE_FIRST_CONTACT", "PDF_PRICE_LIST", "SOCIAL_REALIZATIONS", "EMAIL_FOR_ORDER", "NO_FORM_FOUND",
      "WHATSAPP_PRIMARY", "MESSENGER_PRIMARY",
    ],
    relevant_pains: [
      "GENERIC_INQUIRY", "MANUAL_FIRST_INTAKE", "REPEATED_QUESTIONS", "PHOTOS_VIA_MESSENGER", "MANUAL_QUOTE_PREP",
      "MANUAL_MEASUREMENT_COORDINATION", "NO_JOB_STATUS", "SOCIAL_WEB_GAP", "WEAK_MOBILE_INTAKE", "ADS_TO_WEAK_PAGE",
    ],
    recommended_modules: ["smart_inquiry", "files_photos", "pipeline", "offers", "realizations", "review_request"],
    default_modules: ["smart_inquiry", "files_photos"],
    intake_schema: [
      { id: "floor_type", label: "Typ podlahy", type: "select", options: ["Vinylová podlaha", "Laminát", "Drevená podlaha", "Koberec", "PVC", "Iné"], required: true },
      { id: "area", label: "Orientačná plocha", type: "number", unit: "m²", required: true },
      { id: "location", label: "Lokalita", type: "location", required: true },
      { id: "subfloor", label: "Stav podkladu", type: "select", options: ["Rovný", "Treba vyrovnať", "Neviem"] },
      { id: "remove_old", label: "Odstrániť starú podlahu", type: "boolean" },
      { id: "photos", label: "Fotky miestnosti", type: "files" },
      { id: "measurement", label: "Chcem zameranie", type: "boolean" },
      { id: "contact", label: "Meno a telefón", type: "contact", required: true },
    ],
    dashboard_fields: ["floor_type", "area", "location", "photos", "measurement"],
    pipeline_states: ["NEW", "CONTACTED", "MEASUREMENT", "OFFER", "REALIZATION", "DONE"],
    demo_example: {
      values: { floor_type: "Vinylová podlaha", area: "45", location: "", photos: "3", measurement: "Áno", remove_old: "Áno", subfloor: "Neviem" },
      transition: ["NEW", "MEASUREMENT"],
      notification: "Nový dopyt: vinylová podlaha, 45 m², 3 fotky, chce zameranie",
    },
    call_questions: [
      { text: "Keď vám príde nový zákazník, čo od neho potrebujete vedieť ako prvé?", confirms: ["MANUAL_FIRST_INTAKE", "REPEATED_QUESTIONS", "GENERIC_INQUIRY"] },
      { text: "Posielajú vám ľudia fotky ešte pred zameraním?", confirms: ["PHOTOS_VIA_MESSENGER"] },
      { text: "Ako dnes evidujete, či je zákazka po zameraní alebo čaká na ponuku?", confirms: ["MANUAL_MEASUREMENT_COORDINATION", "NO_JOB_STATUS", "MANUAL_QUOTE_PREP"] },
    ],
    minutes_per_inquiry: {
      range: [4, 8],
      assumptions: ["typ podlahy, plocha a lokalita sa zisťujú telefonicky", "3 až 4 opakované otázky na každý dopyt", "fotky prídu zvlášť (správou alebo mailom)"],
    },
  },
  BARBER_BEAUTY: {
    segment: "BARBER_BEAUTY",
    label: "Barber a beauty",
    categories: ["kadernictvo", "barber", "makeup", "nechty", "mihalnice", "kozmetika"],
    demo_template: "appointment",
    likely_process_signals: [
      "CALL_FOR_APPOINTMENT", "PHONE_BOOKING", "NO_BOOKING_FOUND", "WHATSAPP_PRIMARY", "MESSENGER_PRIMARY", "PDF_PRICE_LIST", "SOCIAL_REALIZATIONS",
    ],
    relevant_pains: ["MANUAL_BOOKING", "NO_AUTOMATED_REMINDERS", "SOCIAL_WEB_GAP", "WEAK_MOBILE_INTAKE", "ADS_TO_WEAK_PAGE", "REPEATED_QUESTIONS"],
    recommended_modules: ["booking", "reminders", "notifications", "review_request"],
    default_modules: ["booking", "reminders"],
    intake_schema: [
      { id: "service", label: "Služba", type: "select", options: ["Strih", "Farbenie", "Úprava brady", "Iné"], required: true },
      { id: "date", label: "Deň a čas", type: "date", required: true },
      { id: "note", label: "Poznámka", type: "text" },
      { id: "contact", label: "Meno a telefón", type: "contact", required: true },
    ],
    dashboard_fields: ["service", "date", "note"],
    pipeline_states: ["BOOKED", "CONFIRMED", "DONE", "NO_SHOW"],
    demo_example: {
      values: { service: "Strih", date: "piatok 16:30", note: "" },
      transition: ["BOOKED", "CONFIRMED"],
      notification: "Nová rezervácia: strih, piatok 16:30",
    },
    call_questions: [
      { text: "Objednávajú sa k vám ľudia skôr telefonicky alebo cez správy?", confirms: ["MANUAL_BOOKING"] },
      { text: "Stáva sa vám, že niekto nepríde na termín?", confirms: ["NO_AUTOMATED_REMINDERS"] },
    ],
    minutes_per_inquiry: {
      range: [2, 4],
      assumptions: ["termín sa dohaduje telefonicky alebo správami", "1 až 2 výmeny, kým sa nájde voľný čas"],
    },
  },
  GENERAL_TRADES: {
    segment: "GENERAL_TRADES",
    label: "Remeslá a stavba",
    categories: [
      "zahradnictvo", "stolarstvo", "kuchyne", "kovovyroba", "brany-ploty", "stavebnictvo", "murari", "tesari", "strechy", "fasady",
      "maliar", "vodoinstalater", "kurenie", "elektrikar", "kominarstvo",
    ],
    demo_template: "project_pipeline",
    likely_process_signals: [
      "PHONE_FIRST_CONTACT", "CALL_FOR_PRICE", "GENERIC_CONTACT_FORM", "PHOTO_UPLOAD_MISSING", "PHOTOS_REQUESTED_SEPARATELY", "MEASUREMENT_REQUIRED",
      "MANUAL_QUOTE_SIGNAL", "EMAIL_FOR_ORDER", "SOCIAL_REALIZATIONS", "NO_FORM_FOUND", "WHATSAPP_PRIMARY", "MESSENGER_PRIMARY", "PDF_PRICE_LIST",
    ],
    relevant_pains: [
      "GENERIC_INQUIRY", "MANUAL_FIRST_INTAKE", "REPEATED_QUESTIONS", "PHOTOS_VIA_MESSENGER", "MANUAL_QUOTE_PREP",
      "MANUAL_MEASUREMENT_COORDINATION", "NO_JOB_STATUS", "SOCIAL_WEB_GAP", "WEAK_MOBILE_INTAKE", "ADS_TO_WEAK_PAGE",
    ],
    recommended_modules: ["smart_inquiry", "files_photos", "pipeline", "offers", "realizations", "review_request"],
    default_modules: ["smart_inquiry", "files_photos"],
    intake_schema: [
      { id: "job_type", label: "Typ práce", type: "select", options: ["Nová realizácia", "Oprava", "Rekonštrukcia", "Iné"], required: true },
      { id: "description", label: "Čo treba urobiť", type: "text", required: true },
      { id: "location", label: "Lokalita", type: "location", required: true },
      { id: "scope", label: "Orientačný rozsah", type: "text" },
      { id: "photos", label: "Fotky", type: "files" },
      { id: "when", label: "Kedy", type: "date" },
      { id: "contact", label: "Meno a telefón", type: "contact", required: true },
    ],
    dashboard_fields: ["job_type", "description", "location", "photos"],
    pipeline_states: ["NEW", "CONTACTED", "SITE_VISIT", "OFFER", "IN_PROGRESS", "DONE"],
    demo_example: {
      values: { job_type: "Nová realizácia", description: "", location: "", scope: "", photos: "3", when: "do mesiaca" },
      transition: ["NEW", "SITE_VISIT"],
      notification: "Nový dopyt: nová realizácia, 3 fotky, do mesiaca",
    },
    call_questions: [
      { text: "Keď vám príde nový dopyt, čo musíte od zákazníka zisťovať ako prvé?", confirms: ["MANUAL_FIRST_INTAKE", "REPEATED_QUESTIONS", "GENERIC_INQUIRY"] },
      { text: "Posielajú vám ľudia fotky pred obhliadkou, a kam?", confirms: ["PHOTOS_VIA_MESSENGER"] },
      { text: "Kde máte dnes prehľad, ktorá zákazka čaká na obhliadku a ktorá na ponuku?", confirms: ["NO_JOB_STATUS", "MANUAL_MEASUREMENT_COORDINATION", "MANUAL_QUOTE_PREP"] },
    ],
    minutes_per_inquiry: {
      range: [4, 8],
      assumptions: ["rozsah a lokalita sa zisťujú telefonicky", "3 až 4 opakované otázky na každý dopyt", "fotky prídu zvlášť alebo až na obhliadke"],
    },
  },
};

/** Segment pre kategóriu. Kategória bez templatu = null (systém neodporúčame). */
export function segmentFor(category: string | null | undefined): SegmentTemplate | null {
  const id = categoryOf(category).id;
  return Object.values(SEGMENT_TEMPLATES).find((t) => t.categories.includes(id)) ?? null;
}

export const moduleLabel = (m: ModuleId) => MODULES[m].label;

/** Slová, podľa ktorých služba z radaru patrí do segmentu. Čo nesedí, do dema nejde. */
const SERVICE_WORDS: Record<SegmentId, RegExp> = {
  AUTO_SERVICE: /servis|oprav|brzd|olej|pneu|diagnost|stk|emisi|klimatiz|karos|lakov|detail|čisten|cisten|prezut|geometri|výfuk|vyfuk|motor|autoumyv/i,
  FLOORING_TRADES: /podlah|vinyl|lamin|parket|koberc|pvc|linole|dlažb|dlazb|obklad|stierk|brúsen|brusen|marmole/i,
  BARBER_BEAUTY: /strih|farb|melír|melir|brad|holen|účes|uces|necht|manik|pedik|gél|gel|mihal|obočie|obocie|kozmet|pleť|plet|masáž|masaz|líčen|licen|make-?up|depil|vizáž|vizaz|kader|barber/i,
  GENERAL_TRADES: /stav|rekon|murov|omietk|strech|klampi|fasád|fasad|zatepl|malov|natier|stolár|stolar|nábyt|nabyt|kuchyn|zvár|zvar|kovov|brán|bran|plot|pergol|záhrad|zahrad|trávnik|travnik|výsadb|vysadb|orez|vodo|kúren|kuren|tepeln|elektr|komín|komin|tesár|tesar|krov|inštal|instal|oprav/i,
};

/**
 * Služby z radaru, ktoré k segmentu firmy naozaj sedia (do dema a do karty).
 * Služba z iného odboru (napr. „predaj rastlín“ pri podlahárovi) sa nepoužije, radšej žiadna.
 */
export function relevantServices(category: string | null | undefined, services: string[] | null | undefined): string[] {
  const t = segmentFor(category);
  const cat = categoryOf(category).id;
  return (services ?? [])
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && s.length <= 60)
    .filter((s) => normalizeCategory(s) === cat || (!!t && SERVICE_WORDS[t.segment].test(s)))
    .slice(0, 5);
}
