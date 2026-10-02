/**
 * Call Card v3 pre operátora (Opportunity Engine v2).
 *
 * Roman má do ~10 sekúnd vedieť: PREČO volá → AKÝ problém sme našli → AKÝ dôkaz
 * → ČO by sme postavili → AKO to pomôže → ČO povedať ako prvé. Nie je to scenár:
 * jedna veta na začiatok, 2 až 3 otázky, ktoré predpoklady potvrdia alebo vyvrátia.
 *
 * Tvrdenie o webe iba pri webe, ktorý firme POTVRDENE patrí. Nikdy „nemáte“, iba „nenašli sme“.
 * Žiadne čísla o ich stratách ani reklame.
 */
import type { Opportunity } from "./opportunity";
import type { EvidenceLevel, OppEvidence, PainCode } from "./process";
import { MODULES, segmentFor } from "./segments";
import type { Company, RadarProfile } from "./types";
import { forbiddenClaims } from "./script";

export type CallFact = { level: EvidenceLevel; text: string; excerpt: string | null; source: string | null; evidence_id: string };

export type OpportunityCallCard = {
  version: 3;
  company: { name: string; segment: string; city: string | null; phone: string | null; website: string | null };
  /** 1 až 3 vety. */
  why: string[];
  /** Max. 3 najsilnejšie fakty s úrovňou dôkazu. */
  facts: CallFact[];
  system_idea: string | null;
  /** Ako to firme pomôže (z modulov), 1 veta. */
  benefit: string | null;
  system_is_hypothesis: boolean;
  opening: string;
  questions: string[];
  next_step: { ask: string; rule: string };
  /** Predpoklady na potvrdenie po hovore (CONFIRM / REJECT / UNKNOWN). */
  hypotheses: { code: PainCode; text: string }[];
  demo: "READY" | "NOT_READY";
  cautions: string[];
};

/** Pokračovanie vety „…pozerali sme vašu stránku a všimli sme si, že …“. */
const OPENING_FACT: Record<string, string> = {
  CALL_FOR_APPOINTMENT: "na termín vás treba zavolať",
  PHONE_BOOKING: "termíny riešite hlavne telefonicky",
  CALL_FOR_PRICE: "cenu poviete až po telefonáte",
  GENERIC_CONTACT_FORM: "formulár sa pýta iba na základné kontaktné údaje",
  PHOTOS_REQUESTED_SEPARATELY: "fotky od zákazníkov chcete dostať správou",
  MEASUREMENT_REQUIRED: "pred ponukou robíte zameranie",
  WHATSAPP_PRIMARY: "zákazníkov posielate písať cez WhatsApp",
  MESSENGER_PRIMARY: "zákazníkov posielate písať cez Messenger",
  EMAIL_FOR_ORDER: "objednávky chcete dostávať e-mailom",
  MANUAL_QUOTE_SIGNAL: "ponuku pripravujete pre každého zvlášť",
  NO_BOOKING_FOUND: "online objednanie sme na nej nenašli",
  NO_FORM_FOUND: "formulár na dopyt sme na nej nenašli",
  "web:no_tel_link": "telefón sa na mobile nedá rovno ťuknúť",
  "web:no_viewport": "na mobile sa zobrazuje zmenšená verzia",
};

/** Poradie faktov: priame texty a overené fakty o procese pred neprítomnosťou. */
const FACT_ORDER = [
  "CALL_FOR_APPOINTMENT", "PHONE_BOOKING", "GENERIC_CONTACT_FORM", "PHOTOS_REQUESTED_SEPARATELY", "MEASUREMENT_REQUIRED", "CALL_FOR_PRICE",
  "WHATSAPP_PRIMARY", "MESSENGER_PRIMARY", "EMAIL_FOR_ORDER", "MANUAL_QUOTE_SIGNAL", "PDF_PRICE_LIST", "PHOTO_UPLOAD_MISSING",
  "NO_FORM_FOUND", "NO_BOOKING_FOUND", "SOCIAL_REALIZATIONS", "web:no_tel_link", "web:no_viewport", "web:no_https", "web:frames",
];

const GENERIC_QUESTIONS = ["Ako sa k vám dnes zákazníci najčastejšie ozývajú?", "Čo od nového zákazníka potrebujete vedieť ako prvé?"];

