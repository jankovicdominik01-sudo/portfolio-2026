/**
 * Odmena volajúceho. Suma ani percento sa NIKDY nevymýšľa — berie sa iba zo Settings.
 * Kým Dominik pravidlo nenastaví, záznamy vznikajú s amount = null („NEEDS CONFIGURATION“),
 * aby sa po nastavení dali dopočítať spätne.
 *
 * Stavy: POTENCIÁLNA (neukladá sa — lead v pipeline), PENDING (čaká na podmienku),
 * CONFIRMED (nárok vznikol), PAID (vyplatená), VOID (zrušená — obchod padol / model to nezahŕňa).
 */
import type { Commission, Lead, Settings } from "./types";

type Comp = Settings["compensation"];
export type MoneyEvent = "consent" | "contacted" | "interested" | "deal" | "paid" | "lost";

const includes = (c: Comp, kind: Commission["kind"]) =>
  c.model === null || c.model === "both" || c.model === kind;

export function amountFor(kind: Commission["kind"], c: Comp, salePrice: number | null): number | null {
  if (kind === "handoff") return c.model && includes(c, "handoff") ? c.handoff_amount : null;
  if (!c.model || !includes(c, "sale")) return null;
  if (c.sale_amount !== null) return c.sale_amount;
  if (c.sale_percent !== null && salePrice !== null) return Math.round(salePrice * c.sale_percent) / 100;
  return null;
}

/** Je pravidlo odmeny úplne nastavené? */
export function compensationConfigured(c: Comp): boolean {
  if (!c.model) return false;
  const h = c.model === "sale" || (c.handoff_amount !== null && c.handoff_condition !== null);
  const s = c.model === "handoff" || c.sale_amount !== null || c.sale_percent !== null;
  return h && s;
}

