/**
 * Routing kanála: lead → opportunity → najlepší kanál → (ak CALL) aktívny operátor.
 *
 * Prvá verzia je iba RULE-BASED a vysvetliteľná. Každé pravidlo má text a výsledok
 * (splnené / nesplnené), ktoré sa ukážu v UI. Žiadny model nerozhoduje, komu sa volá.
 *
 * DJWeby je async-first: CALL je výnimka, keď platí všetko naraz. Inak ASYNC
 * (demo + správa, ktorú schvaľuje Dominik). Nič sa tu neodosiela, výsledok je iba odporúčanie.
 *
 *   HOLD   nekontaktovať, žiadny kontakt, alebo lead je dobrý na hovor, ale nie je voľný operátor
 *   CALL   všetky kvalitné brány + voľný aktívny operátor (dnes Roman)
 *   ASYNC  všetko ostatné
 */
import { canTakeCall, type Operator } from "./operators";
import { atLeast, callSuitable, type Opportunity } from "./opportunity";
import { categoryOf } from "./types";

export const CHANNELS = ["CALL", "ASYNC", "HOLD"] as const;
export type Channel = (typeof CHANNELS)[number];

export type Rule = { key: string; label: string; passed: boolean };
export type ChannelDecision = {
  version: 1;
  channel: Channel;
  /** Pri ASYNC: ktorou cestou by išla správa po schválení (nič sa neposiela automaticky). */
  message_via: "EMAIL" | "SMS" | null;
  operator_id: string | null;
  rules: Rule[];
  reasons: string[];
};

export type ChannelInput = {
  category: string;
  score_band: "high" | "medium" | "low" | null | undefined;
  opportunity: Opportunity;
  has_phone: boolean;
  /** Telefón overený z viacerých zdrojov (radar: primary_phone.confidence = high). */
  phone_verified?: boolean;
  /** Odbor overený (radar: category.confidence high alebo medium). */
  category_verified?: boolean;
  has_email: boolean;
  do_not_contact: boolean;
  operators: Operator[];
  /** Koľko leadov dnes už operátor dostal (kvôli daily_capacity). */
  assigned_today?: Record<string, number>;
};

export function chooseChannel(i: ChannelInput): ChannelDecision {
  const d = i.opportunity.dimensions;
  if (i.do_not_contact) return decision("HOLD", null, null, [], ["Firma je na zozname Nekontaktovať"]);
  if (!i.has_phone && !i.has_email) return decision("HOLD", null, null, [], ["Nemáme telefón ani e-mail"]);

  const phoneSignal = i.opportunity.observed.some((s) => s.key === "phone_ordering");
  const phoneSegment = callSuitable(i.category);
  const operator = i.operators.find((o) => canTakeCall(o, categoryOf(i.category).id, i.assigned_today?.[o.operator_id] ?? 0)) ?? null;

  const quality: Rule[] = [
    {
      key: "value",
      label: "Silný lead (príležitosť TOP alebo skóre v pásme high)",
      passed: i.opportunity.priority === "TOP" || i.score_band === "high",
    },
    { key: "evidence", label: "Dôkazy aspoň MEDIUM (GOLD alebo SILVER)", passed: atLeast(d.EVIDENCE_QUALITY.level, "MEDIUM") },
    { key: "active", label: "Firma je aktívna (register, web alebo profil)", passed: atLeast(d.BUSINESS_ACTIVITY.level, "MEDIUM") },
    {
      key: "fit",
      label: "Je čo riešiť: systém pre segment alebo slabý web",
      passed: atLeast(d.AUTOMATION_FIT.level, "MEDIUM") || atLeast(d.VISUAL_GAP.level, "MEDIUM"),
    },
    {
      key: "phone_natural",
      label: phoneSignal ? "Telefón je ich kanál (píšu to na webe)" : "Lokálna firma, telefonát majiteľovi je bežný",
      passed: phoneSignal || phoneSegment,
    },
    { key: "phone", label: "Telefón overený (vysoká istota)", passed: i.has_phone && (i.phone_verified ?? true) },
    { key: "category", label: "Odbor overený", passed: i.category_verified ?? true },
  ];
  const opRule: Rule = { key: "operator", label: operator ? `Voľný operátor: ${operator.name}` : "Voľný aktívny operátor pre CALL", passed: !!operator };
  const rules = [...quality, opRule];

  if (rules.every((r) => r.passed)) {
    return decision("CALL", null, operator!.operator_id, rules, [`Všetky podmienky hovoru splnené → ${operator!.name}`]);
  }
  if (quality.every((r) => r.passed)) {
    // Dobrý na hovor, ale nikto nemôže volať: nečakáme ho do async, počká na operátora.
    return decision("HOLD", null, null, rules, ["Lead je dobrý na hovor, ale nie je voľný aktívny operátor"]);
  }
  const via = i.has_email ? "EMAIL" : "SMS";
  const failed = rules.filter((r) => !r.passed).map((r) => `nesplnené: ${r.label}`);
  return decision("ASYNC", via, null, rules, ["Default je demo + správa na schválenie", ...failed]);
}

function decision(channel: Channel, via: ChannelDecision["message_via"], op: string | null, rules: Rule[], reasons: string[]): ChannelDecision {
  return { version: 1, channel, message_via: via, operator_id: op, rules, reasons };
}
