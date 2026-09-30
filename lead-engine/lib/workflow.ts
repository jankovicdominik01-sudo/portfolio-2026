/**
 * Čistá obchodná logika stavov (bez úložiska) — testovateľná, používa ju lib/leads.ts.
 *
 * Operátor (opener):  ready_to_call → called (pokus / callback / záujem) → dominik_call (DOMINIK FOLLOW-UP = súhlas s kontaktom)
 * Dominik (sales):    dominik_call → contacted → interested → demo → offer_sent → won → paid
 *
 * Súhlas s kontaktom ≠ záujem. Záujem (interested) nastaví iba Dominik po vlastnom hovore.
 */
import type {
  CallLog,
  CallerOutcome,
  Company,
  Consent,
  Lead,
  LeadStatus,
  NextAction,
  SessionUser,
} from "./types";

/* ─────────────── Pravidlá pokusov ─────────────── */

/** Najviac 3 pokusy „nezdvihol“, potom lead končí ako nedovolaný. */
export const MAX_ATTEMPTS = 3;
/** Pauza po 1. a 2. neúspešnom pokuse (dni). */
export const RETRY_AFTER_DAYS = [1, 2] as const;

const DAY = 86_400_000;

/** Termín ako ISO: daný kalendárny deň dopoludnia (UTC 08:00 = 9–10 h na Slovensku). */
export function dayAt(ymd: string): string {
  return new Date(`${ymd}T08:00:00.000Z`).toISOString();
}

/**
 * Termín s časom v slovenskom čase (Europe/Bratislava, aj letný čas) ako ISO.
 * Bez času = dayAt (dopoludnie).
 */
export function slotAt(ymd: string, hm: string | null | undefined): string {
  if (!hm) return dayAt(ymd);
  const [h, m] = hm.split(":").map(Number);
  const guess = Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10), h, m);
  const offset = (t: number) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Bratislava", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
        .formatToParts(new Date(t))
        .map((x) => [x.type, x.value]),
    );
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - t;
  };
  return new Date(guess - offset(guess - offset(guess))).toISOString();
}

export function ymdPlus(nowIso: string, days: number): string {
  return new Date(new Date(nowIso).getTime() + days * DAY).toISOString().slice(0, 10);
}

/* ─────────────── Prístup ─────────────── */

/** Stavy, v ktorých lead patrí volajúcemu (fronta / hovor). */
export const CALLER_STATUSES: LeadStatus[] = ["ready_to_call", "called"];

/**
 * Volajúci vidí plný lead iba ak je jemu priradený a je v jeho fáze.
 * Nikdy firmu označenú „nevolať“.
 */
export function callerCanSee(u: SessionUser, lead: Lead, company?: Company | null): boolean {
  if (u.role === "admin") return true;
  if (company?.do_not_call) return false;
  return lead.assigned_to === u.username && CALLER_STATUSES.includes(lead.status);
}

/* ─────────────── Výsledok hovoru volajúceho ─────────────── */

export type ConsentInput = {
  contact_person: string | null;
  company_said: string | null;
  caught_attention: string | null;
  heard_price: boolean;
  call_on: string | null; // YYYY-MM-DD
  call_note: string | null;
  email: string | null;
};

export type CallerInput = {
  outcome: CallerOutcome;
  note: string | null;
  /** YYYY-MM-DD, povinné pri „Zavolať neskôr“, voliteľné pri „Má záujem“ */
  callback_on: string | null;
  /** HH:MM (slovenský čas), voliteľné */
  callback_time?: string | null;
  /** povinné pri Dominik follow-up a „Má záujem“ (čo povedal, čo zaujalo, cena) */
  consent: ConsentInput | null;
};

export type CallerResult = {
  call: Omit<CallLog, "id">;
  leadPatch: Partial<Lead>;
  companyPatch: Partial<Company> | null;
  handoff: boolean;
  closed: boolean;
};

export class WorkflowError extends Error {}

const HANDOFF_OUTCOMES: CallerOutcome[] = ["consent", "wants_info"];

