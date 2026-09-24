import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Company, Evidence, Offer } from "../types";
import { categoryOf } from "../types";
import type { SiteFacts } from "./web";
import type { Signals } from "./signals";
import { BANNED_PHRASES } from "./guard";

/**
 * AI analysis API. Claude dostane IBA overené fakty (evidence E1…En) a musí
 * na ne odkazovať. Ponuku a cenu nevymýšľa — dostane ich z DB alebo nič.
 */

const ClaimOut = z.object({ text: z.string(), evidence_ids: z.array(z.string()) });

export const ClaudeOutput = z.object({
  company_summary: z.string(),
  why_this_lead: z.string(),
  positive_points: z.array(ClaimOut),
  observations: z.array(ClaimOut),
  customer_risk: z.string().nullable(),
  customer_gap: z.string().nullable(),
  opportunity: z.string().nullable(),
  primary_hook: z.string().nullable(),
  secondary_hook: z.string().nullable(),
  nothing_found: z.boolean(),
  confidence: z.enum(["high", "medium", "low"]),
  brief: z.object({
    praise: z.string(),
    observation: z.string(),
    reason: z.string(),
    opportunity: z.string(),
    main_idea: z.string(),
    call_opening: z.string(),
    natural_pitch: z.string(),
    dominik_intro: z.string(),
    key_question: z.string(),
    remember: z.string(),
    what_not_to_say: z.array(z.string()),
    objections: z.array(z.object({ objection: z.string(), answer: z.string() })),
  }),
});
export type ClaudeOutput = z.infer<typeof ClaudeOutput>;

const SYSTEM = `Si obchodný analytik pre DJWeby — Dominik Jankovič robí jednoduché weby pre malé slovenské remeselné firmy.
Pripravuješ podklady pre telefonát. Volá kamarát (nie telemarketer), ktorý firmu pochváli, spomenie JEDNU vec, ktorú si všimol, a až potom prirodzene spomenie Dominika. Cieľ hovoru nie je predať web, ale zistiť, či môže Dominik zavolať.

PRAVIDLÁ
1. Pracuj výhradne s faktami v <evidence>. Každá položka positive_points a observations musí mať evidence_ids z tohto zoznamu. Čo nevieš, nepíš — alebo napíš „neoverené“.
2. Nikdy nevynášaj verdikt typu „web je zastaraný/zlý“. Opisuj pozorovanie: „Na úvodnej stránke nie je hneď vidieť, aké služby firma ponúka.“
3. Model rozhovoru: POCHVALA (jedna konkrétna vec) → POZOROVANIE (jedna vec) → DÔVOD (prečo to zaujíma zákazníka firmy) → PRÍLEŽITOSŤ (čo spraví jednoduchý web).
4. Ak si nenašiel nič podstatné, nastav nothing_found=true, primary_hook=null a v why_this_lead to úprimne napíš. Nevyrábaj problém.
5. Jazyk: hovorová, pokojná slovenčina. Krátke vety. Žiadny marketing, žiadny technický žargón (SEO, UX, responzivita, CLS, konverzie). Namiesto „CLS“ napíš „stránka sa pri načítaní posúva“.
6. call_opening je jedna prirodzená veta, napr. „Dobrý deň, môžem sa vás na niečo spýtať? Pozeral som si teraz vaše stránky kvôli jednej veci…“
7. natural_pitch: 20–40 sekúnd reči. Najprv pochvala, potom „len som si všimol…“. Bez Dominika a bez ceny.
8. dominik_intro: Dominik je druhá vrstva — „Inak, mám kamaráta Dominika, ktorý robí weby…“. Nesmie znieť ako predajná veta.
9. Nepíš nič o hotovom/rozpracovanom webe ani o cene — to systém doplní sám z databázy.
10. objections: 6 najpravdepodobnejších reakcií (Už web máme / Teraz to nepotrebujeme / Pošlite e-mail / Koľko to stojí / Nemám čas / Ozveme sa neskôr) s krátkou, nenátlakovou odpoveďou. Žiadna manipulácia.
11. Zakázané frázy: ${BANNED_PHRASES.map((p) => `„${p}“`).join(", ")}.
12. Premýšľaj ako zákazník tejto firmy: čo potrebujem vedieť do 10 sekúnd, čo mi pomôže rozhodnúť sa zavolať, čo tu chýba, čo je dobré. Pri firmách s fyzickými realizáciami (stolári, záhradníctva, kovovýroba, strechy…) je galéria prioritný argument.`;

export function claudeAvailable() {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function analyzeWithClaude(input: {
  company: Company;
  site: SiteFacts | null;
  signals: Signals;
  evidence: Evidence[];
  offer: Offer | null;
}): Promise<{ output: ClaudeOutput; model: string }> {
  const client = new Anthropic({ timeout: 110_000, maxRetries: 1 });
  const model = process.env.AI_MODEL || "claude-opus-5";
  const { company, site, signals, evidence, offer } = input;
  const cat = categoryOf(company.category);

  const pages = (site?.pages ?? [])
    .map(
      (p) =>
        `<page kind="${p.kind}" url="${p.url}">\nTitulok: ${p.title ?? "-"}\nNadpisy: ${[...p.h1, ...p.headings].slice(0, 12).join(" | ")}\nText (začiatok): ${p.text.slice(0, 2500)}\n</page>`,
    )
    .join("\n");

  const user = `<company>
Názov: ${company.name}
Segment: ${cat.label}${cat.gallery ? " (realizácie/galéria sú kľúčové)" : ""}
Mesto: ${company.city ?? "neuvedené"}
Web: ${company.website ?? "nemá"}
</company>

<evidence>
${evidence.map((e) => `${e.id} [${e.source}${e.page ? ` · ${e.page}` : ""}] ${e.excerpt}`).join("\n")}
</evidence>

<signals>
${JSON.stringify({ ...signals, servicesClear: signals.servicesClear.items }, null, 0)}
</signals>

<pages>
${pages || "(web nie je k dispozícii)"}
</pages>

${signals.siteOk && !signals.readable ? "POZOR: obsah webu sa nedal prečítať (načítava sa cez JavaScript). O obsahu webu (galéria, telefón, služby) nič netvrď — iba to, čo je v evidence.\n\n" : ""}${offer ? "Pre tento segment existuje reálna ponuka — systém ju doplní sám, ty ju nespomínaj." : "Pre tento segment nemáme hotový web — nespomínaj žiadny."}

Priprav analýzu a call brief podľa pravidiel.`;

  const res = await client.messages.parse({
    model,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { format: zodOutputFormat(ClaudeOutput), effort: "medium" },
    messages: [{ role: "user", content: user }],
  });
  if (res.stop_reason === "refusal") throw new Error("AI odmietla analýzu.");
  if (!res.parsed_output) throw new Error("AI vrátila neplatný výstup.");
  return { output: res.parsed_output, model };
}