const newId = () => `cm_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

/**
 * Čo sa má stať s províziami pri udalosti na leade. Vracia nové/zmenené záznamy (upsert).
 * `caller` = kto získal súhlas (lead.consent.by_user).
 */
export function commissionEffects(
  lead: Lead,
  event: MoneyEvent,
  existing: Commission[],
  settings: Settings,
  nowIso: string,
): Commission[] {
  const c = settings.compensation;
  const caller = lead.consent?.by_user;
  if (!caller) return [];
  const mine = existing.filter((x) => x.lead_id === lead.id && x.user === caller);
  const handoff = mine.find((x) => x.kind === "handoff");
  const sale = mine.find((x) => x.kind === "sale");
  const price = lead.sale?.price ?? null;
  const out: Commission[] = [];
  const confirm = (x: Commission, p: number | null = price): Commission => ({
    ...x,
    state: "confirmed",
    confirmed_at: nowIso,
    sale_price: x.kind === "sale" ? p : x.sale_price,
    amount: amountFor(x.kind, c, p),
  });

  if (event === "consent" && !handoff && includes(c, "handoff")) {
    const x: Commission = {
      id: newId(),
      user: caller,
      lead_id: lead.id,
      kind: "handoff",
      amount: amountFor("handoff", c, null),
      state: "pending",
      reason: "Súhlas s kontaktom od Dominika",
      sale_price: null,
      created_at: nowIso,
      confirmed_at: null,
      paid_at: null,
    };
    out.push(c.handoff_condition === "on_consent" ? confirm(x) : x);
  }
  if (handoff?.state === "pending") {
    const cond = c.handoff_condition;
    if ((event === "contacted" && cond === "on_contacted") || (event === "interested" && (cond === "on_contacted" || cond === "on_interest")))
      out.push(confirm(handoff));
    if (event === "deal" || event === "paid") out.push(confirm(handoff)); // predaj ⇒ podmienka splnená vždy
    if (event === "lost" && cond) {
      // Dominik s firmou hovoril (lost po kontakte) — pri podmienke on_contacted nárok ostáva.
      out.push(cond === "on_contacted" && lead.stage_at?.contacted ? confirm(handoff) : { ...handoff, state: "void" });
    }
  }
  if (event === "deal" && !sale && includes(c, "sale")) {
    out.push({
      id: newId(),
      user: caller,
      lead_id: lead.id,
      kind: "sale",
      amount: amountFor("sale", c, price),
      state: "pending",
      reason: "Predaj webu — čaká na platbu",
      sale_price: price,
      created_at: nowIso,
      confirmed_at: null,
      paid_at: null,
    });
  }
  if (event === "paid") {
    const paidPrice = lead.sale?.paid_amount ?? price;
    if (sale && sale.state === "pending") out.push({ ...confirm(sale, paidPrice), reason: "Klient zaplatil" });
    if (!sale && includes(c, "sale")) {
      out.push({
        id: newId(),
        user: caller,
        lead_id: lead.id,
        kind: "sale",
        amount: amountFor("sale", c, paidPrice),
        state: "confirmed",
        reason: "Klient zaplatil",
        sale_price: paidPrice,
        created_at: nowIso,
        confirmed_at: nowIso,
        paid_at: null,
      });
    }
  }
  if (event === "lost" && sale?.state === "pending") out.push({ ...sale, state: "void" });
  return out;
}

/**
 * Po zmene pravidla dopočíta nevyplatené záznamy: sumy, typy mimo modelu zruší
 * a spätne vyhodnotí podmienky podľa toho, čo sa s leadom medzitým stalo.
 */
export function recompute(list: Commission[], settings: Settings, leads: Lead[] = []): Commission[] {
  const c = settings.compensation;
  const byId = new Map(leads.map((l) => [l.id, l]));
  return list.map((x) => {
    if (x.state === "paid" || x.state === "void") return x;
    if (c.model && !includes(c, x.kind)) return { ...x, state: "void" as const };
    const next: Commission = { ...x, amount: amountFor(x.kind, c, x.sale_price) };
    const lead = byId.get(x.lead_id);
    if (next.state !== "pending" || !lead) return next;
    const at = lead.stage_at ?? {};
    if (x.kind === "handoff" && c.handoff_condition) {
      const when =
        c.handoff_condition === "on_consent"
          ? x.created_at
          : c.handoff_condition === "on_contacted"
            ? (at.contacted ?? at.won ?? at.paid)
            : (at.interested ?? at.won ?? at.paid);
      if (when) return { ...next, state: "confirmed", confirmed_at: when };
      if (lead.status === "lost") return { ...next, state: "void" };
    }
    if (x.kind === "sale" && at.paid) {
      const price = lead.sale?.paid_amount ?? lead.sale?.price ?? x.sale_price;
      return { ...next, state: "confirmed", confirmed_at: at.paid, sale_price: price, amount: amountFor("sale", c, price) };
    }
    return next;
  });
}

/* ─────────────── Prehľad pre volajúceho ─────────────── */

const TZ = "Europe/Bratislava";
const ymd = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));

function weekStart(nowIso: string) {
  const d = new Date(`${ymd(nowIso)}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // pondelok = 0
  return new Date(d.getTime() - dow * 86_400_000).toISOString().slice(0, 10);
}

export type Earnings = {
  today: number;
  week: number;
  month: number;
  pending: number;
  paid: number;
  /** záznamy bez sumy (pravidlo nie je nastavené) */
  unpriced: number;
  items: Commission[];
};

/** Iba CONFIRMED a PAID sa rátajú ako zarobené. PENDING zvlášť. Nič potenciálne. */
export function earnings(list: Commission[], user: string, nowIso: string): Earnings {
  const mine = list.filter((x) => x.user === user && x.state !== "void");
  const today = ymd(nowIso);
  const week = weekStart(nowIso);
  const month = today.slice(0, 7);
  const sum = (xs: Commission[]) => xs.reduce((a, x) => a + (x.amount ?? 0), 0);
  const earned = mine.filter((x) => (x.state === "confirmed" || x.state === "paid") && x.confirmed_at);
  return {
    today: sum(earned.filter((x) => ymd(x.confirmed_at!) === today)),
    week: sum(earned.filter((x) => ymd(x.confirmed_at!) >= week)),
    month: sum(earned.filter((x) => ymd(x.confirmed_at!).slice(0, 7) === month)),
    pending: sum(mine.filter((x) => x.state === "pending")),
    paid: sum(mine.filter((x) => x.state === "paid")),
    unpriced: mine.filter((x) => x.amount === null).length,
    items: mine,
  };
}