export function applyCallerOutcome(
  lead: Lead,
  user: { username: string; name: string },
  input: CallerInput,
  nowIso: string,
): CallerResult {
  const attempt = (lead.call_attempts ?? 0) + 1;
  const handoff = HANDOFF_OUTCOMES.includes(input.outcome);

  if (handoff && !input.consent) throw new WorkflowError("Chýba zápis súhlasu.");
  if (input.outcome === "interested" && !input.consent) throw new WorkflowError("Zapíš, čo firmu zaujalo.");
  if (input.callback_time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.callback_time)) throw new WorkflowError("Čas zadaj ako HH:MM.");
  if (input.outcome === "interested" && input.callback_on && input.callback_on < nowIso.slice(0, 10)) {
    throw new WorkflowError("Dátum callbacku je v minulosti.");
  }
  if (input.outcome === "call_later") {
    if (!input.callback_on || !/^\d{4}-\d{2}-\d{2}$/.test(input.callback_on)) {
      throw new WorkflowError("Vyber dátum, kedy zavolať.");
    }
    if (input.callback_on < nowIso.slice(0, 10)) throw new WorkflowError("Dátum callbacku je v minulosti.");
  }

  const call: Omit<CallLog, "id"> = {
    lead_id: lead.id,
    created_at: nowIso,
    by: user.name,
    by_user: user.username,
    role: "caller",
    outcome: input.outcome,
    note: input.note,
    company_said: input.consent?.company_said ?? null,
    dominik_may_call: handoff,
    preferred_time: null,
    email: input.consent?.email ?? null,
    attempt,
  };

  const leadPatch: Partial<Lead> = { last_contact: nowIso, call_attempts: attempt, updated_at: nowIso };
  let companyPatch: Partial<Company> | null = null;
  let closed = false;
  const set = (status: LeadStatus, next: NextAction | null, at: string | null) =>
    Object.assign(leadPatch, { status, next_action: next, next_action_at: at });

  switch (input.outcome) {
    case "no_answer": {
      if (attempt >= MAX_ATTEMPTS) {
        set("archived", null, null);
        leadPatch.archive_reason = "unreachable";
        closed = true;
      } else {
        set("called", "caller_call", dayAt(ymdPlus(nowIso, RETRY_AFTER_DAYS[attempt - 1] ?? 2)));
      }
      break;
    }
    case "wrong_number":
      // Späť Dominikovi na overenie čísla — z fronty volajúceho zmizne.
      set("analyzed", "verify_phone", null);
      leadPatch.trust = { ...lead.trust, phone: "unverified" };
      leadPatch.priority = "check";
      leadPatch.priority_reasons = ["Nesprávne číslo — treba overiť kontakt."];
      break;
    case "not_interested":
      set("lost", null, null);
      leadPatch.lost_reason = "caller_not_interested";
      closed = true;
      break;
    case "has_web":
      set("lost", null, null);
      leadPatch.lost_reason = "has_web";
      closed = true;
      break;
    case "call_later":
      set("called", "callback", slotAt(input.callback_on!, input.callback_time));
      break;
    case "interested": {
      // Záujem bez súhlasu, aby sa ozval Dominik: ostáva operátorovi na ďalší hovor.
      const c = input.consent!;
      leadPatch.interest = {
        at: nowIso,
        by_user: user.username,
        company_said: c.company_said,
        caught_attention: c.caught_attention,
        heard_price: c.heard_price,
        note: input.note,
      };
      set("called", "callback", input.callback_on ? slotAt(input.callback_on, input.callback_time) : dayAt(ymdPlus(nowIso, 2)));
      break;
    }
    case "do_not_call":
      set("do_not_call", null, null);
      companyPatch = { do_not_call: true, updated_at: nowIso };
      closed = true;
      break;
    case "consent":
    case "wants_info": {
      const c = input.consent!;
      const consent: Consent = {
        at: nowIso,
        by_user: user.username,
        by_name: user.name,
        kind: input.outcome === "consent" ? "consent" : "info",
        contact_person: c.contact_person,
        company_said: c.company_said,
        caught_attention: c.caught_attention,
        heard_price: c.heard_price,
        call_on: c.call_on,
        // čas bez dátumu sa nesmie stratiť: pripíše sa k poznámke
        call_note: !c.call_on && input.callback_time ? [c.call_note, `o ${input.callback_time}`].filter(Boolean).join(", ") : c.call_note,
        email: c.email,
        note: input.note,
      };
      leadPatch.consent = consent;
      set("dominik_call", "dominik_call", c.call_on ? slotAt(c.call_on, input.callback_time) : nowIso);
      if (c.contact_person) companyPatch = { contact_person: c.contact_person, updated_at: nowIso };
      break;
    }
  }
  return { call, leadPatch, companyPatch, handoff, closed };
}

/* ─────────────── Dominikov pipeline ─────────────── */

export const SALES_STEPS = [
  "contacted",
  "interested",
  "demo",
  "offer",
  "deal",
  "paid",
  "unreachable",
  "follow_up",
  "bad_fit",
  "not_interested",
] as const;
export type SalesStep = (typeof SALES_STEPS)[number];

