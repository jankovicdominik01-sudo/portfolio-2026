import type { CallLog, CategoryId, Company, Lead, Offer } from "../types";
import { categoryOf } from "../types";

/**
 * Spoločné stavebné bloky call briefu — používa ich rules engine aj Claude
 * (ponuka a cena NIKDY nepochádzajú z AI, iba z tabuľky offers).
 */

const CATEGORY_GENITIVE: Record<CategoryId, string> = {
  zahradnictvo: "záhradníctvo",
  stolarstvo: "stolársku firmu",
  kovovyroba: "kovovýrobu",
  "brany-ploty": "firmu na brány a ploty",
  murari: "murársku firmu",
  tesari: "tesársku firmu",
  strechy: "strechárov",
  vodoinstalater: "inštalatéra",
  elektrikar: "elektrikára",
  podlahy: "podlahárov",
  obklady: "obkladačov",
  kominarstvo: "kominárov",
  ine: "podobnú firmu",
};

/** Vráti ponuku iba ak reálne existuje a je dostupná (existing_offer.available). */
export function matchOffer(offers: Offer[], category: CategoryId): Offer | null {
  return offers.find((o) => o.available && o.category === category) ?? null;
}

export function offerLine(offer: Offer): string {
  const price = offer.estimated_price ? ` Cenovo by sme sa mali zmestiť približne do ${offer.estimated_price} eur.` : "";
  return `Dominikovi teraz ostal jeden rozpracovaný web pre ${CATEGORY_GENITIVE[offer.category]}, pôvodný klient ho nakoniec neprebral. Napadlo mi, že by sa možno hodil práve vám — vedel by ho upraviť pre vás.${price}`;
}

export const DOMINIK_INTRO =
  "Inak, mám kamaráta Dominika, ktorý robí weby pre menšie firmy, a napadlo mi, že by to pre vás možno bolo zaujímavé.";

export const KEY_QUESTION = "Môžem mu na vás dať číslo? Ozval by sa vám sám, nič nemusíte riešiť.";

export const CALL_GOAL = "Zistiť, či môže Dominik zavolať. Nie predať web.";

export function whatNotToSay(category: CategoryId, hasOffer: boolean): string[] {
  const list = [
    "Nehovor, že majú zlý alebo zastaraný web.",
    "Žiadne technické slová — SEO, responzivita, UX, konverzie.",
    "Nezačínaj Dominikom ani cenou — najprv normálny rozhovor.",
    "Nesľubuj termíny ani presnú cenu — to rieši Dominik.",
  ];
  if (!hasOffer) list.push("Nespomínaj žiadny hotový ani rozpracovaný web — pre tento segment ho nemáme.");
  if (categoryOf(category).gallery) list.push("Nekritizuj ich fotky ani realizácie — to je ich hrdosť.");
  return list;
}

export function defaultObjections(hasOffer: boolean, price: number | null) {
  return [
    {
      objection: "Už web máme.",
      answer:
        "Jasné, to som videl — preto volám. Nejde o nový web za každú cenu, len o tú jednu vec, čo som si všimol. Dominik by vám povedal, či sa to dá jednoducho upraviť.",
    },
    {
      objection: "Teraz to nepotrebujeme.",
      answer: "V pohode, rozumiem. Môžem sa ešte ozvať o pár mesiacov, alebo to radšej nechať tak?",
    },
    {
      objection: "Pošlite mi e-mail.",
      answer: "Jasné. Na aký e-mail? Dominik vám tam pošle krátko, o čo ide, aj s ukážkou.",
    },
    {
      objection: "Koľko to stojí?",
      answer:
        hasOffer && price
          ? `Pri tomto by to malo byť približne do ${price} eur, ale presne vám to povie Dominik podľa toho, čo by ste chceli.`
          : "To závisí od toho, čo by ste potrebovali — Dominik vám to povie hneď na rovinu, nie je to žiadna veľká investícia.",
    },
    {
      objection: "Nemám teraz čas.",
      answer: "Chápem, nebudem zdržiavať. Kedy sa vám hodí, aby vám Dominik zavolal — skôr ráno alebo poobede?",
    },
    {
      objection: "Ozveme sa neskôr.",
      answer: "Dobre. Aby to nezapadlo, môže vám Dominik o týždeň-dva brnknúť? Ak nebude záujem, stačí povedať.",
    },
  ];
}

/**
 * Dominikov odporúčaný vstup do hovoru (3–5 viet) — skladá sa z toho,
 * čo reálne povedal kamarát a čo sme reálne našli.
 */
export function dominikOpening(opts: {
  adminName: string;
  callerName: string;
  company: Company;
  lead: Lead;
  call: Pick<CallLog, "outcome" | "company_said" | "note">;
}): { opening: string[]; goal: string[] } {
  const { adminName, callerName, lead, call } = opts;
  const obs = lead.call_brief?.observation ?? lead.analysis?.primary_hook ?? null;
  const said = call.company_said || call.note;
  const opening = [
    `Dobrý deň, tu ${adminName}. Volám vám kvôli tomu, že vám nedávno volal môj kamarát ${callerName}.`,
    said
      ? `Spomínal mi, že ste sa bavili o webe — vraj ${lowerFirst(stripQuotes(said))}`
      : "Spomínal mi, že ste sa bavili o webe a že by ste neboli proti, keby som sa ozval.",
    obs ? `Pozeral som si vaše stránky a všimol som si hlavne to, že ${lowerFirst(stripDot(obs))}.` : null,
    lead.call_brief?.offer
      ? "Mám rozpracovaný web pre podobnú firmu, takže by som vám vedel rýchlo ukázať, ako by to mohlo vyzerať."
      : null,
    "Chcel som sa len spýtať, či je to pre vás ešte aktuálne a čo by ste od toho potrebovali.",
  ].filter((x): x is string => !!x);
  return {
    opening: opening.slice(0, 5),
    goal: ["Zistiť, či je problém reálny a čo potrebujú", "Ukázať riešenie (ukážka)", "Dohodnúť ďalší krok — ponuka alebo stretnutie"],
  };
}

const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);
const stripDot = (s: string) => s.trim().replace(/[.!…]+$/, "");
const stripQuotes = (s: string) => {
  const t = s.trim().replace(/^[„"“]+|[“"”]+$/g, "");
  return /[.!?…]$/.test(t) ? t : `${t}.`;
};