export function opportunityCallCard(opts: {
  company: Pick<Company, "name" | "city" | "phone" | "website" | "category">;
  categoryLabel?: string;
  profile: RadarProfile | null | undefined;
  opportunity: Opportunity;
  operatorName: string;
  demoReady: boolean;
}): OpportunityCallCard {
  const { company, profile, opportunity: o, operatorName } = opts;
  const template = segmentFor(company.category);
  const webConfirmed = profile?.website_resolution === "confirmed";

  // Fakty: iba z potvrdeného webu (signály a problémy webu), inak nič o stránke netvrdíme.
  const usable = (e: OppEvidence) => (e.kind === "signal" || e.kind === "web" ? webConfirmed : false);
  const rank = (e: OppEvidence) => {
    const i = FACT_ORDER.indexOf(e.code);
    return i < 0 ? 99 : i;
  };
  const facts: CallFact[] = o.evidence
    .filter(usable)
    .filter((e) => FACT_ORDER.includes(e.code))
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, 3)
    .map((e) => ({ level: e.level, text: e.text, excerpt: e.excerpt && e.excerpt !== e.text ? e.excerpt : null, source: e.source, evidence_id: e.id }));

  const first = facts.find((f) => OPENING_FACT[o.evidence.find((e) => e.id === f.evidence_id)?.code ?? ""]);
  const firstCode = first ? o.evidence.find((e) => e.id === first.evidence_id)!.code : null;
  const opening =
    webConfirmed && firstCode
      ? `Dobrý deň, volám sa ${operatorName} a ozývam sa za Dominika, pozerali sme vašu stránku a všimli sme si, že ${OPENING_FACT[firstCode]}.`
      : `Dobrý deň, volám sa ${operatorName} a ozývam sa za Dominika, chcel by som sa spýtať, ako sa k vám dnes zákazníci objednávajú.`;

  // Otázky: tie, ktoré potvrdia alebo vyvrátia predpoklady (painy) tohto leadu.
  const painCodes = new Set(o.pains.map((p) => p.code));
  const qs = template
    ? [...template.call_questions].sort((a, b) => Number(b.confirms.some((c) => painCodes.has(c))) - Number(a.confirms.some((c) => painCodes.has(c)))).map((q) => q.text)
    : GENERIC_QUESTIONS;
  const questions = qs.slice(0, 3);

  const sys = o.recommended_system;
  const benefit = sys?.primary_modules.length ? `${MODULES[sys.primary_modules[0]].what[0].toUpperCase()}${MODULES[sys.primary_modules[0]].what.slice(1)}.` : null;
  const card: OpportunityCallCard = {
    version: 3,
    company: {
      name: company.name,
      segment: opts.categoryLabel ?? company.category,
      city: company.city,
      phone: company.phone,
      website: webConfirmed ? (profile?.website?.url ?? company.website ?? null) : null,
    },
    why: o.why_lines.length ? o.why_lines.map((l) => l.text) : ["Silný dôvod sme nenašli. Iba sa pýtaj, ako to dnes riešia."],
    facts,
    system_idea: sys?.label || null,
    benefit,
    system_is_hypothesis: sys?.basis === "segment",
    opening,
    questions,
    next_step: {
      ask: opts.demoReady ? "Môže vám Dominik poslať krátku ukážku, ako by to vyzeralo u vás?" : "Môže sa vám Dominik ozvať a ukázať, ako by to u vás mohlo fungovať?",
      rule: "Ak potvrdí ručný príjem dopytov alebo termínov → súhlas pre Dominika (follow-up + personalizované demo).",
    },
    hypotheses: [...o.pains].sort((a, b) => Number(a.hypothesis) - Number(b.hypothesis)).slice(0, 4).map((p) => ({ code: p.code, text: p.label })),
    demo: opts.demoReady ? "READY" : "NOT_READY",
    cautions: [
      "Hovor o tom, čo sme videli. Nikdy „nemáte“, iba „nenašli sme“.",
      "Žiadne čísla o ich stratách ani reklame.",
      "Keď nechcú, poďakuj a skonči. „Nevolať“ zapíš hneď.",
    ],
  };
  const bad = forbiddenClaims([card.opening, card.next_step.ask, ...card.questions, ...card.why]);
  if (bad.length) throw new Error(`Call Card v3 obsahuje zakázané tvrdenia: ${bad.join(", ")}`);
  return card;
}