const STEP_STATUS: Partial<Record<SalesStep, LeadStatus>> = {
  contacted: "contacted",
  interested: "interested",
  demo: "demo",
  offer: "offer_sent",
  deal: "won",
  paid: "paid",
};

/** Poradie fáz — pre „najvyššia dosiahnutá fáza“ a funnel. */
export const STAGE_ORDER: LeadStatus[] = ["dominik_call", "contacted", "interested", "demo", "offer_sent", "won", "paid"];

export type SalesInput = { note: string | null; date: string | null; price: number | null };

/**
 * Dominikov krok. Vracia patch leadu. Každá fáza si pamätá čas prvého dosiahnutia (stage_at),
 * aby funnel sedel aj po neskoršej strate. Záujem sa nikdy nenastaví automaticky zo súhlasu.
 */
export function applySalesStep(lead: Lead, step: SalesStep, input: SalesInput, nowIso: string, defaultPrice: number | null) {
  const stageAt = { ...(lead.stage_at ?? {}) };
  const reach = (st: LeadStatus) => {
    // Dosiahnutie fázy znamená aj všetky predchádzajúce (napr. „zaplatené“ ⇒ bol aj kontaktovaný).
    const idx = STAGE_ORDER.indexOf(st);
    for (const s of STAGE_ORDER.slice(1, idx + 1)) stageAt[s] ??= nowIso;
  };
  const patch: Partial<Lead> = { last_contact: nowIso, updated_at: nowIso };

  const status = STEP_STATUS[step];
  if (status) {
    reach(status);
    patch.status = status;
    patch.lost_reason = null;
    const next: Partial<Record<LeadStatus, [NextAction | null, number | null]>> = {
      contacted: ["follow_up", 2],
      interested: ["send_demo", 0],
      demo: ["send_offer", 1],
      offer_sent: ["follow_up", 3],
      won: ["follow_up", 7],
      paid: [null, null],
    };
    const [na, days] = next[status] ?? [null, null];
    patch.next_action = na;
    patch.next_action_at = input.date ? dayAt(input.date) : days === null ? null : dayAt(ymdPlus(nowIso, days));
  }
  if (step === "deal" || step === "paid") {
    const prev = lead.sale ?? { price: null, agreed_at: null, paid_at: null, paid_amount: null };
    const price = input.price ?? prev.price ?? defaultPrice;
    patch.sale = {
      price,
      agreed_at: prev.agreed_at ?? nowIso,
      paid_at: step === "paid" ? nowIso : prev.paid_at,
      paid_amount: step === "paid" ? (input.price ?? price) : prev.paid_amount,
    };
  }
  if (step === "unreachable") {
    patch.next_action = "dominik_call";
    patch.next_action_at = dayAt(input.date ?? ymdPlus(nowIso, 1));
  }
  if (step === "follow_up") {
    if (!input.date) throw new WorkflowError("Vyber dátum follow-upu.");
    patch.next_action = "follow_up";
    patch.next_action_at = dayAt(input.date);
  }
  if (step === "bad_fit" || step === "not_interested") {
    // Dominik s firmou hovoril → kontakt nastal (dôležité pre funnel aj províziu za handoff).
    stageAt.contacted ??= nowIso;
    patch.status = "lost";
    patch.lost_reason = step === "bad_fit" ? "bad_fit" : "dominik_not_interested";
    patch.next_action = null;
    patch.next_action_at = null;
  }
  patch.stage_at = stageAt;
  return patch;
}

/* ─────────────── Priradenie ─────────────── */

/** Nové leady dostáva prvý aktívny volajúci (nie natvrdo meno). */
export function pickCaller(active: SessionUser[]): string | null {
  return active.find((u) => u.role === "caller")?.username ?? null;
}

/**
 * Nevolané leady neaktívneho volajúceho presunie na aktívneho. Leady, ktoré už volal,
 * ostávajú jemu (história). Vracia zoznam patchov.
 */
export function reassignUnworked(leads: Lead[], from: string, to: string, nowIso: string, by: string) {
  return leads
    .filter((l) => l.assigned_to === from && l.status === "ready_to_call" && (l.call_attempts ?? 0) === 0)
    .map((l) => ({
      id: l.id,
      patch: {
        assigned_to: to,
        assigned_history: [...(l.assigned_history ?? []), { user: to, at: nowIso, by }],
        updated_at: nowIso,
      } satisfies Partial<Lead>,
    }));
}

/** Kto hovor uskutočnil (staršie záznamy majú iba meno). */
export function callUser(c: Pick<CallLog, "by" | "by_user">, users: { username: string; name: string }[]): string {
  return c.by_user ?? users.find((u) => u.name === c.by)?.username ?? c.by;
}
