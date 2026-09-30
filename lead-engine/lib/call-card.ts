/**
 * Call Card v2 pre operátora (Opportunity Engine).
 *
 * Nie je to scenár na čítanie. Operátor dostane fakty a jednu-dve vety na začiatok,
 * rozhovor vedie sám. Všetko tvrdené o firme musí mať úroveň dôkazu:
 * VERIFIED (so zdrojom), OBSERVED (úryvok z webu), ESTIMATE (s predpokladmi).
 * Žiadne „robíme webstránky“, žiadne vymyslené čísla.
 */
import type { Opportunity, RecommendedSystem } from "./opportunity";
import type { Company, RadarProfile } from "./types";
import { forbiddenClaims } from "./script";

export type OpportunityCallCard = {
  firm: string;
  category: string;
  city: string | null;
  phone: string | null;
  website: string | null;
  /** Hlavný ručný proces, ktorý sme videli (OBSERVED), alebo null. */
  main_pain: string | null;
  why_this_lead: string;
  opportunity: string | null;
  verified: { text: string; source: string | null }[];
  observed: { key: string; text: string; excerpt: string; source: string }[];
  /** Odhady iba s predpokladmi. Prázdne = nič neodhadujeme. */
  estimate: { text: string; assumptions: string[] }[];
  demo: "READY" | "NOT_READY";
  opening: string;
  context_pain: string;
  idea: string;
  questions: string[];
  next_step: string;
  cautions: string[];
};

/** Pokračovanie vety „Pozerali sme vašu stránku a všimli sme si, že …“. Nikdy „nemáte“. */
const PAIN_SENTENCE: Record<string, string> = {
  phone_ordering: "termíny a objednávky riešite hlavne telefonicky",
  messenger_cta: "zákazníkov posielate písať cez Messenger alebo WhatsApp",
  photos_by_message: "fotky od zákazníkov chcete dostávať správou",
  no_booking_found: "online objednanie sme na nej nenašli",
  no_form_found: "formulár na dopyt sme na nej nenašli",
};

const IDEA: Record<string, string> = {
  service_booking: "Dominik robí systém, kde si zákazník sám vyberie termín a opíše problém aj s fotkou, a vám príde hotová požiadavka.",
  project_pipeline: "Dominik robí systém, kde dopyt príde rovno s rozmermi a fotkami a všetky zákazky vidíte na jednom mieste.",
  appointment: "Dominik robí systém, kde si klient sám vyberie čas a deň vopred mu príde pripomienka.",
  inquiry: "Dominik robí systém, kde dopyt príde rovno so všetkými údajmi, bez dopytovania.",
};

const QUESTIONS: Record<string, string[]> = {
  service_booking: ["Koľko termínov týždenne vybavíte cez telefón?", "Posielajú vám zákazníci fotky poškodenia?", "Kto u vás dvíha telefón, keď ste pri aute?"],
  project_pipeline: ["Koľko dopytov vám príde za týždeň?", "Ako dlho vám trvá zistiť rozmery a detaily pred ponukou?", "Kde máte dnes prehľad o rozbehnutých zákazkách?"],
  appointment: ["Objednávajú sa k vám ľudia skôr cez Instagram alebo telefón?", "Stáva sa vám, že niekto nepríde na termín?"],
  inquiry: ["Koľko dopytov vám príde za týždeň?", "Čo sa u zákazníka najčastejšie dopytujete?"],
};

export function opportunityCallCard(opts: {
  company: Pick<Company, "name" | "city" | "phone" | "website" | "category">;
  categoryLabel?: string;
  profile: RadarProfile | null | undefined;
  opportunity: Opportunity;
  operatorName: string;
  demoReady: boolean;
}): OpportunityCallCard {
  const { company, profile, opportunity: o, operatorName } = opts;
  const sys: RecommendedSystem | null = o.recommended_system;
  const sysId = sys?.id ?? "inquiry";

  const verified: OpportunityCallCard["verified"] = [];
  const reg = profile?.register as { found?: boolean; ico?: string; name?: string } | null | undefined;
  if (reg?.found) verified.push({ text: `V registri aktívna${reg.ico ? `, IČO ${reg.ico}` : ""}`, source: "register" });
  if (profile?.primary_phone?.confidence === "high") verified.push({ text: `Telefón ${profile.primary_phone.value}`, source: profile.primary_phone.sources[0] ?? null });
  if (profile?.website_resolution === "confirmed" && profile.website?.url) verified.push({ text: `Web patrí firme: ${profile.website.url}`, source: profile.website.url });

  // Tvrdenie o webe iba pri webe, ktorý firme POTVRDENE patrí, a iba s úryvkom (OBSERVED).
  const webConfirmed = profile?.website_resolution === "confirmed";
  const pains = webConfirmed ? o.observed.filter((s) => PAIN_SENTENCE[s.key]) : [];
  const lead = pains.find((s) => !s.key.endsWith("_found")) ?? pains[0];
  const context = lead
    ? `Pozerali sme vašu stránku a všimli sme si, že ${PAIN_SENTENCE[lead.key]}.`
    : "Zaujímalo by ma, ako sa k vám dnes zákazníci objednávajú.";

  const card: OpportunityCallCard = {
    firm: company.name,
    category: opts.categoryLabel ?? company.category,
    city: company.city,
    phone: company.phone,
    website: webConfirmed ? (profile?.website?.url ?? company.website ?? null) : null,
    main_pain: lead?.text ?? null,
    why_this_lead: o.why_this_lead,
    opportunity: sys?.label ?? null,
    verified,
    observed: o.observed,
    estimate: [],
    demo: opts.demoReady ? "READY" : "NOT_READY",
    opening: webConfirmed
      ? `Dobrý deň, volám sa ${operatorName} a ozývam sa za Dominika ohľadom vašej stránky.`
      : `Dobrý deň, volám sa ${operatorName} a ozývam sa za Dominika, robí firmám weby, cez ktoré chodia hotové objednávky.`,
    context_pain: context,
    idea: IDEA[sysId] ?? IDEA.inquiry,
    questions: (QUESTIONS[sysId] ?? QUESTIONS.inquiry).slice(0, 3),
    next_step: opts.demoReady
      ? "Môže vám Dominik poslať krátku ukážku, ako by to vyzeralo u vás?"
      : "Môže vám Dominik napísať, ako by to u vás mohlo fungovať?",
    cautions: [
      "Hovor o tom, čo sme videli. Nikdy „nemáte“, iba „nenašli sme“.",
      "Žiadne čísla o ich stratách ani reklame. Spend nevieme.",
      "Keď nechcú, poďakuj a skonči. „Nevolať“ zapíš hneď.",
    ],
  };
  const bad = forbiddenClaims([card.opening, card.context_pain, card.idea, card.next_step, ...card.questions]);
  if (bad.length) throw new Error(`Call Card v2 obsahuje zakázané tvrdenia: ${bad.join(", ")}`);
  return card;
}
